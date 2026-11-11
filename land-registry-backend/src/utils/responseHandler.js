/**
 * Consistent API envelope.
 *
 * Success: { success: true,  message, data, meta?, requestId, timestamp }
 * Error:   { success: false, message, error: { code, details? }, requestId, timestamp }
 */

export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true; // expected, safe-to-show error
    Error.captureStackTrace(this, this.constructor);
  }
}

export function sendSuccess(res, { data = null, message = 'OK', statusCode = 200, meta = null } = {}) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    ...(meta ? { meta } : {}),
    requestId: res.req?.id,
    timestamp: new Date().toISOString(),
  });
}

export function sendError(
  res,
  { message = 'Internal server error', statusCode = 500, code = 'INTERNAL_ERROR', details = null } = {}
) {
  return res.status(statusCode).json({
    success: false,
    message,
    error: { code, ...(details ? { details } : {}) },
    requestId: res.req?.id,
    timestamp: new Date().toISOString(),
  });
}
