import type { EventRepository } from '../repositories/event.repository.js';
import type { InvoiceRepository } from '../repositories/invoice.repository.js';
import type { Event } from '../db/index.js';

export const EVENT_TYPES = [
  'created',
  'triage_assigned',
  'email_generated',
  'email_sent',
  'email_opened',
  'status_changed',
  'payment_received',
  'escalated',
  'halted',
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export class EventService {
  constructor(
    private eventRepo: EventRepository,
    private invoiceRepo: InvoiceRepository,
  ) {}

  async emitEvent(
    invoiceId: string,
    eventType: EventType,
    payload?: Record<string, unknown>,
    actor: string = 'system',
  ): Promise<Event> {
    return this.eventRepo.create({
      invoiceId,
      eventType,
      payload: payload ?? null,
      actor,
    });
  }

  async listByInvoice(invoiceId: string, tenantId: string): Promise<Event[]> {
    const invoice = await this.invoiceRepo.findById(invoiceId);
    if (!invoice || invoice.tenantId !== tenantId) {
      throw new EventError('Invoice not found', 404);
    }
    return this.eventRepo.findByInvoiceId(invoiceId);
  }
}

export class EventError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'EventError';
  }
}
