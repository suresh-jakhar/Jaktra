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
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface Invoice {
  id: string;
  tenantId: string;
  invoiceNo: string;
  clientName: string;
  invoiceAmount: string; // Stored as numeric string
  dueDate: string;
  paymentStatus: 'Pending' | 'Paid' | 'Overdue';
  contactEmail: string;
  followupCount: number;
  lastFollowupDate: string | null;
  urgencyTier: string | null;
  daysOverdue?: number; // Calculated on the fly
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceEvent {
  id: string;
  invoiceId: string;
  eventType: string;
  payload: Record<string, any> | null;
  actor: string;
  createdAt: string;
}

export interface ListInvoicesParams {
  page?: number;
  limit?: number;
  sort_by?: 'invoiceNo' | 'clientName' | 'invoiceAmount' | 'dueDate' | 'paymentStatus' | 'followupCount' | 'createdAt';
  order?: 'asc' | 'desc';
  status?: string[];
  urgency_tier?: string[];
  client_name?: string;
  days_overdue_min?: number;
  days_overdue_max?: number;
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
