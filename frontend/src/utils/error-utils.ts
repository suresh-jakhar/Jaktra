import axios from 'axios';

export function getErrorMessage(error: unknown): string {
  let message = '';
  
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (data?.error?.message) {
      message = data.error.message;
    } else if (data?.message) {
      message = data.message;
    } else {
      message = error.message || 'Service unavailable';
    }
  } else if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'string') {
    message = error;
  } else {
    return 'An unexpected error occurred';
  }

  // Normalize/sanitize raw technical messages
  const lowerMsg = message.toLowerCase();
  if (lowerMsg.includes('circuit breaker is open') || lowerMsg.includes('circuit breaker open') || lowerMsg.includes('circuitbreaker')) {
    return 'AI service temporarily unavailable';
  }
  if (lowerMsg.includes('smtp') || lowerMsg.includes('email sending failed') || lowerMsg.includes('sendgrid')) {
    return 'Email service unavailable';
  }
  if (lowerMsg.includes('fetch failed') || lowerMsg.includes('typeerror: fetch failed')) {
    return 'Unable to connect to service';
  }
  if (lowerMsg.includes('econnrefused')) {
    return 'Connection failed';
  }
  if (lowerMsg.includes('etimedout') || lowerMsg.includes('timeout')) {
    return 'Request timed out';
  }
  if (lowerMsg.includes('jwt') || lowerMsg.includes('token') || lowerMsg.includes('unauthorized') || lowerMsg.includes('auth')) {
    return 'Authentication failed';
  }
  if (lowerMsg.includes('validation') || lowerMsg.includes('zod')) {
    return 'Invalid request data';
  }
  if (lowerMsg.includes('unique constraint') || lowerMsg.includes('unique violation') || lowerMsg.includes('already exists')) {
    return 'Record already exists';
  }
  if (lowerMsg.includes('invoice not found')) {
    return 'Invoice not found';
  }

  return message;
}
