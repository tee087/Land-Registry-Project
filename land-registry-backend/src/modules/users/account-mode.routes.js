import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import AccountModeRequest from '../../models/AccountModeRequest.js';
import User from '../../models/User.js';
import { authenticate } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError, sendSuccess } from '../../utils/responseHandler.js';
import { recordAudit } from '../../services/audit.service.js';
import { sendAccountModeApprovalRequest } from '../../services/email.service.js';
import env from '../../config/environment.js';
import { createRateLimitStore } from '../../config/redis-rate-limit.js';

const router = Router();
const modeSchema = z.object({ requestedAccountType: z.enum(['buyer', 'seller', 'buyer_seller']) }).strict();
const approvalSchema = z.object({ token: z.string().min(40).max(100) }).strict();
const requestLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  ...(env.redisUrl ? { store: createRateLimitStore('account-mode-request') } : {}),
});
const hashToken = (value) => crypto.createHash('sha256').update(value).digest('hex');
const safeRequest = (row) => ({
  reference: row.reference,
  currentAccountType: row.currentAccountType,
  requestedAccountType: row.requestedAccountType,
  status: row.status,
  expiresAt: row.expiresAt,
  createdAt: row.createdAt,
});

router.post('/request', authenticate, requestLimiter, validate(modeSchema), asyncHandler(async (req, res) => {
  let token;
  let request;
  let alreadyPending = false;
  await User.sequelize.transaction(async (transaction) => {
    const user = await User.findByPk(req.user.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!user || user.role !== 'landowner') throw new AppError('Only buyer and seller accounts can request an account mode change.', 403, 'ACCOUNT_MODE_NOT_APPLICABLE');
    if (req.body.requestedAccountType === user.accountType) throw new AppError('Your account is already in that mode.', 409, 'ACCOUNT_MODE_UNCHANGED');
    const existing = await AccountModeRequest.findOne({ where: { userId: user.id, status: 'pending' }, order: [['createdAt', 'DESC']], transaction, lock: transaction.LOCK.UPDATE });
    if (existing && existing.expiresAt > new Date() && existing.requestedAccountType === req.body.requestedAccountType) {
      request = existing;
      alreadyPending = true;
      return;
    }
    if (existing) {
      existing.status = existing.expiresAt <= new Date() ? 'expired' : 'cancelled';
      existing.reviewedAt = new Date();
      await existing.save({ transaction });
    }

    token = crypto.randomBytes(32).toString('base64url');
    request = await AccountModeRequest.create({
      reference: `AM-${crypto.randomUUID().slice(0, 12).toUpperCase()}`,
      userId: user.id,
      currentAccountType: user.accountType,
      requestedAccountType: req.body.requestedAccountType,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    }, { transaction });
  });
  if (alreadyPending) return sendSuccess(res, { data: safeRequest(request), message: 'Your account mode request is already awaiting review.', statusCode: 202 });
  try {
    await sendAccountModeApprovalRequest({ request, user: req.user, token });
  } catch {
    await request.destroy();
    throw new AppError('We could not send the approval request. Please try again shortly.', 503, 'APPROVAL_EMAIL_FAILED');
  }
  await recordAudit(req, { action: 'user.account_mode.requested', entityType: 'account_mode_request', entityId: request.id, metadata: { reference: request.reference, from: request.currentAccountType, to: request.requestedAccountType } });
  return sendSuccess(res, { data: safeRequest(request), message: 'Your request was sent for review. Your current account mode remains active until it is approved.', statusCode: 202 });
}));

router.get('/mine', authenticate, asyncHandler(async (req, res) => {
  const request = await AccountModeRequest.findOne({ where: { userId: req.user.id, status: 'pending' }, order: [['createdAt', 'DESC']] });
  if (!request) return sendSuccess(res, { data: { request: null }, message: 'No account mode request is awaiting review.' });
  if (request.expiresAt <= new Date()) {
    request.status = 'expired';
    request.reviewedAt = new Date();
    await request.save();
    return sendSuccess(res, { data: { request: null }, message: 'No account mode request is awaiting review.' });
  }
  return sendSuccess(res, { data: { request: safeRequest(request) }, message: 'Account mode request status.' });
}));

router.post('/approval/inspect', requestLimiter, validate(approvalSchema), asyncHandler(async (req, res) => {
  const request = await AccountModeRequest.findOne({ where: { tokenHash: hashToken(req.body.token), status: 'pending' } });
  if (!request || request.expiresAt <= new Date()) throw new AppError('This approval link is invalid or has expired.', 410, 'ACCOUNT_MODE_LINK_EXPIRED');
  const user = await User.findByPk(request.userId, { attributes: ['fullName', 'email', 'role'] });
  if (!user || user.role !== 'landowner') throw new AppError('This account mode request is no longer available.', 410, 'ACCOUNT_MODE_REQUEST_UNAVAILABLE');
  return sendSuccess(res, { data: { ...safeRequest(request), applicantName: user.fullName, applicantEmail: user.email }, message: 'Account mode request is ready for review.' });
}));

router.post('/approval', requestLimiter, validate(approvalSchema), asyncHandler(async (req, res) => {
  const result = await User.sequelize.transaction(async (transaction) => {
    const request = await AccountModeRequest.findOne({ where: { tokenHash: hashToken(req.body.token), status: 'pending' }, transaction, lock: transaction.LOCK.UPDATE });
    if (!request || request.expiresAt <= new Date()) throw new AppError('This approval link is invalid or has expired.', 410, 'ACCOUNT_MODE_LINK_EXPIRED');
    const user = await User.findByPk(request.userId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!user || user.role !== 'landowner') throw new AppError('This account mode request is no longer available.', 410, 'ACCOUNT_MODE_REQUEST_UNAVAILABLE');
    const previousMode = user.accountType;
    user.accountType = request.requestedAccountType;
    await user.save({ transaction });
    request.status = 'approved';
    request.reviewedAt = new Date();
    await request.save({ transaction });
    return { request, user, previousMode };
  });
  await recordAudit(req, { action: 'user.account_mode.approved', entityType: 'user', entityId: result.user.id, metadata: { reference: result.request.reference, from: result.previousMode, to: result.request.requestedAccountType, approvalMethod: 'one_time_email_link' } });
  return sendSuccess(res, { data: { reference: result.request.reference, accountType: result.user.accountType }, message: 'Account mode change approved.' });
}));

export default router;
