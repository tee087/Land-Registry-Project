import { ConnectionError, UniqueConstraintError, ValidationError, ForeignKeyConstraintError } from 'sequelize';
import env from '../config/environment.js';
import { AppError, sendError } from '../utils/responseHandler.js';

/** Translate known library errors into AppErrors. Returns null if unknown. */
function normalize(err) {
  if (err instanceof AppError) return err;

  // body-parser errors
  if (err.type === 'entity.too.large') return new AppError('Request body too large', 413, 'PAYLOAD_TOO_LARGE');
  if (err.type === 'entity.parse.failed') return new AppError('Malformed JSON in request body', 400, 'INVALID_JSON');

  // Sequelize errors (order matters: UniqueConstraintError extends ValidationError)
  if (err instanceof ConnectionError) return new AppError('Database temporarily unavailable', 503, 'DATABASE_UNAVAILABLE');
  if (err instanceof UniqueConstraintError) return new AppError('A record with these unique values already exists', 409, 'DUPLICATE_RECORD');
  if (err instanceof ForeignKeyConstraintError) return new AppError('Operation conflicts with related records', 409, 'RELATED_RECORD_CONFLICT');
  if (err instanceof ValidationError) {
    return new AppError('Validation failed', 400, 'VALIDATION_ERROR', err.errors?.map((e) => ({ field: e.path, message: e.message })));
  }
  // Other http-errors style 4xx errors (e.g. URIError from bad %-encoding, aborted requests)
  const status = err.status || err.statusCode;
  if (Number.isInteger(status) && status >= 400 && status < 500 && err.expose) {
    return new AppError(err.message, status, 'BAD_REQUEST');
  }
  return null;
}

export function errorMiddleware(err, req, res, next) {
  const known = normalize(err);
  const statusCode = known?.statusCode || 500;

  // Log server-side with the request ID. Never log request bodies (may contain passwords).
  if (statusCode >= 500) {
    if (!env.isTest) console.error(`[error] ${req.id} ${req.method} ${req.originalUrl.split('?')[0]} -> ${statusCode}\n${err.stack || err}`);
  }

  if (res.headersSent) return next(err);

  return sendError(res, {
    // Unknown (non-operational) errors never leak their message in production.
    message: known ? known.message : env.isProduction ? 'Internal server error' : err.message,
    statusCode,
    code: known?.code || 'INTERNAL_ERROR',
    details: known?.details || (!known && !env.isProduction ? { stack: err.stack } : null),
  });
}
