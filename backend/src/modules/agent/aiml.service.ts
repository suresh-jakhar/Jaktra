import crypto from 'crypto';
import { logger } from '../../shared/logger.js';
import { AimlServiceError } from '../../shared/errors/index.js';

export interface AimlHealthResponse {
  status: 'ok' | 'degraded' | 'down';
  version?: string;
  uptime?: number;
}

export interface FollowupRequest {
  invoiceId: string;
  invoiceNo: string;
  clientName: string;
  contactEmail: string;
  invoiceAmount: string;
  currency?: string;
  dueDate: string;
  daysOverdue: number;
  urgencyTier: string;
  followupCount: number;
  channel: string;
  paymentLink?: string;
  invoiceSubject?: string;
}

/** Shape returned by the Python AI-ML /followup endpoint */
export interface FollowupResponse {
  invoiceId: string;
  channel: string;
  emailGenerated: boolean;
  emailSent: boolean;
  subject?: string;
  htmlBody?: string;
  bodyPreview?: string;
  error?: string;
}

/** Raw snake_case shape returned by the Python service */
interface RawFollowupResponse {
  invoice_id: string;
  channel: string;
  content?: {
    subject?: string;
    plain_body?: string;
    html_body?: string;
  };
  error?: string;
}

export interface BatchRunRequest {
  invoiceIds: string[];
}

export interface BatchRunResponse {
  runId: string;
  totalQueued: number;
  accepted: boolean;
}

interface CircuitBreakerState {
  failures: number;
  lastFailureAt: number;
  state: 'closed' | 'open' | 'half-open';
}

export interface AimlServiceConfig {
  baseUrl: string;
  serviceKey?: string;
  timeoutMs?: number;
  maxRetries?: number;
  circuitBreakerThreshold?: number;
  circuitBreakerResetMs?: number;
}

export class AimlService {
  private readonly baseUrl: string;
  private readonly serviceKey: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly cbThreshold: number;
  private readonly cbResetMs: number;
  private circuit: CircuitBreakerState;

  constructor(clientConfig: AimlServiceConfig) {
    this.baseUrl = clientConfig.baseUrl.replace(/\/+$/, '');
    this.serviceKey = clientConfig.serviceKey ?? '';
    this.timeoutMs = clientConfig.timeoutMs ?? 30_000;
    this.maxRetries = clientConfig.maxRetries ?? 2;
    this.cbThreshold = clientConfig.circuitBreakerThreshold ?? 5;
    this.cbResetMs = clientConfig.circuitBreakerResetMs ?? 60_000;
    this.circuit = { failures: 0, lastFailureAt: 0, state: 'closed' };
  }

  async getAgentStatus(): Promise<AimlHealthResponse> {
    try {
      const data = await this.request<AimlHealthResponse>('GET', '/health');
      return data;
    } catch {
      return { status: 'down' };
    }
  }

  async triggerFollowup(invoice: FollowupRequest): Promise<FollowupResponse> {
    const payload = {
      invoice_id: invoice.invoiceId,
      invoice_no: invoice.invoiceNo,
      client_name: invoice.clientName,
      contact_email: invoice.contactEmail,
      invoice_amount: invoice.invoiceAmount,
      currency: invoice.currency ?? 'INR',
      due_date: invoice.dueDate,
      days_overdue: invoice.daysOverdue,
      urgency_tier: invoice.urgencyTier,
      followup_count: invoice.followupCount,
      channel: invoice.channel,
      payment_link: invoice.paymentLink,
      invoice_subject: invoice.invoiceSubject ?? null,
    };
    const raw = await this.request<RawFollowupResponse>('POST', '/followup', payload);
    return {
      invoiceId: raw.invoice_id,
      channel: raw.channel,
      emailGenerated: !!(raw.content?.subject || raw.content?.plain_body),
      emailSent: false, // generation only — actual sending happens via CommunicationService
      subject: raw.content?.subject,
      htmlBody: raw.content?.html_body,
      bodyPreview: raw.content?.plain_body?.slice(0, 300),
      error: raw.error,
    };
  }

  async triggerBatchRun(request: BatchRunRequest): Promise<BatchRunResponse> {
    return this.request<BatchRunResponse>('POST', '/batch-run', request);
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    this.checkCircuitBreaker();

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.fetchWithTimeout(method, path, body);

        if (!response.ok) {
          const errorBody = await response.text().catch(() => 'Unknown error');
          throw new AimlServiceError(
            `AI-ML service returned ${response.status}: ${errorBody}`,
            response.status,
          );
        }

        this.onSuccess();
        return (await response.json()) as T;
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err));

        if (err instanceof AimlServiceError && err.statusCode >= 400 && err.statusCode < 500) {
          throw err;
        }

        if (attempt < this.maxRetries) {
          const delay = Math.min(1000 * 2 ** attempt, 5000);
          logger.warn(`AI-ML request failed (attempt ${attempt + 1}/${this.maxRetries + 1}), retrying in ${delay}ms`);
          await this.sleep(delay);
        }
      }
    }

    this.onFailure();
    throw lastError ?? new AimlServiceError('AI-ML service request failed', 503);
  }

  private async fetchWithTimeout(method: string, path: string, body?: unknown): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Request-ID': crypto.randomUUID(),
      };
      if (this.serviceKey) {
        headers['X-Service-Key'] = this.serviceKey;
      }
      return await fetch(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new AimlServiceError(`AI-ML request timed out after ${this.timeoutMs}ms`, 504);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  private checkCircuitBreaker(): void {
    if (this.circuit.state === 'closed') return;

    const elapsed = Date.now() - this.circuit.lastFailureAt;
    if (elapsed >= this.cbResetMs) {
      this.circuit.state = 'half-open';
      logger.info('AI-ML circuit breaker half-open — allowing probe request');
      return;
    }

    throw new AimlServiceError(
      'AI-ML circuit breaker is open — service temporarily unavailable',
      503,
    );
  }

  private onSuccess(): void {
    if (this.circuit.state === 'half-open') {
      logger.info('AI-ML circuit breaker closed — probe request succeeded');
    }
    this.circuit = { failures: 0, lastFailureAt: 0, state: 'closed' };
  }

  private onFailure(): void {
    this.circuit.failures++;
    this.circuit.lastFailureAt = Date.now();

    if (this.circuit.state === 'half-open') {
      this.circuit.state = 'open';
      logger.error('AI-ML circuit breaker re-opened — probe request failed');
    } else if (this.circuit.failures >= this.cbThreshold) {
      this.circuit.state = 'open';
      logger.error(`AI-ML circuit breaker opened after ${this.circuit.failures} failures`);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

