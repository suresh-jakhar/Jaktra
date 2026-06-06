import { eq, desc, and } from 'drizzle-orm';
import { agentRuns, events, type AgentRun, type NewAgentRun } from '../db/schema.js';
import type { DatabaseClient } from '../db/index.js';

export class AgentRepository {
  constructor(private readonly db: DatabaseClient) {}

  async createRun(run: NewAgentRun): Promise<AgentRun> {
    const [created] = await this.db.insert(agentRuns).values(run).returning();
    return created;
  }

  async updateRun(id: string, tenantId: string, updates: Partial<Omit<AgentRun, 'id' | 'tenantId' | 'createdAt'>>): Promise<AgentRun | undefined> {
    const [updated] = await this.db
      .update(agentRuns)
      .set(updates)
      .where(and(eq(agentRuns.id, id), eq(agentRuns.tenantId, tenantId)))
      .returning();
    return updated;
  }

  async getRuns(tenantId: string, limit = 50, offset = 0): Promise<AgentRun[]> {
    return this.db
      .select()
      .from(agentRuns)
      .where(eq(agentRuns.tenantId, tenantId))
      .orderBy(desc(agentRuns.startTime))
      .limit(limit)
      .offset(offset);
  }

  async getRunById(id: string, tenantId: string): Promise<AgentRun | undefined> {
    const [run] = await this.db
      .select()
      .from(agentRuns)
      .where(and(eq(agentRuns.id, id), eq(agentRuns.tenantId, tenantId)));
    return run;
  }
}
