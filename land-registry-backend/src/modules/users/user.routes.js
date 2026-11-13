import { Router } from 'express';
import User from '../../models/User.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorizeRoles } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { updateProfileSchema, updateUserStatusSchema, updateUserRoleSchema, changePasswordSchema, reviewerAccessRequestSchema, profileAvatarSchema } from '../auth/auth.validation.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError, sendSuccess } from '../../utils/responseHandler.js';
import { recordAudit, notify } from '../../services/audit.service.js';
import { changePassword } from '../auth/auth.service.js';
import { sendReviewerAccessRequest } from '../../services/email.service.js';
import { randomUUID } from 'node:crypto';
import { deleteDocument, getDocument, putDocument } from '../../services/document-storage.service.js';
import rateLimit from 'express-rate-limit';
import env from '../../config/environment.js';
import { createRateLimitStore } from '../../config/redis-rate-limit.js';

const router = Router();
router.use(authenticate);
const reviewerRequestLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  limit: 3,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  ...(env.redisUrl ? { store: createRateLimitStore('reviewer-access-request') } : {}),
});

const publicProfile = (user) => ({
  id: user.id,
  fullName: user.fullName,
  email: user.email,
  phone: user.phone,
  accountType: user.accountType,
  hasAvatar: Boolean(user.avatarKey),
  walletAddress: user.walletAddress ?? null,
  role: user.role,
  status: user.status,
  mfaEnabled: Boolean(user.mfaEnabledAt),
  emailVerifiedAt: user.emailVerifiedAt,
  createdAt: user.createdAt,
  lastLoginAt: user.lastLoginAt,
});

router.get('/me', asyncHandler(async (req, res) => sendSuccess(res, { data: publicProfile(req.user), message: 'Profile' })));

router.put('/me/avatar', validate(profileAvatarSchema), asyncHandler(async (req, res) => {
  const buffer = Buffer.from(req.body.contentBase64, 'base64');
  if (!buffer.length || buffer.length > 512 * 1024 || buffer.toString('base64') !== req.body.contentBase64) {
    throw new AppError('Profile images must be valid and no larger than 512 KB.', 422, 'INVALID_AVATAR');
  }
  const bytes = [...buffer.subarray(0, 12)];
  const signatures = {
    'image/jpeg': bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
    'image/png': bytes.slice(0, 8).join(',') === '137,80,78,71,13,10,26,10',
    'image/webp': bytes.slice(0, 4).join(',') === '82,73,70,70' && bytes.slice(8, 12).join(',') === '87,69,66,80',
  };
  if (!signatures[req.body.mimeType]) throw new AppError('The selected file does not match a supported image format.', 422, 'INVALID_AVATAR');

  const previousKey = req.user.avatarKey;
  const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[req.body.mimeType];
  const storageKey = `avatars/${req.user.id}/${randomUUID()}.${extension}`;
  await putDocument(storageKey, buffer, req.body.mimeType);
  req.user.avatarKey = storageKey;
  req.user.avatarMimeType = req.body.mimeType;
  await req.user.save();
  if (previousKey) await deleteDocument(previousKey).catch(() => {});
  await recordAudit(req, { action: 'user.avatar.update', entityType: 'user', entityId: req.user.id });
  return sendSuccess(res, { data: publicProfile(req.user), message: 'Profile photo updated.' });
}));

router.get('/me/avatar', asyncHandler(async (req, res) => {
  if (!req.user.avatarKey) throw new AppError('No profile photo is set', 404, 'AVATAR_NOT_FOUND');
  const buffer = await getDocument(req.user.avatarKey);
  if (!buffer) throw new AppError('Profile photo was not found', 404, 'AVATAR_NOT_FOUND');
  res.set({
    'Content-Type': req.user.avatarMimeType || 'application/octet-stream',
    'Cache-Control': 'private, max-age=300',
    'X-Content-Type-Options': 'nosniff',
  });
  return res.status(200).send(buffer);
}));

router.delete('/me/avatar', asyncHandler(async (req, res) => {
  if (req.user.avatarKey) await deleteDocument(req.user.avatarKey);
  req.user.avatarKey = null;
  req.user.avatarMimeType = null;
  await req.user.save();
  await recordAudit(req, { action: 'user.avatar.delete', entityType: 'user', entityId: req.user.id });
  return sendSuccess(res, { data: publicProfile(req.user), message: 'Profile photo removed.' });
}));

router.post('/me/reviewer-access-request', reviewerRequestLimiter, validate(reviewerAccessRequestSchema), asyncHandler(async (req, res) => {
  const reference = `LRC-${randomUUID().slice(0, 8).toUpperCase()}`;
  await sendReviewerAccessRequest({ reference, user: req.user, application: req.body });
  await recordAudit(req, {
    action: 'user.reviewer_access.requested',
    entityType: 'user',
    entityId: req.user.id,
    metadata: { reference, county: req.body.county, applicationType: req.body.applicationType },
  });
  return sendSuccess(res, {
    data: { reference },
    message: 'Your request was emailed for manual review. No reviewer permissions have been granted.',
    statusCode: 202,
  });
}));

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

router.patch('/:id/role', authorizeRoles('administrator'), validate(updateUserRoleSchema), asyncHandler(async (req, res) => {
  const target = await User.findByPk(req.params.id);
  if (!target) throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  if (String(target.id) === String(req.user.id) || target.role === 'administrator') {
    throw new AppError('Administrator roles cannot be changed through this action', 403, 'ADMIN_ROLE_PROTECTED');
  }
  const previousRole = target.role;
  target.role = req.body.role;
  await target.save();
  await recordAudit(req, {
    action: 'user.role.update',
    entityType: 'user',
    entityId: target.id,
    metadata: { from: previousRole, to: target.role },
  });
  if (previousRole !== target.role) {
    await notify(target.id, { type: 'account', title: 'Account role updated', body: `Your account role is now ${target.role}.` });
  }
  return sendSuccess(res, { data: { id: target.id, role: target.role }, message: 'User role updated' });
}));

export default router;
