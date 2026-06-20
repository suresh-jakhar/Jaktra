import { AgentRepository } from './agent.repository.js';
import { AimlService } from './aiml.service.js';
import { InvoiceRepository } from '../invoice/invoice.repository.js';
import { TriageService, type TriagedInvoice, type UrgencyTier } from './triage.service.js';
import { EventService } from '../event/event.service.js';
import { DlqService } from '../dlq/dlq.service.js';
import { IdempotencyService } from '../../modules/communication/services/idempotency.service.js';
import { CommunicationService } from '../communication/communication.service.js';
import { CommunicationRepository } from '../communication/communication.repository.js';
import { PaymentService } from '../payment/payment.service.js';
import { logger } from '../../shared/logger.js';
import { NotFoundError } from '../../shared/errors/index.js';
import { mapErrorToDisplayMessage } from '../../shared/utils/error-mapper.js';

export class AgentService {
  private activeRuns = new Set<string>();

  constructor(
    private agentRepo: AgentRepository,
    private aimlService: AimlService,
    private invoiceRepo: InvoiceRepository,
    private triageService: TriageService,
    private eventService: EventService,
    private dlqService: DlqService,
    private idempotencyService: IdempotencyService,
    private paymentService: PaymentService,
    private communicationService: CommunicationService,
    private communicationRepo: CommunicationRepository
  ) {}

  hasActiveRuns(): boolean {
    return this.activeRuns.size > 0;
  }

  async triggerRun(tenantId: string) {
    const invoices = await this.invoiceRepo.findByTenant(tenantId);
    const triaged = this.triageService.triageInvoices(invoices);

    const run = await this.agentRepo.createRun({
      tenantId,
      status: 'running',
      invoicesProcessed: 0,
      emailsSent: 0,
      errors: 0,
    });

    if (triaged.invoices.length === 0) {
      return await this.agentRepo.updateRun(run.id, tenantId, {
        status: 'completed',
        endTime: new Date(),
      });
    }

    this.activeRuns.add(run.id);
    this.processRunInBackground(run.id, tenantId, triaged.invoices)
      .catch(async (err) => {
        logger.error(`Background run ${run.id} failed`, err);
        await this.agentRepo.updateRun(run.id, tenantId, {
          status: 'failed',
          endTime: new Date(),
          errorDetails: err instanceof Error ? err.stack || err.message : String(err),
        }).catch((dbErr) => logger.error('Failed to update run status to failed in database', dbErr));
      })
      .finally(() => {
        this.activeRuns.delete(run.id);
      });

    return run;
  }

  private async processRunInBackground(
    runId: string,
    tenantId: string,
    invoices: TriagedInvoice[]
  ): Promise<void> {
    let processed = 0;
    let emailsSent = 0;
    let errorsCount = 0;

    for (const inv of invoices) {
      try {
        const idempotencyCheck = await this.idempotencyService.checkInvoice(tenantId, inv.id);
        if (idempotencyCheck.skipped) {
          await this.eventService.emitEvent(
            inv.id,
            'halted',
            { reason: 'idempotency_skip', ...idempotencyCheck, runId },
            'system',
            tenantId
          );
          continue;
        }

        const channels = this.selectChannels(inv.computedTier);
        if (channels.length === 0) {
          await this.eventService.emitEvent(
            inv.id,
            'halted',
            { reason: 'no_automated_channel', tier: inv.computedTier, runId },
            'system',
            tenantId
          );
          continue;
        }

        let paymentLink = undefined;
        try {
          paymentLink = await this.paymentService.getOrGeneratePaymentLink(tenantId, inv.id, 'razorpay');
        } catch (e: any) {
          logger.warn(`Could not generate payment link for invoice ${inv.id} - ${e.message}`);
        }

        for (const channel of channels) {
          const resp = await this.aimlService.triggerFollowup({
            invoiceId: inv.id,
            invoiceNo: inv.invoiceNo,
            clientName: inv.clientName,
            contactEmail: inv.contactEmail,
            invoiceAmount: inv.invoiceAmount.toString(),
            currency: (inv as any).currency ?? 'INR',
            dueDate: inv.dueDate,
            daysOverdue: inv.daysOverdue,
            urgencyTier: inv.computedTier,
            followupCount: inv.followupCount,
            channel,
            paymentLink,
          });

          // Generation failed — record in DLQ and move on
          if (resp.error || !resp.emailGenerated) {
            errorsCount++;
            await this.communicationRepo.create({
              tenantId,
              invoiceId: inv.id,
              channel: channel as 'email' | 'sms' | 'whatsapp',
              subject: resp.subject ?? null,
              body: resp.bodyPreview ?? null,
              status: 'failed',
              sentAt: null,
              error: resp.error ?? 'Generation produced no content',
            });
            await this.eventService.emitEvent(
              inv.id,
              'email_generated',
              { subject: resp.subject, bodyPreview: resp.bodyPreview, error: resp.error, channel, runId },
              'ai-agent',
              tenantId
            );
            await this.dlqService.recordFailure(inv.id, tenantId, resp.error ?? 'Generation produced no content').catch(() => {});
            continue;
          }

          // Generation succeeded — now actually send the email
          let sendError: string | undefined;
          try {
            await this.communicationService.send({
              tenantId,
              to: inv.contactEmail,
              subject: resp.subject!,
              html: resp.htmlBody ?? resp.bodyPreview ?? '',
              channel: channel as 'email',
            });
          } catch (sendErr: any) {
            sendError = sendErr?.message ?? String(sendErr);
            logger.warn(`Email send failed for invoice ${inv.id}: ${sendError}`);
          }

          const now = new Date();
          if (!sendError) {
            // Record successful communication
            await this.communicationRepo.create({
              tenantId,
              invoiceId: inv.id,
              channel: channel as 'email' | 'sms' | 'whatsapp',
              subject: resp.subject ?? null,
              body: resp.bodyPreview ?? null,
              status: 'sent',
              sentAt: now,
              error: null,
            });
            // Update invoice followup tracking
            await this.invoiceRepo.update(inv.id, tenantId, {
              followupCount: inv.followupCount + 1,
              lastFollowupDate: now,
            });
            emailsSent++;
            await this.eventService.emitEvent(
              inv.id,
              'email_sent',
              { subject: resp.subject, bodyPreview: resp.bodyPreview, channel, runId },
              'ai-agent',
              tenantId
            );
            await this.dlqService.clearFailure(inv.id, tenantId).catch(() => {});
          } else {
            // Record failed delivery
            errorsCount++;
            await this.communicationRepo.create({
              tenantId,
              invoiceId: inv.id,
              channel: channel as 'email' | 'sms' | 'whatsapp',
              subject: resp.subject ?? null,
              body: resp.bodyPreview ?? null,
              status: 'failed',
              sentAt: null,
              error: sendError,
            });
            await this.eventService.emitEvent(
              inv.id,
              'email_generated',
              { subject: resp.subject, bodyPreview: resp.bodyPreview, error: sendError, channel, runId },
              'ai-agent',
              tenantId
            );
            await this.dlqService.recordFailure(inv.id, tenantId, sendError).catch(() => {});
          }
        }

        processed++;
      } catch (err: unknown) {
        errorsCount++;
        const errMsg = err instanceof Error ? err.message : String(err);
        const errStack = err instanceof Error ? err.stack : undefined;
        const displayErr = mapErrorToDisplayMessage(err);
        await this.eventService.emitEvent(
          inv.id,
          'halted',
          { error: displayErr, runId },
          'system',
          tenantId
        );
        await this.dlqService.recordFailure(inv.id, tenantId, errMsg, errStack).catch(() => {});
      }

      if (processed % 10 === 0 || processed === invoices.length) {
        await this.agentRepo.updateRun(runId, tenantId, {
          invoicesProcessed: processed,
          emailsSent,
          errors: errorsCount,
        });
      }
    }

    await this.agentRepo.updateRun(runId, tenantId, {
      status: 'completed',
      endTime: new Date(),
      invoicesProcessed: processed,
      emailsSent,
      errors: errorsCount,
    });
  }

  async triggerSingleInvoice(invoiceId: string, tenantId: string) {
    const invoice = await this.invoiceRepo.findById(invoiceId);
    if (!invoice || invoice.tenantId !== tenantId) {
      throw new NotFoundError('Invoice not found');
    }

    const daysOverdue = this.triageService.computeDaysOverdue(invoice.dueDate);
    const urgencyTier = this.triageService.assignTier(daysOverdue);

    const channels = this.selectChannels(urgencyTier);
    if (channels.length === 0) {
      await this.eventService.emitEvent(
        invoice.id,
        'halted',
        { reason: 'no_automated_channel', tier: urgencyTier },
        'system',
        tenantId
      );
      return { skipped: true, reason: 'no_automated_channel', tier: urgencyTier };
    }

    const idempotencyCheck = await this.idempotencyService.checkInvoice(tenantId, invoice.id);
    if (idempotencyCheck.skipped) {
      await this.eventService.emitEvent(
        invoice.id,
        'halted',
        { reason: 'idempotency_skip', ...idempotencyCheck },
        'system',
        tenantId
      );
      return idempotencyCheck;
    }

    try {
      let paymentLink = undefined;
      try {
        paymentLink = await this.paymentService.getOrGeneratePaymentLink(tenantId, invoice.id, 'razorpay');
      } catch (e: any) {
        logger.warn(`Could not generate payment link for invoice ${invoice.id} - ${e.message}`);
      }

      const results = [];
      for (const channel of channels) {
        const resp = await this.aimlService.triggerFollowup({
          invoiceId: invoice.id,
          invoiceNo: invoice.invoiceNo,
          clientName: invoice.clientName,
          contactEmail: invoice.contactEmail,
          invoiceAmount: invoice.invoiceAmount.toString(),
          currency: (invoice as any).currency ?? 'INR',
          dueDate: invoice.dueDate,
          daysOverdue,
          urgencyTier,
          followupCount: invoice.followupCount,
          channel,
          paymentLink,
        });

        if (resp.error || !resp.emailGenerated) {
          await this.communicationRepo.create({
            tenantId,
            invoiceId: invoice.id,
            channel: channel as 'email' | 'sms' | 'whatsapp',
            subject: resp.subject ?? null,
            body: resp.bodyPreview ?? null,
            status: 'failed',
            sentAt: null,
            error: resp.error ?? 'Generation produced no content',
          });
          await this.eventService.emitEvent(
            invoice.id,
            'email_generated',
            { subject: resp.subject, bodyPreview: resp.bodyPreview, error: resp.error, channel },
            'ai-agent',
            tenantId
          );
          await this.dlqService.recordFailure(invoice.id, tenantId, resp.error ?? 'Generation produced no content').catch(() => {});
          results.push(resp);
          continue;
        }

        // Generation succeeded — now actually send
        let sendError: string | undefined;
        try {
          await this.communicationService.send({
            tenantId,
            to: invoice.contactEmail,
            subject: resp.subject!,
            html: resp.bodyPreview ?? '',
            channel: channel as 'email',
          });
        } catch (sendErr: any) {
          sendError = sendErr?.message ?? String(sendErr);
          logger.warn(`Email send failed for invoice ${invoice.id}: ${sendError}`);
        }

        const now = new Date();
        if (!sendError) {
          await this.communicationRepo.create({
            tenantId,
            invoiceId: invoice.id,
            channel: channel as 'email' | 'sms' | 'whatsapp',
            subject: resp.subject ?? null,
            body: resp.bodyPreview ?? null,
            status: 'sent',
            sentAt: now,
            error: null,
          });
          await this.invoiceRepo.update(invoice.id, tenantId, {
            followupCount: invoice.followupCount + 1,
            lastFollowupDate: now,
          });
          await this.eventService.emitEvent(
            invoice.id,
            'email_sent',
            { subject: resp.subject, bodyPreview: resp.bodyPreview, channel },
            'ai-agent',
            tenantId
          );
          await this.dlqService.clearFailure(invoice.id, tenantId).catch(() => {});
        } else {
          await this.communicationRepo.create({
            tenantId,
            invoiceId: invoice.id,
            channel: channel as 'email' | 'sms' | 'whatsapp',
            subject: resp.subject ?? null,
            body: resp.bodyPreview ?? null,
            status: 'failed',
            sentAt: null,
            error: sendError,
          });
          await this.eventService.emitEvent(
            invoice.id,
            'email_generated',
            { subject: resp.subject, bodyPreview: resp.bodyPreview, error: sendError, channel },
            'ai-agent',
            tenantId
          );
          await this.dlqService.recordFailure(invoice.id, tenantId, sendError).catch(() => {});
        }

        results.push({ ...resp, emailSent: !sendError });
      }

      return results.length === 1 ? results[0] : results;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const errStack = err instanceof Error ? err.stack : undefined;
      const displayErr = mapErrorToDisplayMessage(err);
      await this.eventService.emitEvent(
        invoice.id,
        'halted',
        { error: displayErr },
        'system',
        tenantId
      );
      await this.dlqService.recordFailure(invoice.id, tenantId, errMsg, errStack).catch(() => {});
      throw err;
    }
  }

  private selectChannels(tier: UrgencyTier): string[] {
    const channelMatrix: Record<UrgencyTier, string[]> = {
      'stage_1_warm': ['email'],
      'stage_2_firm': ['email'],
      'stage_3_serious': ['email'],  // future: ['email', 'sms']
      'stage_4_stern': ['email'],    // future: ['email', 'sms']
      'legal_escalation': [],        // no automated communication
    };
    return channelMatrix[tier] || ['email'];
  }

  async getRuns(tenantId: string) {
    return this.agentRepo.getRuns(tenantId);
  }

  async getRunDetails(runId: string, tenantId: string) {
    const run = await this.agentRepo.getRunById(runId, tenantId);
    if (!run) return null;

    const events = await this.eventService.findByRunId(runId);
    
    return {
      ...run,
      events
    };
  }
}
