import { AgentRepository } from './agent.repository.js';
import { AimlService } from './aiml.service.js';
import { InvoiceRepository } from '../invoice/invoice.repository.js';
import { TriageService, type TriagedInvoice, type UrgencyTier } from './triage.service.js';
import { EventService } from '../event/event.service.js';
import { DlqService } from '../dlq/dlq.service.js';
import { IdempotencyService } from '../../modules/communication/services/idempotency.service.js';
import { PaymentService } from '../payment/payment.service.js';
import { logger } from '../../shared/logger.js';

export class AgentService {
  constructor(
    private agentRepo: AgentRepository,
    private aimlService: AimlService,
    private invoiceRepo: InvoiceRepository,
    private triageService: TriageService,
    private eventService: EventService,
    private dlqService: DlqService,
    private idempotencyService: IdempotencyService,
    private paymentService: PaymentService
  ) {}

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

    this.processRunInBackground(run.id, tenantId, triaged.invoices)
      .catch(err => logger.error(`Background run ${run.id} failed`, err));

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
            dueDate: inv.dueDate,
            daysOverdue: inv.daysOverdue,
            urgencyTier: inv.computedTier,
            followupCount: inv.followupCount,
            channel,
            paymentLink,
          });

          if (resp.emailSent) emailsSent++;
          if (resp.error) errorsCount++;

          await this.eventService.emitEvent(
            inv.id,
            resp.emailSent ? 'email_sent' : 'email_generated',
            { subject: resp.subject, bodyPreview: resp.bodyPreview, error: resp.error, channel, runId },
            'ai-agent',
            tenantId
          );

          if (!resp.error) {
            await this.dlqService.clearFailure(inv.id, tenantId).catch(() => {});
          } else {
            await this.dlqService.recordFailure(inv.id, tenantId, resp.error).catch(() => {});
          }
        }

        processed++;
      } catch (err: unknown) {
        errorsCount++;
        await this.eventService.emitEvent(
          inv.id,
          'halted',
          { error: String(err), runId },
          'system',
          tenantId
        );
        await this.dlqService.recordFailure(inv.id, tenantId, String(err)).catch(() => {});
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
      throw new Error('Invoice not found');
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
          dueDate: invoice.dueDate,
          daysOverdue,
          urgencyTier,
          followupCount: invoice.followupCount,
          channel,
          paymentLink,
        });

        await this.eventService.emitEvent(
          invoice.id,
          resp.emailSent ? 'email_sent' : 'email_generated',
          { subject: resp.subject, bodyPreview: resp.bodyPreview, error: resp.error, channel },
          'ai-agent',
          tenantId
        );

        if (!resp.error) {
          await this.dlqService.clearFailure(invoice.id, tenantId).catch(() => {});
        } else {
          await this.dlqService.recordFailure(invoice.id, tenantId, resp.error).catch(() => {});
        }

        results.push(resp);
      }

      return results.length === 1 ? results[0] : results;
    } catch (err: unknown) {
      await this.eventService.emitEvent(
        invoice.id,
        'halted',
        { error: String(err) },
        'system',
        tenantId
      );
      await this.dlqService.recordFailure(invoice.id, tenantId, String(err)).catch(() => {});
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
