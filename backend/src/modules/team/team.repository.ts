import { eq, and, desc, sql, count } from 'drizzle-orm';

import type { DatabaseClient } from '../../db/index.js';
import { tenants, users, teamInvitations } from '../../db/schema.js';
import type { User, TeamInvitation, NewTeamInvitation } from '../../db/schema.js';

export class TeamRepository {
  constructor(public readonly client: DatabaseClient) {}

  async lockTenant(tenantId: string): Promise<void> {
    await this.client.execute(
      sql`SELECT 1 FROM ${tenants} WHERE id = ${tenantId} FOR UPDATE`
    );
  }

  async listActiveMembers(tenantId: string): Promise<User[]> {
    return this.client
      .select()
      .from(users)
      .where(eq(users.tenantId, tenantId))
      .orderBy(desc(users.createdAt));
  }

  async listPendingInvitations(tenantId: string): Promise<TeamInvitation[]> {
    return this.client
      .select()
      .from(teamInvitations)
      .where(
        and(
          eq(teamInvitations.tenantId, tenantId),
          sql`${teamInvitations.acceptedAt} IS NULL`,
          sql`${teamInvitations.revokedAt} IS NULL`
        )
      )
      .orderBy(desc(teamInvitations.createdAt));
  }

  async createInvitation(invitation: NewTeamInvitation): Promise<TeamInvitation> {
    const [result] = await this.client
      .insert(teamInvitations)
      .values(invitation)
      .returning();
    return result;
  }

  async findActiveInvitationByEmail(tenantId: string, email: string): Promise<TeamInvitation | undefined> {
    const [result] = await this.client
      .select()
      .from(teamInvitations)
      .where(
        and(
          eq(teamInvitations.tenantId, tenantId),
          sql`lower(trim(${teamInvitations.email})) = lower(trim(${email}))`,
          sql`${teamInvitations.acceptedAt} IS NULL`,
          sql`${teamInvitations.revokedAt} IS NULL`
        )
      )
      .limit(1);
    return result;
  }

  async findInvitationByTokenHash(tokenHash: string, forUpdate = false): Promise<TeamInvitation | undefined> {
    let query = this.client
      .select()
      .from(teamInvitations)
      .where(eq(teamInvitations.tokenHash, tokenHash))
      .limit(1);
    
    if (forUpdate) {
      // @ts-ignore
      query = query.for('update');
    }

    const [result] = await query;
    return result;
  }

  async findInvitationById(tenantId: string, id: string, forUpdate = false): Promise<TeamInvitation | undefined> {
    let query = this.client
      .select()
      .from(teamInvitations)
      .where(
        and(
          eq(teamInvitations.id, id),
          eq(teamInvitations.tenantId, tenantId)
        )
      )
      .limit(1);

    if (forUpdate) {
      // @ts-ignore
      query = query.for('update');
    }

    const [result] = await query;
    return result;
  }

  async updateInvitationDeliveryStatus(
    id: string,
    status: 'pending' | 'sent' | 'failed',
    error?: string
  ): Promise<void> {
    await this.client
      .update(teamInvitations)
      .set({
        deliveryStatus: status,
        deliveryError: error ?? null,
        lastSentAt: status === 'sent' ? new Date() : undefined,
      })
      .where(eq(teamInvitations.id, id));
  }

  async revokeInvitation(tenantId: string, id: string): Promise<void> {
    await this.client
      .update(teamInvitations)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(teamInvitations.id, id),
          eq(teamInvitations.tenantId, tenantId),
          sql`${teamInvitations.acceptedAt} IS NULL`,
          sql`${teamInvitations.revokedAt} IS NULL`
        )
      );
  }

  async countAdmins(tenantId: string): Promise<number> {
    const [result] = await this.client
      .select({ count: count() })
      .from(users)
      .where(
        and(
          eq(users.tenantId, tenantId),
          eq(users.role, 'admin')
        )
      );
    return Number(result.count);
  }

  async removeUser(tenantId: string, userId: string): Promise<void> {
    await this.client
      .delete(users)
      .where(
        and(
          eq(users.tenantId, tenantId),
          eq(users.id, userId)
        )
      );
  }

  async updateUserRole(tenantId: string, userId: string, role: 'admin' | 'manager' | 'viewer'): Promise<void> {
    await this.client
      .update(users)
      .set({ role })
      .where(
        and(
          eq(users.tenantId, tenantId),
          eq(users.id, userId)
        )
      );
  }

  async acceptInvitation(id: string): Promise<void> {
    await this.client
      .update(teamInvitations)
      .set({ acceptedAt: new Date() })
      .where(eq(teamInvitations.id, id));
  }
}
