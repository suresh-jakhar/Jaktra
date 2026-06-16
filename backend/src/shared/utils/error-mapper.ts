import { ZodError } from 'zod';

export function mapErrorToDisplayMessage(error: unknown): string {
  if (!error) return 'An unexpected error occurred';

  const errString = String(error);
  const errMsg = error instanceof Error ? error.message : errString;

  // AI-ML Circuit breaker
  if (errMsg.includes('circuit breaker is open') || errMsg.includes('circuit breaker open') || errMsg.includes('CircuitBreakerOpen')) {
    return 'AI service temporarily unavailable';
  }

  // SMTP connection / sendgrid provider failures
  if (
    errMsg.includes('SMTP') || 
    errMsg.includes('smtp') || 
    errMsg.includes('mail') || 
    errMsg.includes('Email sending failed') || 
    errMsg.includes('SendGrid')
  ) {
    return 'Email service unavailable';
  }

  // Network / Connection
  if (errMsg.includes('fetch failed') || errMsg.includes('TypeError: fetch failed')) {
    return 'Unable to connect to service';
  }
  if (errMsg.includes('ECONNREFUSED')) {
    return 'Connection failed';
  }
  if (errMsg.includes('ETIMEDOUT') || errMsg.includes('timeout') || errMsg.includes('TIMEOUT')) {
    return 'Request timed out';
  }

  // Axios
  if (errMsg.includes('AxiosError') || (error as any).isAxiosError) {
    return 'Service unavailable';
  }

  // JWT / Auth
  if (
    errMsg.includes('jwt') || 
    errMsg.includes('JWT') || 
    errMsg.includes('token') || 
    errMsg.includes('Token') || 
    errMsg.includes('unauthorized') || 
    errMsg.includes('Unauthorized')
  ) {
    return 'Authentication failed';
  }

  // Zod / validation
  if (error instanceof ZodError || errMsg.includes('ZodError') || errMsg.includes('validation') || errMsg.includes('Validation')) {
    return 'Invalid request data';
  }

  // PostgreSQL unique violation
  if (
    errMsg.includes('unique constraint') || 
    errMsg.includes('23505') || 
    errMsg.includes('unique violation') || 
    errMsg.includes('already exists')
  ) {
    return 'Record already exists';
  }

  // Invoices
  if (errMsg.includes('Invoice not found') || errMsg.includes('invoice not found') || errMsg.includes('invoice_no_tenant_id_uniq')) {
    return 'Invoice not found';
  }

  return 'An unexpected error occurred';
}
