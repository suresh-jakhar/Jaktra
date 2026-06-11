import { eq, and, desc, sql } from 'drizzle-orm';
import type { DatabaseClient } from '../../db/index.js';
import { dlqEntries, invoices } from '../../db/schema.js';

export class DlqRepository {
  constructor(private readonly db: DatabaseClient) {}
  
  async recordFailure(invoiceId: string, errorMsg: string) {
    return await this.db
      .insert(dlqEntries)
      .values({
        invoiceId,
        consecutiveFailures: 1,
        lastError: errorMsg,
        firstFailure: new Date(),
        lastFailure: new Date(),
      })
      .onConflictDoUpdate({
        target: dlqEntries.invoiceId,
        set: {
          consecutiveFailures: sql`${dlqEntries.consecutiveFailures} + 1`,
          lastError: errorMsg,
          lastFailure: new Date(),
        },
      })
      .returning();
  }

  async clearFailure(invoiceId: string, tenantId: string) {
    const invoice = await this.db
      .select({ id: invoices.id })
      .from(invoices)
      .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)))
      .limit(1);

    if (invoice.length === 0) {
      throw new Error('Invoice not found or does not belong to this tenant');
    }

    return await this.db
      .delete(dlqEntries)
      .where(eq(dlqEntries.invoiceId, invoiceId))
      .returning();
  }

  async getAllEntries(tenantId: string) {
    return await this.db
      .select({
        invoiceId: dlqEntries.invoiceId,
        consecutiveFailures: dlqEntries.consecutiveFailures,
        lastError: dlqEntries.lastError,
        firstFailure: dlqEntries.firstFailure,
        lastFailure: dlqEntries.lastFailure,
        clientName: invoices.clientName,
        invoiceNo: invoices.invoiceNo,
      })
      .from(dlqEntries)
      .innerJoin(invoices, eq(dlqEntries.invoiceId, invoices.id))
      .where(eq(invoices.tenantId, tenantId))
      .orderBy(desc(dlqEntries.consecutiveFailures), desc(dlqEntries.lastFailure));
  }


  async getStats(tenantId: string) {
    const result = await this.db
      .select({
        total: sql<number>`cast(count(*) as integer)`,
        critical: sql<number>`cast(count(*) filter (where ${dlqEntries.consecutiveFailures} >= 3) as integer)`,
      })
      .from(dlqEntries)
      .innerJoin(invoices, eq(dlqEntries.invoiceId, invoices.id))
      .where(eq(invoices.tenantId, tenantId));
      
    return {
      total: Number(result[0]?.total || 0),
      critical: Number(result[0]?.critical || 0),
    };
  }
}
