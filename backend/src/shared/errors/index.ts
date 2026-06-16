export class AppError extends Error {
  public statusCode: number;
  public errorCode: string;
  public displayMessage: string;
  public technicalMessage: string;

  constructor(params: {
    statusCode: number;
    errorCode: string;
    displayMessage: string;
    technicalMessage: string;
  }) {
    super(params.technicalMessage);
    this.statusCode = params.statusCode;
    this.errorCode = params.errorCode;
    this.displayMessage = params.displayMessage;
    this.technicalMessage = params.technicalMessage;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(displayMessage = 'Invalid request data', technicalMessage?: string) {
    super({
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      displayMessage,
      technicalMessage: technicalMessage || displayMessage,
    });
  }
}

export class AuthError extends AppError {
  constructor(displayMessage = 'Invalid email or password', statusCode = 401, technicalMessage?: string) {
    let errorCode = 'AUTH_INVALID_CREDENTIALS';
    if (statusCode === 409) errorCode = 'CONFLICT';
    if (statusCode === 404) errorCode = 'NOT_FOUND';
    if (statusCode === 400) errorCode = 'VALIDATION_ERROR';
    super({
      statusCode,
      errorCode,
      displayMessage,
      technicalMessage: technicalMessage || displayMessage,
    });
  }
}

export class NotFoundError extends AppError {
  constructor(displayMessage = 'Resource not found', technicalMessage?: string) {
    super({
      statusCode: 404,
      errorCode: 'NOT_FOUND',
      displayMessage,
      technicalMessage: technicalMessage || displayMessage,
    });
  }
}

export class ConflictError extends AppError {
  constructor(displayMessage = 'Record already exists', technicalMessage?: string) {
    super({
      statusCode: 409,
      errorCode: 'CONFLICT',
      displayMessage,
      technicalMessage: technicalMessage || displayMessage,
    });
  }
}

export class ExternalServiceError extends AppError {
  constructor(displayMessage = 'Service unavailable', technicalMessage?: string) {
    super({
      statusCode: 502,
      errorCode: 'EXTERNAL_SERVICE_ERROR',
      displayMessage,
      technicalMessage: technicalMessage || displayMessage,
    });
  }
}

export class DatabaseError extends AppError {
  constructor(displayMessage = 'An unexpected error occurred', technicalMessage?: string) {
    super({
      statusCode: 500,
      errorCode: 'DATABASE_ERROR',
      displayMessage,
      technicalMessage: technicalMessage || displayMessage,
    });
  }
}

export class RateLimitError extends AppError {
  constructor(displayMessage = 'Rate limit exceeded', technicalMessage?: string) {
    super({
      statusCode: 429,
      errorCode: 'RATE_LIMIT_EXCEEDED',
      displayMessage,
      technicalMessage: technicalMessage || displayMessage,
    });
  }
}
