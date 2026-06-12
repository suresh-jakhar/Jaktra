export interface WebhookEventPayload {
  provider: string;
  invoiceId: string;
  amount: number;
  currency: string;
  status: 'captured' | 'failed' | 'other';
  externalRefId?: string;
  rawEvent: any;
}

export interface IPaymentGateway {
  /**
   * Returns the canonical name of the provider (e.g., 'razorpay', 'stripe')
   */
  getProviderName(): string;

  /**
   * Verifies the webhook signature against the raw body buffer.
   */
  verifyWebhookSignature(rawBody: Buffer, signature: string, secret: string): boolean;

  /**
   * Parses the raw body into a normalized WebhookEventPayload.
   * Returns null if the event type is not supported or not actionable.
   */
  parseWebhookEvent(rawBody: Buffer): WebhookEventPayload | null;

  /**
   * Creates a payment link using the provider API.
   */
  createPaymentLink(
    credentials: Record<string, string>,
    invoiceId: string,
    amount: number,
    currency: string,
    description: string
  ): Promise<{ paymentUrl: string; providerPaymentLinkId: string; providerOrderId?: string }>;
}
