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
  invoiceAmount: string; 
  dueDate: string;
  paymentStatus: 'Pending' | 'Paid' | 'Overdue';
  contactEmail: string;
  followupCount: number;
  lastFollowupDate: string | null;
  urgencyTier: string | null;
  daysOverdue?: number; 
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceEvent {
  id: string;
  invoiceId: string;
  invoiceNo?: string;
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

export interface AgentPerformance {
  totalRuns: number;
  invoicesProcessed: number;
  emailsSent: number;
  automationYield: number;
  errorRate: number;
  successRate: number;
  avgDaysToPayment: number;
}

export interface EmailVolume {
  date: string;
  emailsSent: number;
}

export interface ChannelBreakdown {
  channel: string;
  count: number;
}

export interface TierEffectiveness {
  tier: string;
  avgDaysToPayment: number;
  successRate: number;
}

export interface CommunicationStats {
  totalSent: number;
  totalOpened: number;
  totalClicked: number;
  openRate: number;
  clickRate: number;
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

export interface AgentRunDetail extends AgentRun {
  events: InvoiceEvent[];
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
  clientName: string | null;
  invoiceNo: string | null;
}

export interface Communication {
  id: string;
  invoiceId: string;
  tenantId: string;
  channel: string;
  recipient: string;
  subject: string | null;
  body: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'opened' | 'clicked';
  errorMsg: string | null;
  providerMessageId: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  openedAt: string | null;
  clickedAt: string | null;
  createdAt: string;
}

export interface TenantSettings {
  companyName: string;
  senderName: string;
  senderEmail: string;
  replyTo: string | null;
  paymentLink: string | null;
  bankDetails: string | null;
  timezone: string;
  scheduleHour: number;
  idempotencyWindowHours: number;
  defaultEmailProvider: 'sendgrid' | 'smtp' | null;
}

export interface BaseIntegrationStatus {
  isConfigured: boolean;
  lastValidatedAt: string | null;
  lastValidationResult: 'valid' | 'invalid' | 'revoked' | 'insufficient_scope' | 'unverified_sender' | 'unknown';
}

export interface SendgridIntegrationStatus extends BaseIntegrationStatus {
  provider: 'sendgrid';
}

export interface SmtpIntegrationStatus extends BaseIntegrationStatus {
  provider: 'smtp';
  displayHost?: string;
  maskedUsername?: string;
  port?: number;
  securityMode?: string;
}

export interface IntegrationsResponse {
  sendgrid: SendgridIntegrationStatus;
  smtp: SmtpIntegrationStatus;
}

export interface TeamMember {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'manager' | 'viewer';
  createdAt: string;
}

export interface TeamInvitation {
  id: string;
  email: string;
  role: 'admin' | 'manager' | 'viewer';
  deliveryStatus: 'pending' | 'sent' | 'failed';
  createdAt: string;
  expiresAt: string;
}
