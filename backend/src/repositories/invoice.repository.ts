import { eq, and, isNull } from 'drizzle-orm';
import { invoices } from '../db/index.js';
import type { DatabaseClient } from '../db/index.js';
import type { Invoice, NewInvoice } from '../db/index.js';

export class InvoiceRepository {
  constructor(private db: DatabaseClient) {}

  async findByInvoiceNo(invoiceNo: string, tenantId: string): Promise<Invoice | undefined> {
    const rows = await this.db
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.invoiceNo, invoiceNo),
          eq(invoices.tenantId, tenantId),
          isNull(invoices.deletedAt),
        ),
      )
      .limit(1);

    return rows[0];
  }

  async create(data: NewInvoice): Promise<Invoice> {
    const rows = await this.db.insert(invoices).values(data).returning();
    return rows[0]!;
  }

  async createMany(data: NewInvoice[]): Promise<Invoice[]> {
    if (data.length === 0) return [];
    return this.db.insert(invoices).values(data).returning();
  }

  async upsertByInvoiceNo(data: NewInvoice): Promise<{ invoice: Invoice; wasUpdated: boolean }> {
    const existing = await this.findByInvoiceNo(data.invoiceNo, data.tenantId);

    if (existing) {
      const rows = await this.db
        .update(invoices)
        .set({
          clientName: data.clientName,
          invoiceAmount: data.invoiceAmount,
          dueDate: data.dueDate,
          contactEmail: data.contactEmail,
          paymentStatus: data.paymentStatus,
          followupCount: data.followupCount,
          lastFollowupDate: data.lastFollowupDate,
          updatedAt: new Date(),
        })
        .where(eq(invoices.id, existing.id))
        .returning();

      return { invoice: rows[0]!, wasUpdated: true };
    }

    const invoice = await this.create(data);
    return { invoice, wasUpdated: false };
  }
}
