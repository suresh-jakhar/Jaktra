import { eq } from 'drizzle-orm';
import type { DatabaseClient } from '../db/index.js';
import { tenantSettings, type TenantSettings } from '../db/schema.js';
import type { UpdateSettingsInput } from '../services/settings.service.js';

export class SettingsRepository {
  constructor(private db: DatabaseClient) {}

  async getSettings(tenantId: string): Promise<TenantSettings | null> {
    const settings = await this.db.query.tenantSettings.findFirst({
      where: eq(tenantSettings.tenantId, tenantId),
    });

    return settings || null;
  }

  async updateSettings(tenantId: string, data: UpdateSettingsInput): Promise<TenantSettings> {
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
}
