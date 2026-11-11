import { Router } from 'express';

import { authenticate } from '../../middleware/authenticate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError, sendSuccess } from '../../utils/responseHandler.js';
import { Notification } from '../../models/index.js';

const router = Router();
router.use('/notifications', authenticate);

router.get(
  '/notifications',
  asyncHandler(async (req, res) => {
    const where = { userId: req.user.id };
    if (req.query.unread === 'true') where.readAt = null;
    if (req.query.category) where.category = String(req.query.category);
    const rows = await Notification.findAll({ where, order: [['createdAt', 'DESC']], limit: 100 });
    return sendSuccess(res, { data: rows, message: 'Notifications' });
  })
);

router.post(
  '/notifications/read-all',
  asyncHandler(async (req, res) => {
    const [updated] = await Notification.update(
      { readAt: new Date() },
      { where: { userId: req.user.id, readAt: null } }
    );
    return sendSuccess(res, { data: { updated }, message: 'Notifications marked read' });
  })
);

router.post(
  '/notifications/:id/read',
  asyncHandler(async (req, res) => {
    const notification = await Notification.findByPk(Number.parseInt(req.params.id, 10));
    if (!notification) throw new AppError('Notification not found', 404, 'NOTIFICATION_NOT_FOUND');
    if (notification.userId !== req.user.id) throw new AppError('Forbidden', 403, 'FORBIDDEN');
    if (!notification.readAt) {
      notification.readAt = new Date();
      await notification.save();
    }
    return sendSuccess(res, { data: notification, message: 'Notification read' });
  })
);

export default router;
