import crypto from 'crypto';
import { PaymentRepository } from './payment.repository.js';
import type { InvoiceRepository } from '../invoice/invoice.repository.js';
import { PaymentGatewayFactory } from './gateway.factory.js';
import { IntegrationService } from '../settings/integration.service.js';
import { logger } from '../../shared/logger.js';
import type { SettingsRepository } from '../settings/settings.repository.js';
import type { EventRepository } from '../event/event.repository.js';

export class PaymentService {
  constructor(
    private readonly repo: PaymentRepository,
    private readonly invoiceRepo: InvoiceRepository,
    private readonly integrationService: IntegrationService,
    private readonly gatewayFactory: PaymentGatewayFactory,
    private readonly settingsRepo: SettingsRepository,
    private readonly eventRepo: EventRepository
  ) {}

  async getOrGeneratePaymentLink(tenantId: string, invoiceId: string, provider: 'razorpay') {
    try {
      const existingLink = await this.repo.getActivePaymentLink(tenantId, invoiceId, provider);
      if (existingLink) {
        return existingLink.paymentUrl;
      }
      const invoice = await this.invoiceRepo.findById(invoiceId);
      if (!invoice) throw new Error('Invoice not found');
      if (invoice.tenantId !== tenantId) throw new Error('Invoice not found');

      const credentials = await this.integrationService.getDecryptedRazorpayConfig(tenantId);

      const adapter = this.gatewayFactory.getAdapter(provider);
      if (!adapter) throw new Error(`Provider ${provider} not registered`);

      let linkData;
      try {
        linkData = await adapter.createPaymentLink(
          credentials,
          invoiceId,
          Number(invoice.invoiceAmount),
          invoice.currency,
          `Payment for Invoice ${invoice.invoiceNo}`
        );
      } catch (adapterError) {
        logger.error('Provider failed to generate payment link, attempting fallback', { error: adapterError, tenantId, invoiceId });
        const settings = await this.settingsRepo.getSettings(tenantId);
        if (settings?.paymentLink) {
          try {
            await this.repo.insertPaymentLink({
              tenantId,
              invoiceId,
              provider,
              providerPaymentLinkId: 'fallback-' + crypto.randomUUID(),
              providerOrderId: null,
              paymentUrl: settings.paymentLink,
              amount: String(invoice.invoiceAmount),
              currency: invoice.currency,
            });
          } catch (e: any) {
            if (e.code !== '23505') logger.error('Failed to save fallback link', { error: e });
          }
          return settings.paymentLink;
        }
        throw adapterError;
      }

      try {
        const newLink = await this.repo.insertPaymentLink({
          tenantId,
          invoiceId,
          provider,
          providerPaymentLinkId: linkData.providerPaymentLinkId,
          providerOrderId: linkData.providerOrderId,
          paymentUrl: linkData.paymentUrl,
          amount: String(invoice.invoiceAmount),
          currency: invoice.currency,
        });
        return newLink.paymentUrl;
      } catch (err: any) {
        if (err.code === '23505') {
          logger.warn(`Concurrent link generation for invoice ${invoiceId}. Re-fetching active link.`);
          const activeLink = await this.repo.getActivePaymentLink(tenantId, invoiceId, provider);
          if (activeLink) return activeLink.paymentUrl;
        }
        throw err;
      }
    } catch (error) {
      logger.error('Failed to get or generate payment link', { error, tenantId, invoiceId });
      throw error;
    }
  }

  async getLatestPaymentLink(invoiceId: string, tenantId: string) {
    return this.repo.getLatestPaymentLink(invoiceId, tenantId);
  }

  async cancelActivePaymentLinks(tenantId: string, invoiceId: string) {
    await this.repo.cancelActiveLinks(tenantId, invoiceId);
  }

  async processPaymentCaptured(tenantId: string, provider: 'razorpay', payload: any, rawBody: Buffer, signature: string) {
    const adapter = this.gatewayFactory.getAdapter(provider);
    if (!adapter) throw new Error(`Provider ${provider} not registered`);

    const credentials = await this.integrationService.getDecryptedRazorpayConfig(tenantId);
    const isValid = adapter.verifyWebhookSignature(rawBody, signature, credentials.webhookSecret);
    if (!isValid) {
      logger.error(`Webhook signature validation failed for tenant ${tenantId}`);
      throw new Error('Invalid signature');
    }

    const parsedEvent = adapter.parseWebhookEvent(rawBody);
    if (!parsedEvent) {
      const payloadHash = crypto.createHash('sha256').update(rawBody).digest('hex');
      const externalEventId = payload?.event_id || payload?.['x-razorpay-event-id'] || `hash-${payloadHash}`;
      if (externalEventId !== 'unknown') {
        try {
          const sanitizedPayload = { ...payload };
          if (sanitizedPayload.payload?.payment?.entity) {
            delete sanitizedPayload.payload.payment.entity.email;
            delete sanitizedPayload.payload.payment.entity.contact;
          }

          await this.repo.insertWebhookEvent({
            tenantId,
            provider,
            externalEventId,
            status: 'ignored',
            rawPayload: sanitizedPayload,
          });
        } catch (e: any) {
          if (e.code === '23505') return { status: 'ignored' };
        }
      }
      return { status: 'ignored' };
    }

    const { invoiceId, amount, currency, externalRefId, status } = parsedEvent;

    const payloadHash = crypto.createHash('sha256').update(rawBody).digest('hex');
    const finalEventId = payload?.event_id || `${provider}-${externalRefId}-${status}-${payloadHash}`;

    let resolvedInvoiceId = invoiceId;
    if (!resolvedInvoiceId) {
      const plinkId = payload?.payment?.entity?.payment_link_id || payload?.payment_link?.entity?.id;
      if (plinkId) {
        const linkRecord = await this.repo.getActivePaymentLinkByProviderId(tenantId, plinkId, provider);
        if (linkRecord) {
          resolvedInvoiceId = linkRecord.invoiceId;
        }
      }
    }

    const sanitizedPayload = { ...payload };
    if (sanitizedPayload.payload?.payment?.entity) {
      delete sanitizedPayload.payload.payment.entity.email;
      delete sanitizedPayload.payload.payment.entity.contact;
    }

      await this.repo.insertWebhookEvent({
        tenantId,
        provider,
        externalEventId: finalEventId,
        paymentId: externalRefId,
        invoiceId: resolvedInvoiceId,
        status: 'pending',
        rawPayload: sanitizedPayload,
      });

    let invoice = null;
    if (resolvedInvoiceId) {
      invoice = await this.invoiceRepo.findById(resolvedInvoiceId);
    }

    let validationError = null;
    let expectedAmount = 0;
    if (invoice) {
      const numAmount = Number(invoice.invoiceAmount);
      const zeroDecimalCurrencies = ['JPY', 'KRW', 'VND', 'CLP', 'PYG', 'BIF', 'DJF', 'GNF', 'KMF', 'RWF', 'UGX', 'VUV', 'XAF', 'XOF', 'XPF'];
      const isZeroDecimal = zeroDecimalCurrencies.includes(invoice.currency.toUpperCase());
      expectedAmount = isZeroDecimal ? Math.round(numAmount) : Math.round(numAmount * 100);
    }

    if (!invoice) {
      validationError = 'Invoice not found';
    } else if (invoice.tenantId !== tenantId) {
      validationError = 'Tenant mismatch';
    } else if (expectedAmount !== amount) {
      validationError = 'Amount mismatch';
    } else if (invoice.currency.toUpperCase() !== currency.toUpperCase()) {
      validationError = 'Currency mismatch';
    } else if (invoice.paymentStatus === 'Paid') {
      await this.repo.updateWebhookEventStatus(finalEventId, 'ignored');
      return { status: 'ignored' };
    }

    if (validationError) {
      logger.error(`Webhook validation failed: ${validationError} for event ${finalEventId}`);
      await this.repo.updateWebhookEventStatus(finalEventId, 'error');
      
      if (invoice) {
        try {
          await this.eventRepo.create({
            invoiceId: invoice.id,
            eventType: 'payment_webhook_failed',
            actor: 'system',
            payload: {
              reason: validationError,
              provider,
              receivedAmount: amount,
              expectedAmount,
              receivedCurrency: currency,
              expectedCurrency: invoice.currency
            }
          });
        } catch (eventError) {
          logger.error('Failed to log payment webhook failure event', { eventError, invoiceId });
        }
      }

      return { status: 'error', message: validationError };
    }

    if (status === 'failed') {
      logger.info(`Payment failed for invoice ${resolvedInvoiceId} (ref: ${externalRefId})`);
      await this.repo.updateWebhookEventStatus(finalEventId, 'processed');
      return { status: 'processed' };
    }

    const activeLink = resolvedInvoiceId ? await this.repo.getActivePaymentLink(tenantId, resolvedInvoiceId, provider) : null;
    const result = await this.repo.resolveSuccessfulPayment(tenantId, resolvedInvoiceId!, activeLink?.id, finalEventId);

    return result || { status: 'processed' };
  }
}
