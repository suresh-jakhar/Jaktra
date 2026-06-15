import { CommunicationRepository } from '../communication.repository.js';

export interface IdempotencyCheckResult {
  skipped: boolean;
  reason?: string;
  lastSentAt?: Date;
}

export class IdempotencyService {
  constructor(
    private readonly communicationRepo: CommunicationRepository
  ) {}

  async checkInvoice(tenantId: string, invoiceId: string): Promise<IdempotencyCheckResult> {
    const settings = await this.communicationRepo.getSettings(tenantId);
    // Use the tenant's configured window, default to 20 hours
    const windowHours = settings?.idempotencyWindowHours ?? 20;

    // FIX: Only consider successfully sent communications
    const lastSent = await this.communicationRepo.findLastSuccessfulByInvoiceId(invoiceId);

    if (!lastSent) {
      return { skipped: false };
    }

    const now = new Date();
    const lastSentAt = new Date(lastSent.sentAt ?? lastSent.createdAt);
    const hoursSinceLastSent = (now.getTime() - lastSentAt.getTime()) / (1000 * 60 * 60);

    if (hoursSinceLastSent < windowHours) {
      return {
        skipped: true,
        reason: `sent ${Math.round(hoursSinceLastSent * 10) / 10}h ago`,
        lastSentAt,
      };
    }

    return { skipped: false };
  }
}
