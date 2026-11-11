import { Router } from 'express';
import User from '../../models/User.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorizeRoles } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { updateProfileSchema, updateUserStatusSchema, changePasswordSchema } from '../auth/auth.validation.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError, sendSuccess } from '../../utils/responseHandler.js';
import { recordAudit, notify } from '../../services/audit.service.js';
import { changePassword } from '../auth/auth.service.js';

const router = Router();
router.use(authenticate);

const publicProfile = (user) => ({
  id: user.id,
  fullName: user.fullName,
  email: user.email,
  phone: user.phone,
  accountType: user.accountType,
  walletAddress: user.walletAddress ?? null,
  role: user.role,
  status: user.status,
});

router.get('/me', asyncHandler(async (req, res) => sendSuccess(res, { data: publicProfile(req.user), message: 'Profile' })));

router.patch('/me', validate(updateProfileSchema), asyncHandler(async (req, res) => {
  // Users may edit profile fields only; role/status are reserved for administrators.
  const { fullName, phone, walletAddress } = req.body;
  if (fullName !== undefined) req.user.fullName = fullName;
  if (phone !== undefined) req.user.phone = phone;
  if (walletAddress !== undefined) req.user.walletAddress = walletAddress;
  await req.user.save();
  await recordAudit(req, {
    action: 'user.profile.update',
    entityType: 'user',
    entityId: req.user.id,
    metadata: { fields: Object.keys(req.body) },
  });
  return sendSuccess(res, { data: publicProfile(req.user), message: 'Profile updated' });
}));

router.patch('/me/password', validate(changePasswordSchema), asyncHandler(async (req, res) => {
  // Users can only change their own password; the current password must be verified.
  await changePassword(req.user.id, req.body);
  await recordAudit(req, { action: 'user.password.change', entityType: 'user', entityId: req.user.id });
  return sendSuccess(res, { message: 'Password changed successfully. All other sessions have been signed out; please sign in again with your new password.' });
}));

router.get('/lookup', asyncHandler(async (req, res) => {
  // Exact-email lookup for transfer recipients. Returns only public identity fields.
  const email = String(req.query.email || '').trim().toLowerCase();
  if (!email) throw new AppError('email is required', 422, 'VALIDATION_ERROR');
  const target = await User.findOne({ where: { email, status: 'active' }, attributes: ['id', 'fullName', 'email'] });
  if (!target) throw new AppError('No active user with that email', 404, 'USER_NOT_FOUND');
  return sendSuccess(res, { data: target, message: 'User' });
}));

router.get('/', authorizeRoles('administrator'), asyncHandler(async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
  const { count, rows } = await User.findAndCountAll({
    attributes: ['id', 'fullName', 'email', 'phone', 'accountType', 'walletAddress', 'role', 'status', 'createdAt'],
    limit,
    offset: (page - 1) * limit,
    order: [['createdAt', 'DESC']],
  });
  return sendSuccess(res, { data: rows, meta: { page, limit, total: count, totalPages: Math.ceil(count / limit) }, message: 'Users' });
}));

router.patch('/:id/status', authorizeRoles('administrator'), validate(updateUserStatusSchema), asyncHandler(async (req, res) => {
  const target = await User.findByPk(req.params.id);
  if (!target) throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  if (!req.body.status) throw new AppError('status is required', 422, 'VALIDATION_ERROR');
  if (String(target.id) === String(req.user.id) && req.body.status !== 'active') {
    throw new AppError('Administrators cannot deactivate their own account', 403, 'SELF_DEACTIVATION_FORBIDDEN');
  }

  const previousStatus = target.status;
  target.status = req.body.status;
  await target.save();

  await recordAudit(req, {
    action: 'user.status.update',
    entityType: 'user',
    entityId: target.id,
    metadata: { from: previousStatus, to: target.status },
  });
  if (previousStatus !== target.status) {
    await notify(target.id, {
      type: 'account',
      title: 'Account status updated',
      body: `Your account status is now ${target.status}.`,
    });
  }

  return sendSuccess(res, { data: { id: target.id, status: target.status }, message: 'User status updated' });
}));

export default router;
