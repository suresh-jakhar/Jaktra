import { AgentRepository } from './agent.repository.js';
import { AimlService } from './aiml.service.js';
import { InvoiceRepository } from '../invoice/invoice.repository.js';
import { TriageService } from './triage.service.js';
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
    const invoiceIds = triaged.invoices.map((inv) => inv.id);
    const run = await this.agentRepo.createRun({
      tenantId,
      status: 'running',
    });

    if (invoiceIds.length === 0) {
      return await this.agentRepo.updateRun(run.id, tenantId, {
        status: 'completed',
        endTime: new Date(),
        invoicesProcessed: 0,
        emailsSent: 0,
        errors: 0,
      });
    }
    let processed = 0;
    let emailsSent = 0;
    let errorsCount = 0;

    for (const inv of triaged.invoices) {
      try {
        const idempotencyCheck = await this.idempotencyService.checkInvoice(tenantId, inv.id);
        if (idempotencyCheck.skipped) {
          await this.eventService.emitEvent(
            inv.id,
            'halted',
            { reason: 'idempotency_skip', ...idempotencyCheck, runId: run.id },
            'system'
          );
          continue;
        }

        let paymentLink = undefined;
        try {
          paymentLink = await this.paymentService.getOrGeneratePaymentLink(tenantId, inv.id, 'razorpay');
        } catch (e: any) {
          logger.warn(`Could not generate payment link for invoice ${inv.id} - ${e.message}`);
        }

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
          paymentLink,
        });

        processed++;
        if (resp.emailSent) emailsSent++;
        if (resp.error) errorsCount++;

        await this.eventService.emitEvent(
          inv.id,
          resp.emailSent ? 'email_sent' : 'email_generated',
          { subject: resp.subject, bodyPreview: resp.bodyPreview, error: resp.error, runId: run.id },
          'ai-agent'
        );

        if (!resp.error) {
          await this.dlqService.clearFailure(inv.id, tenantId).catch(() => {});
        } else {
          await this.dlqService.recordFailure(inv.id, resp.error).catch(() => {});
        }
      } catch (err: unknown) {
        errorsCount++;
        await this.eventService.emitEvent(
          inv.id,
          'halted',
          { error: String(err), runId: run.id },
          'system'
        );
        await this.dlqService.recordFailure(inv.id, String(err)).catch(() => {});
      }
    }

    return await this.agentRepo.updateRun(run.id, tenantId, {
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

    const idempotencyCheck = await this.idempotencyService.checkInvoice(tenantId, invoice.id);
    if (idempotencyCheck.skipped) {
      await this.eventService.emitEvent(
        invoice.id,
        'halted',
        { reason: 'idempotency_skip', ...idempotencyCheck },
        'system'
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
        paymentLink,
      });

      await this.eventService.emitEvent(
        invoice.id,
        resp.emailSent ? 'email_sent' : 'email_generated',
        { subject: resp.subject, bodyPreview: resp.bodyPreview, error: resp.error },
        'ai-agent'
      );

      if (!resp.error) {
        await this.dlqService.clearFailure(invoice.id, tenantId).catch(() => {});
      } else {
        await this.dlqService.recordFailure(invoice.id, resp.error).catch(() => {});
      }

      return resp;
    } catch (err: unknown) {
      await this.eventService.emitEvent(
        invoice.id,
        'halted',
        { error: String(err) },
        'system'
      );
      await this.dlqService.recordFailure(invoice.id, String(err)).catch(() => {});
      throw err;
    }
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
