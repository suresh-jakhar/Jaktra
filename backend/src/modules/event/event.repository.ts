import { eq, asc, sql } from 'drizzle-orm';
import { events } from '../../db/index.js';
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

  async create(data: NewEvent): Promise<Event> {
    const rows = await this.db.insert(events).values(data).returning();
    return rows[0]!;
  }
}
