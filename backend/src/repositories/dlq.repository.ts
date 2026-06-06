import { eq, desc, sql } from 'drizzle-orm';
import type { DatabaseClient } from '../db/index.js';
import { dlqEntries } from '../db/schema.js';

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


  async clearFailure(invoiceId: string) {
    return await this.db
      .delete(dlqEntries)
      .where(eq(dlqEntries.invoiceId, invoiceId))
      .returning();
  }


  async getAllEntries() {
    return await this.db
      .select()
      .from(dlqEntries)
      .orderBy(desc(dlqEntries.consecutiveFailures), desc(dlqEntries.lastFailure));
  }


  async getStats() {
    const result = await this.db
      .select({
        total: sql<number>`cast(count(*) as integer)`,
        critical: sql<number>`cast(count(*) filter (where ${dlqEntries.consecutiveFailures} >= 3) as integer)`,
      })
      .from(dlqEntries);
      
    return {
      total: Number(result[0]?.total || 0),
      critical: Number(result[0]?.critical || 0),
    };
  }
}
