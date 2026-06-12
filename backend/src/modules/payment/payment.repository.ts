import type { DatabaseClient } from '../../db/index.js';
import { paymentWebhookEvents, invoicePaymentLinks, invoices } from '../../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';

export class PaymentRepository {
  constructor(private db: DatabaseClient) {}
  async insertWebhookEvent(event: Partial<typeof paymentWebhookEvents.$inferInsert>) {
    const [result] = await this.db.insert(paymentWebhookEvents)
      .values(event as any)
      .onConflictDoUpdate({
        target: [paymentWebhookEvents.tenantId, paymentWebhookEvents.provider, paymentWebhookEvents.externalEventId],
        set: { 
          status: 'pending',
          rawPayload: event.rawPayload,
          receivedAt: new Date()
        }
      })
      .returning();
    return result;
  }

  async updateWebhookEventStatus(eventId: string, status: 'processed' | 'ignored' | 'error') {
    await this.db.update(paymentWebhookEvents)
      .set({ status, processedAt: new Date() })
      .where(eq(paymentWebhookEvents.externalEventId, eventId));
  }

  async getActivePaymentLink(tenantId: string, invoiceId: string, provider: string) {
    const results = await this.db.select()
      .from(invoicePaymentLinks)
      .where(and(
        eq(invoicePaymentLinks.tenantId, tenantId),
        eq(invoicePaymentLinks.invoiceId, invoiceId),
        eq(invoicePaymentLinks.provider, provider as any),
        eq(invoicePaymentLinks.status, 'active')
      ))
      .limit(1);
    return results[0] || null;
  }

  async getActivePaymentLinkByProviderId(tenantId: string, providerPaymentLinkId: string, provider: string) {
    const results = await this.db.select()
      .from(invoicePaymentLinks)
      .where(and(
        eq(invoicePaymentLinks.tenantId, tenantId),
        eq(invoicePaymentLinks.providerPaymentLinkId, providerPaymentLinkId),
        eq(invoicePaymentLinks.provider, provider as any),
        eq(invoicePaymentLinks.status, 'active')
      ))
      .limit(1);
    return results[0] || null;
  }

  async getLatestPaymentLink(invoiceId: string, tenantId: string) {
    const results = await this.db.select()
      .from(invoicePaymentLinks)
      .where(and(
        eq(invoicePaymentLinks.invoiceId, invoiceId),
        eq(invoicePaymentLinks.tenantId, tenantId)
      ))
      .orderBy(desc(invoicePaymentLinks.createdAt))
      .limit(1);
    return results[0] || null;
  }

  async insertPaymentLink(link: typeof invoicePaymentLinks.$inferInsert) {
    const [result] = await this.db.insert(invoicePaymentLinks).values(link).returning();
    return result;
  }

  async updatePaymentLinkStatus(id: string, status: 'active' | 'paid' | 'expired' | 'cancelled') {
    const [result] = await this.db.update(invoicePaymentLinks)
      .set({ status, updatedAt: new Date() })
      .where(eq(invoicePaymentLinks.id, id))
      .returning();
    return result;
  }

  async cancelActiveLinks(tenantId: string, invoiceId: string) {
    await this.db.update(invoicePaymentLinks)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(and(
        eq(invoicePaymentLinks.tenantId, tenantId),
        eq(invoicePaymentLinks.invoiceId, invoiceId),
        eq(invoicePaymentLinks.status, 'active')
      ));
  }

  async resolveSuccessfulPayment(tenantId: string, invoiceId: string, activeLinkId: string | undefined, eventId: string) {
    return await this.db.transaction(async (tx) => {
      const existingInvoice = await tx.select()
        .from(invoices)
        .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)))
        .for('update')
        .limit(1);

      if (!existingInvoice.length || existingInvoice[0].paymentStatus === 'Paid') {
        await tx.update(paymentWebhookEvents)
          .set({ status: 'ignored', processedAt: new Date() })
          .where(and(eq(paymentWebhookEvents.externalEventId, eventId), eq(paymentWebhookEvents.tenantId, tenantId)));
        return { status: 'ignored' };
      }

      await tx.update(invoices)
        .set({ paymentStatus: 'Paid', updatedAt: new Date() })
        .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)));
      
      if (activeLinkId) {
        await tx.update(invoicePaymentLinks)
          .set({ status: 'paid', updatedAt: new Date() })
          .where(and(eq(invoicePaymentLinks.id, activeLinkId), eq(invoicePaymentLinks.tenantId, tenantId)));
      }
      
      await tx.update(paymentWebhookEvents)
        .set({ status: 'processed', processedAt: new Date() })
        .where(and(eq(paymentWebhookEvents.externalEventId, eventId), eq(paymentWebhookEvents.tenantId, tenantId)));
        
      return { status: 'processed' };
    });
  }
}
