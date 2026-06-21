import { eq, and, isNull, desc, asc, ilike, inArray, count, lte, gte } from 'drizzle-orm';
import { invoices } from '../../db/index.js';
import type { DatabaseClient } from '../../db/index.js';
import type { Invoice, NewInvoice } from '../../db/index.js';
import type { UrgencyTier } from '../agent/triage.service.js';

export class InvoiceRepository {
  constructor(private db: DatabaseClient) {}

  async findByTenant(tenantId: string): Promise<Invoice[]> {
    return this.db
      .select()
      .from(invoices)
      .where(and(eq(invoices.tenantId, tenantId), isNull(invoices.deletedAt)));
  }

  async countByTenant(tenantId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: count() })
      .from(invoices)
      .where(and(eq(invoices.tenantId, tenantId), isNull(invoices.deletedAt)));
    return Number(row?.count || 0);
  }

  async findById(invoiceId: string): Promise<Invoice | undefined> {
    const rows = await this.db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, invoiceId), isNull(invoices.deletedAt)))
      .limit(1);
    return rows[0];
  }

  async updateUrgencyTier(invoiceId: string, tier: UrgencyTier): Promise<void> {
    await this.db
      .update(invoices)
      .set({ urgencyTier: tier, updatedAt: new Date() })
      .where(eq(invoices.id, invoiceId));
  }

  async updateFollowupCount(invoiceId: string, count: number): Promise<void> {
    await this.db
      .update(invoices)
      .set({ followupCount: count, updatedAt: new Date() })
      .where(eq(invoices.id, invoiceId));
  }

  async updatePaymentStatus(invoiceId: string, status: 'Pending' | 'Paid' | 'Overdue' | 'Written Off', externalRefId?: string): Promise<void> {
    const updateData: any = { paymentStatus: status, updatedAt: new Date() };
    if (externalRefId) {
      updateData.externalRefId = externalRefId;
    }
    
    await this.db
      .update(invoices)
      .set(updateData)
      .where(eq(invoices.id, invoiceId));
  }

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

  async findMany(params: {
    tenantId: string;
    page: number;
    limit: number;
    sortBy: 'dueDate' | 'invoiceAmount' | 'createdAt' | 'clientName' | 'invoiceNo';
    sortOrder: 'asc' | 'desc';
    status?: string[];
    urgencyTier?: string[];
    clientName?: string;
    daysOverdueMin?: number;
    daysOverdueMax?: number;
  }): Promise<{ data: Invoice[]; total: number }> {
    const conditions = [
      eq(invoices.tenantId, params.tenantId),
      isNull(invoices.deletedAt),
    ];

    if (params.status && params.status.length > 0) {
      conditions.push(inArray(invoices.paymentStatus, params.status as any[]));
    }
    if (params.urgencyTier && params.urgencyTier.length > 0) {
      conditions.push(inArray(invoices.urgencyTier, params.urgencyTier as any[]));
    }
    if (params.clientName) {
      conditions.push(ilike(invoices.clientName, `%${params.clientName}%`));
    }
    
    // days_overdue = today - due_date
    // so due_date <= today - daysOverdueMin
    // due_date >= today - daysOverdueMax
    if (params.daysOverdueMin !== undefined) {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() - params.daysOverdueMin);
      conditions.push(lte(invoices.dueDate, targetDate.toISOString().split('T')[0] as string));
    }
    if (params.daysOverdueMax !== undefined) {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() - params.daysOverdueMax);
      conditions.push(gte(invoices.dueDate, targetDate.toISOString().split('T')[0] as string));
    }

    const whereClause = and(...conditions);

    const [totalRow] = await this.db
      .select({ count: count() })
      .from(invoices)
      .where(whereClause);

    const data = await this.db
      .select()
      .from(invoices)
      .where(whereClause)
      .orderBy(
        params.sortOrder === 'asc'
          ? asc(invoices[params.sortBy])
          : desc(invoices[params.sortBy])
      )
      .limit(params.limit)
      .offset((params.page - 1) * params.limit);

    return {
      data,
      total: Number(totalRow?.count || 0),
    };
  }

  async update(invoiceId: string, tenantId: string, data: Partial<NewInvoice>): Promise<Invoice | undefined> {
    const rows = await this.db
      .update(invoices)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)))
      .returning();
    return rows[0];
  }

  async softDelete(invoiceId: string, tenantId: string): Promise<boolean> {
    const rows = await this.db
      .update(invoices)
      .set({ deletedAt: new Date() })
      .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)))
      .returning();
    return rows.length > 0;
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
          subject: data.subject ?? null,
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
