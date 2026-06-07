import { eq, and, isNull, gte, lte, sql } from 'drizzle-orm';
import { invoices } from '../db/index.js';
import type { DatabaseClient } from '../db/index.js';

export class AnalyticsRepository {
  constructor(private db: DatabaseClient) {}

  async getSummary(tenantId: string, fromDate?: Date, toDate?: Date) {
    let baseConditions = and(
      eq(invoices.tenantId, tenantId),
      isNull(invoices.deletedAt)
    );

    if (fromDate) {
      baseConditions = and(baseConditions, gte(invoices.createdAt, fromDate));
    }
    if (toDate) {
      baseConditions = and(baseConditions, lte(invoices.createdAt, toDate));
    }

    const result = await this.db
      .select({
        totalReceivable: sql<number>`COALESCE(SUM(CASE WHEN ${invoices.paymentStatus} IN ('Pending', 'Overdue') THEN ${invoices.invoiceAmount} ELSE 0 END), 0)::float`,
        totalCollected: sql<number>`COALESCE(SUM(CASE WHEN ${invoices.paymentStatus} = 'Paid' THEN ${invoices.invoiceAmount} ELSE 0 END), 0)::float`,
        totalOverdue: sql<number>`COALESCE(SUM(CASE WHEN ${invoices.paymentStatus} = 'Overdue' THEN ${invoices.invoiceAmount} ELSE 0 END), 0)::float`,
        invoiceCount: sql<number>`COUNT(*)::int`,
      })
      .from(invoices)
      .where(baseConditions);

    return result[0];
  }

  async getAgingBreakdown(tenantId: string, fromDate?: Date, toDate?: Date) {
    let baseConditions = and(
      eq(invoices.tenantId, tenantId),
      isNull(invoices.deletedAt),
      eq(invoices.paymentStatus, 'Overdue')
    );

    if (fromDate) {
      baseConditions = and(baseConditions, gte(invoices.createdAt, fromDate));
    }
    if (toDate) {
      baseConditions = and(baseConditions, lte(invoices.createdAt, toDate));
    }

    const result = await this.db
      .select({
        tier: invoices.urgencyTier,
        totalAmount: sql<number>`COALESCE(SUM(${invoices.invoiceAmount}), 0)::float`,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(invoices)
      .where(baseConditions)
      .groupBy(invoices.urgencyTier);

    return result;
  }

  async getDsoMetrics(tenantId: string, fromDate?: Date, toDate?: Date) {
    let baseConditions = and(
      eq(invoices.tenantId, tenantId),
      isNull(invoices.deletedAt)
    );

    if (fromDate) {
      baseConditions = and(baseConditions, gte(invoices.createdAt, fromDate));
    }
    if (toDate) {
      baseConditions = and(baseConditions, lte(invoices.createdAt, toDate));
    }

    const result = await this.db
      .select({
        totalCreditSales: sql<number>`COALESCE(SUM(${invoices.invoiceAmount}), 0)::float`,
        totalReceivable: sql<number>`COALESCE(SUM(CASE WHEN ${invoices.paymentStatus} IN ('Pending', 'Overdue') THEN ${invoices.invoiceAmount} ELSE 0 END), 0)::float`,
      })
      .from(invoices)
      .where(baseConditions);

    return result[0];
  }

  async getCollectionRate(tenantId: string, fromDate?: Date, toDate?: Date) {
    let baseConditions = and(
      eq(invoices.tenantId, tenantId),
      isNull(invoices.deletedAt)
    );

    if (fromDate) {
      baseConditions = and(baseConditions, gte(invoices.createdAt, fromDate));
    }
    if (toDate) {
      baseConditions = and(baseConditions, lte(invoices.createdAt, toDate));
    }

    const result = await this.db
      .select({
        totalInvoices: sql<number>`COUNT(*)::int`,
        paidInvoices: sql<number>`SUM(CASE WHEN ${invoices.paymentStatus} = 'Paid' THEN 1 ELSE 0 END)::int`,
        totalAmount: sql<number>`COALESCE(SUM(${invoices.invoiceAmount}), 0)::float`,
        paidAmount: sql<number>`COALESCE(SUM(CASE WHEN ${invoices.paymentStatus} = 'Paid' THEN ${invoices.invoiceAmount} ELSE 0 END), 0)::float`,
      })
      .from(invoices)
      .where(baseConditions);

    return result[0];
  }
}
