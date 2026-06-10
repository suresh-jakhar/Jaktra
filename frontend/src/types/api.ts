export interface User {
  id: string;
  tenant_id: string;
  name: string;
  email: string;
  role: "admin" | "manager" | "viewer";
  created_at: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

// Pagination generic
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface AnalyticsSummary {
  totalReceivable: number;
  totalCollected: number;
  totalOverdue: number;
  invoiceCount: number;
}

export interface AgingTier {
  tier: string;
  totalAmount: number;
  count: number;
}

export interface AgentRun {
  id: string;
  status: string;
  startTime: string;
  endTime: string | null;
  invoicesProcessed: number;
  emailsSent: number;
  errors: number;
  errorDetails: string | null;
}

export interface AgentRunsResponse {
  runs: AgentRun[];
  total: number;
}

export interface DlqEntry {
  invoiceId: string;
  consecutiveFailures: number;
  lastError: string | null;
  firstFailure: string;
  lastFailure: string;
}
