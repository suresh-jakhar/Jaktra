import { z } from 'zod';
import type { TenantSettings } from '../db/schema.js';
import type { SettingsRepository } from '../repositories/settings.repository.js';

export const updateSettingsSchema = z.object({
  companyName: z.string().optional(),
  senderName: z.string().optional(),
  senderEmail: z.string().email().optional(),
  replyTo: z.string().email().optional().nullable(),
  paymentLink: z.string().url().optional().nullable(),
  bankDetails: z.string().optional().nullable(),
  timezone: z.string().optional(),
  scheduleHour: z.number().min(0).max(23).optional(),
  dryRun: z.boolean().optional(),
  idempotencyWindowHours: z.number().min(0).optional(),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

export class SettingsService {
  constructor(private settingsRepo: SettingsRepository) {}

  async getSettings(tenantId: string): Promise<TenantSettings | null> {
    return this.settingsRepo.getSettings(tenantId);
  }

  async updateSettings(
    tenantId: string,
    data: UpdateSettingsInput
  ): Promise<TenantSettings> {
    const updated = await this.settingsRepo.updateSettings(tenantId, data);
    if (!updated) {
      throw new Error('Settings not found for this tenant');
    }
    return updated;
  }

  async getIntegrations(_tenantId: string): Promise<Array<{ id: string; name: string; category: string; status: string; description: string }>> {
    // Stub for now
    return [
      {
        id: 'sendgrid',
        name: 'SendGrid',
        category: 'email',
        status: 'not_configured',
        description: 'Send emails via SendGrid API',
      },
      {
        id: 'stripe',
        name: 'Stripe',
        category: 'payment',
        status: 'not_configured',
        description: 'Accept payments via Stripe',
      },
    ];
  }
}
