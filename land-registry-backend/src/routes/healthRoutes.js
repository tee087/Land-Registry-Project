import { Router } from 'express';
import { sequelize } from '../config/database.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess, sendError } from '../utils/responseHandler.js';

const router = Router();

// Liveness: process is up. Never touches the database.
router.get('/health/live', (req, res) => sendSuccess(res, { data: { status: 'ok' }, message: 'Alive' }));

// Readiness: process can serve traffic (database reachable).
router.get(
  '/health/ready',
  asyncHandler(async (req, res) => {
    try {
      await sequelize.query('SELECT 1');
      return sendSuccess(res, { data: { status: 'ready', checks: { database: 'up' } }, message: 'Ready' });
    } catch {
      return sendError(res, {
        message: 'Not ready: database unreachable',
        statusCode: 503,
        code: 'NOT_READY',
        details: { status: 'not_ready', checks: { database: 'down' } },
      });
    }
  })
);

router.get(
  '/health',
  asyncHandler(async (req, res) => {
    let database = 'up';
    try {
      await sequelize.query('SELECT 1');
    } catch {
      database = 'down';
    }

    const data = {
      status: database === 'up' ? 'ok' : 'degraded',
      service: 'land-registry-backend',
      checks: { database },
    };

    if (database === 'down') {
      return sendError(res, { message: 'Service degraded: database unreachable', statusCode: 503, code: 'SERVICE_DEGRADED', details: data });
    }
    return sendSuccess(res, { data, message: 'Service healthy' });
  })
);

export default router;
