import { AppError } from '../utils/responseHandler.js';
export function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) return next(new AppError('Request validation failed', 422, 'VALIDATION_ERROR', result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }))));
    req[source] = result.data;
    next();
  };
}
