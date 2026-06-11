import { logger } from '../../shared/logger.js';

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
  dueDate: string;
  daysOverdue: number;
  urgencyTier: string;
  followupCount: number;
}

export interface FollowupResponse {
  invoiceId: string;
  emailGenerated: boolean;
  emailSent: boolean;
  subject?: string;
  bodyPreview?: string;
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
  isOpen: boolean;
}

export interface AimlServiceConfig {
  baseUrl: string;
  timeoutMs?: number;
  maxRetries?: number;
  circuitBreakerThreshold?: number;
  circuitBreakerResetMs?: number;
}

export class AimlService {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly cbThreshold: number;
  private readonly cbResetMs: number;
  private circuit: CircuitBreakerState;

  constructor(clientConfig: AimlServiceConfig) {
    this.baseUrl = clientConfig.baseUrl.replace(/\/+$/, '');
    this.timeoutMs = clientConfig.timeoutMs ?? 30_000;
    this.maxRetries = clientConfig.maxRetries ?? 2;
    this.cbThreshold = clientConfig.circuitBreakerThreshold ?? 5;
    this.cbResetMs = clientConfig.circuitBreakerResetMs ?? 60_000;
    this.circuit = { failures: 0, lastFailureAt: 0, isOpen: false };
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
    return this.request<FollowupResponse>('POST', '/followup', invoice);
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
      return await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
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
    if (!this.circuit.isOpen) return;

    const elapsed = Date.now() - this.circuit.lastFailureAt;
    if (elapsed >= this.cbResetMs) {
      this.circuit.isOpen = false;
      this.circuit.failures = 0;
      logger.info('AI-ML circuit breaker reset — allowing requests');
      return;
    }

    throw new AimlServiceError(
      'AI-ML circuit breaker is open — service temporarily unavailable',
      503,
    );
  }

  private onSuccess(): void {
    if (this.circuit.failures > 0) {
      this.circuit.failures = 0;
      this.circuit.isOpen = false;
    }
  }

  private onFailure(): void {
    this.circuit.failures++;
    this.circuit.lastFailureAt = Date.now();

    if (this.circuit.failures >= this.cbThreshold) {
      this.circuit.isOpen = true;
      logger.error(`AI-ML circuit breaker opened after ${this.circuit.failures} consecutive failures`);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export class AimlServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'AimlServiceError';
  }
}
