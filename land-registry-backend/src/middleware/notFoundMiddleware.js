import { AppError } from '../utils/responseHandler.js';

export function notFoundMiddleware(req, res, next) {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl.split('?')[0]}`, 404, 'ROUTE_NOT_FOUND'));
}
