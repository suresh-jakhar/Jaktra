import { AgentRepository } from '../repositories/agent.repository.js';
import { AimlService } from './aiml.service.js';
import { InvoiceRepository } from '../repositories/invoice.repository.js';
import { TriageService } from './triage.service.js';
import { EventService } from './event.service.js';
import { DlqService } from './dlq.service.js';

export class AgentService {
  constructor(
    private agentRepo: AgentRepository,
    private aimlService: AimlService,
    private invoiceRepo: InvoiceRepository,
    private triageService: TriageService,
    private eventService: EventService,
    private dlqService: DlqService,
  ) {}

  async triggerRun(tenantId: string, dryRun = false) {
    // 1. Find actionable invoices
    const invoices = await this.invoiceRepo.findByTenant(tenantId);
    const triaged = this.triageService.triageInvoices(invoices);
    const invoiceIds = triaged.invoices.map((inv) => inv.id);

    // 2. Create the run record
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

    // 3. Delegate to AI-ML batch run if we want, or process here.
    // The A14 spec implies the backend can track the run metadata.
    // If the python service doesn't update our DB yet (Phase C is later),
    // we orchestrate it here using the single invoice endpoint to ensure
    // we get synchronous results and can update the DB.
    let processed = 0;
    let emailsSent = 0;
    let errorsCount = 0;

    for (const inv of triaged.invoices) {
      try {
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
        });

        processed++;
        if (resp.emailSent) emailsSent++;
        if (resp.error) errorsCount++;

        // Log event
        await this.eventService.emitEvent(
          inv.id,
          resp.emailSent ? 'email_sent' : 'email_generated',
          { subject: resp.subject, bodyPreview: resp.bodyPreview, error: resp.error, runId: run.id },
          'ai-agent'
        );

        // Clear any previous DLQ entry on success
        if (!resp.error) {
          await this.dlqService.clearFailure(inv.id).catch(() => {});
        } else {
          // It's possible the AI-ML service returned a soft error
          await this.dlqService.recordFailure(inv.id, resp.error).catch(() => {});
        }
      } catch (err: any) {
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

    try {
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
      });

      await this.eventService.emitEvent(
        invoice.id,
        resp.emailSent ? 'email_sent' : 'email_generated',
        { subject: resp.subject, bodyPreview: resp.bodyPreview, error: resp.error },
        'ai-agent'
      );

      if (!resp.error) {
        await this.dlqService.clearFailure(invoice.id).catch(() => {});
      } else {
        await this.dlqService.recordFailure(invoice.id, resp.error).catch(() => {});
      }

      return resp;
    } catch (err: any) {
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

    // Could also fetch events tied to this run if needed
    return run;
  }
}
