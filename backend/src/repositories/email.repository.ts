import { eq } from 'drizzle-orm';
import type { DatabaseClient } from '../db/index.js';
import { tenantSettings, type TenantSettings, type NewTenantSettings } from '../db/schema.js';

export class EmailRepository {
  constructor(private readonly db: DatabaseClient) {}

  async getSettings(tenantId: string): Promise<TenantSettings | undefined> {
    const [settings] = await this.db
      .select()
      .from(tenantSettings)
      .where(eq(tenantSettings.tenantId, tenantId));
    return settings;
  }

  async upsertSettings(tenantId: string, settings: Omit<NewTenantSettings, 'tenantId' | 'updatedAt'>): Promise<TenantSettings> {
    const [upserted] = await this.db
      .insert(tenantSettings)
      .values({
        tenantId,
        ...settings,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: tenantSettings.tenantId,
        set: {
          ...settings,
          updatedAt: new Date(),
        },
      })
      .returning();
    return upserted;
  }
}
