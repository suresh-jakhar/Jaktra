import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';
import type { DatabaseClient } from '../../db/index.js';
import { tenantSettings, tenants, users, type TenantSettings } from '../../db/schema.js';

export class SettingsRepository {
  constructor(private db: DatabaseClient) {}

  async getSettings(tenantId: string): Promise<TenantSettings | null> {
    const settings = await this.db.query.tenantSettings.findFirst({
      where: eq(tenantSettings.tenantId, tenantId),
    });

    return settings || null;
  }

  async findByWebhookToken(webhookToken: string): Promise<TenantSettings | null> {
    const settings = await this.db.query.tenantSettings.findFirst({
      where: eq(tenantSettings.webhookToken, webhookToken),
    });
    return settings || null;
  }

  async rotateWebhookToken(tenantId: string): Promise<TenantSettings> {
    const newToken = crypto.randomBytes(32).toString('hex');
    const [updated] = await this.db
      .update(tenantSettings)
      .set({
        webhookToken: newToken,
        updatedAt: new Date(),
      })
      .where(eq(tenantSettings.tenantId, tenantId))
      .returning();
    return updated;
  }

  async updateSettings(tenantId: string, data: Partial<Omit<TenantSettings, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>>): Promise<TenantSettings> {
    const [updated] = await this.db
      .update(tenantSettings)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(tenantSettings.tenantId, tenantId))
      .returning();

    return updated || null;
  }

  async createDefaultSettings(tenantId: string): Promise<TenantSettings> {
    const tenant = await this.db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId),
    });
    
    const adminUser = await this.db.query.users.findFirst({
      where: and(eq(users.tenantId, tenantId), eq(users.role, 'admin')),
    });

    const [newSettings] = await this.db
      .insert(tenantSettings)
      .values({
        tenantId,
        companyName: tenant?.name || 'Company',
        senderName: adminUser?.name || 'Finance Team',
        senderEmail: adminUser?.email || 'billing@example.com',
      })
      .returning();

    return newSettings;
  }
}
