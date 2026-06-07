import { eq, and, isNull, gte, lte, sql } from 'drizzle-orm';
import { invoices, agentRuns, communications } from '../db/index.js';
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

  async getAgentPerformance(tenantId: string, fromDate?: Date, toDate?: Date) {
    let baseConditions = and(
      eq(invoices.tenantId, tenantId),
      isNull(invoices.deletedAt),
      gte(invoices.followupCount, 1)
    );

    if (fromDate) {
      baseConditions = and(baseConditions, gte(invoices.createdAt, fromDate));
    }
    if (toDate) {
      baseConditions = and(baseConditions, lte(invoices.createdAt, toDate));
    }

    const successData = await this.db
      .select({
        totalFollowedUp: sql<number>`COUNT(*)::int`,
        paidAfterFollowUp: sql<number>`SUM(CASE WHEN ${invoices.paymentStatus} = 'Paid' THEN 1 ELSE 0 END)::int`,
        avgDaysToPayment: sql<number>`AVG(CASE WHEN ${invoices.paymentStatus} = 'Paid' THEN EXTRACT(EPOCH FROM (${invoices.updatedAt} - ${invoices.createdAt})) / 86400 ELSE NULL END)::float`
      })
      .from(invoices)
      .where(baseConditions);

    let runConditions: any = eq(agentRuns.tenantId, tenantId);
    if (fromDate) {
      runConditions = and(runConditions, gte(agentRuns.startTime, fromDate));
    }
    if (toDate) {
      runConditions = and(runConditions, lte(agentRuns.startTime, toDate));
    }
    
    const runData = await this.db
      .select({
        emailsSent: sql<number>`COALESCE(SUM(${agentRuns.emailsSent}), 0)::int`
      })
      .from(agentRuns)
      .where(runConditions);

    return {
      successData: successData[0] || { totalFollowedUp: 0, paidAfterFollowUp: 0, avgDaysToPayment: 0 },
      runData: runData[0] || { emailsSent: 0 },
    };
  }

  async getChannelBreakdown(tenantId: string, fromDate?: Date, toDate?: Date) {
    let baseConditions = and(
      eq(invoices.tenantId, tenantId),
      isNull(invoices.deletedAt)
    );
    if (fromDate) {
      baseConditions = and(baseConditions, gte(communications.sentAt, fromDate));
    }
    if (toDate) {
      baseConditions = and(baseConditions, lte(communications.sentAt, toDate));
    }

    const result = await this.db
      .select({
        channel: communications.channel,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(communications)
      .innerJoin(invoices, eq(communications.invoiceId, invoices.id))
      .where(and(baseConditions, eq(communications.status, 'sent')))
      .groupBy(communications.channel);

    return result;
  }

  async getTierEffectiveness(tenantId: string, fromDate?: Date, toDate?: Date) {
    let baseConditions = and(
      eq(invoices.tenantId, tenantId),
      isNull(invoices.deletedAt),
      eq(invoices.paymentStatus, 'Paid'),
      gte(invoices.followupCount, 1)
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
        avgDaysToPayment: sql<number>`AVG(EXTRACT(EPOCH FROM (${invoices.updatedAt} - ${invoices.createdAt})) / 86400)::float`,
      })
      .from(invoices)
      .where(baseConditions)
      .groupBy(invoices.urgencyTier);

    return result;
  }
}
