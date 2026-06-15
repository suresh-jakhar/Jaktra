import { eq, asc, desc, sql } from 'drizzle-orm';
import { events, invoices } from '../../db/index.js';
import type { DatabaseClient } from '../../db/index.js';
import type { Event, NewEvent } from '../../db/index.js';

export class EventRepository {
  constructor(private db: DatabaseClient) {}

  async findByInvoiceId(invoiceId: string): Promise<Event[]> {
    return this.db
      .select()
      .from(events)
      .where(eq(events.invoiceId, invoiceId))
      .orderBy(asc(events.createdAt));
  }

  async findByRunId(runId: string): Promise<Event[]> {
    return this.db
      .select()
      .from(events)
      .where(sql`${events.payload}->>'runId' = ${runId}`)
      .orderBy(asc(events.createdAt));
  }

  async getTenantFeed(tenantId: string, limit: number = 50) {
    const rows = await this.db
      .select({
        event: events,
        invoiceNo: invoices.invoiceNo,
      })
      .from(events)
      .innerJoin(invoices, eq(events.invoiceId, invoices.id))
      .where(eq(events.tenantId, tenantId))
      .orderBy(desc(events.createdAt))
      .limit(limit);

    return rows.map((row) => ({
      ...row.event,
      invoiceNo: row.invoiceNo,
    }));
  }

  async create(data: NewEvent): Promise<Event> {
    const rows = await this.db.insert(events).values(data).returning();
    return rows[0]!;
  }
}
