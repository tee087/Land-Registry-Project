import env from './environment.js';
import { AppError } from '../utils/responseHandler.js';

const allowed = new Set(env.cors.origins);

export const corsOptions = {
  origin(origin, callback) {
    // Requests with no Origin header (Postman, curl, server-to-server) are not browser
    // cross-origin requests, so CORS does not apply to them. Authentication still does.
    if (!origin || allowed.has(origin)) return callback(null, true);
    return callback(new AppError('Origin not allowed by CORS policy', 403, 'CORS_FORBIDDEN'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  exposedHeaders: ['X-Request-ID'],
  maxAge: 600,
};
