import crypto from 'node:crypto';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import env from './config/environment.js';
import { corsOptions } from './config/cors.js';
import routes from './routes/index.js';
import { notFoundMiddleware } from './middleware/notFoundMiddleware.js';
import { errorMiddleware } from './middleware/errorMiddleware.js';
import { AppError } from './utils/responseHandler.js';
import { createRateLimitStore } from './config/redis-rate-limit.js';

const app = express();

app.disable('x-powered-by');
if (env.trustProxy > 0) app.set('trust proxy', env.trustProxy);

// Request correlation ID (reused later by the audit module).
app.use((req, res, next) => {
  const incoming = req.get('X-Request-ID');
  req.id = incoming && /^[\w-]{8,64}$/.test(incoming) ? incoming : crypto.randomUUID();
  res.setHeader('X-Request-ID', req.id);
  next();
});

// Reject malformed percent-encoding in the URL path with 400 rather than
// letting it fall through to a confusing 404.
app.use((req, res, next) => {
  try {
    decodeURIComponent(req.path);
  } catch {
    return next(new AppError('Malformed URL encoding', 400, 'BAD_REQUEST'));
  }
  return next();
});

// Security headers, CORS
app.use(helmet());
app.use(cors(corsOptions));

// Logging (query strings are logged, so never put secrets in URLs)
if (!env.isTest) {
  morgan.token('id', (req) => req.id);
  morgan.token('safe-url', (req) => req.path);
  app.use(morgan(':id :remote-addr :method :safe-url :status :res[content-length] - :response-time ms'));
}

// Global rate limit
app.use(
  rateLimit({
    windowMs: env.rateLimit.windowMs,
    limit: env.rateLimit.max,
    ...(env.redisUrl ? { store: createRateLimitStore('global') } : {}),
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (req, res, next) => next(new AppError('Too many requests, please try again later', 429, 'RATE_LIMITED')),
  })
);

// Body parsing with size limits
app.use(express.json({ limit: env.bodyLimit }));
app.use(express.urlencoded({ extended: true, limit: env.bodyLimit }));

// Routes
app.use('/api', routes);

// 404 + central error handler (must be last)
app.use(notFoundMiddleware);
app.use(errorMiddleware);

export default app;
