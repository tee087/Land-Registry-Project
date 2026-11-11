import { Router } from 'express';
import { Op } from 'sequelize';

import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError, sendSuccess } from '../../utils/responseHandler.js';
import { AuditLog, User } from '../../models/index.js';

const router = Router();
router.use('/audit-logs', authenticate);

router.get(
  '/audit-logs',
  authorize('audit:read'),
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const where = {};
    if (req.query.entityType) where.entityType = String(req.query.entityType);
    if (req.query.entityId) where.entityId = Number.parseInt(req.query.entityId, 10) || undefined;
    if (req.query.actorId) where.actorId = Number.parseInt(req.query.actorId, 10) || undefined;
    if (req.query.action) where.action = String(req.query.action);
    if (req.query.fromDate) {
      const from = new Date(String(req.query.fromDate));
      if (Number.isNaN(from.getTime())) throw new AppError('Invalid fromDate', 422, 'VALIDATION_ERROR');
      where.createdAt = { ...where.createdAt, [Op.gte]: from };
    }
    if (req.query.toDate) {
      const to = new Date(String(req.query.toDate));
      if (Number.isNaN(to.getTime())) throw new AppError('Invalid toDate', 422, 'VALIDATION_ERROR');
      // Include the whole day by extending to the last millisecond.
      to.setUTCHours(23, 59, 59, 999);
      where.createdAt = { ...where.createdAt, [Op.lte]: to };
    }

    const { count, rows } = await AuditLog.findAndCountAll({
      where,
      limit,
      offset: (page - 1) * limit,
      order: [['createdAt', 'DESC']],
      include: [{ model: User, as: 'actor', attributes: ['id', 'fullName', 'email', 'role'] }],
    });
    return sendSuccess(res, { data: rows, meta: { page, limit, total: count, totalPages: Math.ceil(count / limit) }, message: 'Audit logs' });
  })
);

export default router;
