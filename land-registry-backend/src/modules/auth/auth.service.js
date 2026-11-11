import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Op } from 'sequelize';
import env from '../../config/environment.js';
import User from '../../models/User.js';
import RefreshToken from '../../models/RefreshToken.js';
import { AppError } from '../../utils/responseHandler.js';

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const publicUser = (user) => ({ id: user.id, fullName: user.fullName, email: user.email, phone: user.phone, walletAddress: user.walletAddress ?? null, role: user.role, status: user.status, emailVerifiedAt: user.emailVerifiedAt });
function accessToken(user) {
  return jwt.sign({ role: user.role }, env.auth.accessSecret, { subject: String(user.id), expiresIn: env.auth.accessTtl, issuer: 'land-registry-api', audience: 'land-registry-client' });
}
async function issueRefreshToken(user, transaction) {
  const token = crypto.randomBytes(48).toString('base64url');
  const expiresAt = new Date(Date.now() + env.auth.refreshTtlDays * 86400000);
  await RefreshToken.create({ userId: user.id, tokenHash: hashToken(token), expiresAt }, { transaction });
  return token;
}
export async function register(input) {
  const existing = await User.findOne({ where: { email: input.email } });
  if (existing) throw new AppError('An account with this email already exists', 409, 'EMAIL_ALREADY_REGISTERED');
  const passwordHash = await bcrypt.hash(input.password, env.auth.bcryptRounds);
  const user = await User.create({ fullName: input.fullName, email: input.email, phone: input.phone || null, passwordHash, role: 'landowner', status: 'active' });
  const refreshToken = await issueRefreshToken(user);
  return { user: publicUser(user), accessToken: accessToken(user), refreshToken, tokenType: 'Bearer', expiresIn: env.auth.accessTtl };
}
export async function login(input) {
  const user = await User.unscoped().findOne({ where: { email: input.email }, attributes: ['id', 'fullName', 'email', 'phone', 'walletAddress', 'passwordHash', 'role', 'status', 'emailVerifiedAt', 'lastLoginAt', 'createdAt', 'updatedAt'] });
  if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  if (user.status !== 'active') throw new AppError('Your account is not active', 403, 'ACCOUNT_NOT_ACTIVE');
  user.lastLoginAt = new Date();
  await user.save();
  const refreshToken = await issueRefreshToken(user);
  return { user: publicUser(user), accessToken: accessToken(user), refreshToken, tokenType: 'Bearer', expiresIn: env.auth.accessTtl };
}
export async function refresh(rawToken) {
  const tokenHash = hashToken(rawToken);
  return User.sequelize.transaction(async (transaction) => {
    const record = await RefreshToken.findOne({ where: { tokenHash }, transaction, lock: transaction.LOCK.UPDATE });
    if (!record) throw new AppError('Refresh token is invalid or expired', 401, 'INVALID_REFRESH_TOKEN');
    // Reusing an already rotated/revoked token is a strong signal of theft:
    // revoke every active session for that user instead of silently failing.
    if (record.revokedAt) {
      await RefreshToken.update(
        { revokedAt: new Date() },
        { where: { userId: record.userId, revokedAt: null }, transaction }
      );
      throw new AppError('Refresh token reuse detected; all sessions have been revoked', 401, 'REFRESH_TOKEN_REUSED');
    }
    if (record.expiresAt <= new Date()) throw new AppError('Refresh token is invalid or expired', 401, 'INVALID_REFRESH_TOKEN');
    const user = await User.findByPk(record.userId, { transaction });
    if (!user || user.status !== 'active') throw new AppError('Account is unavailable', 401, 'ACCOUNT_UNAVAILABLE');
    record.revokedAt = new Date();
    await record.save({ transaction });
    // Opportunistic cleanup so expired rows do not accumulate forever.
    await RefreshToken.destroy({ where: { userId: user.id, expiresAt: { [Op.lt]: new Date() } }, transaction });
    const nextRefresh = await issueRefreshToken(user, transaction);
    return { user: publicUser(user), accessToken: accessToken(user), refreshToken: nextRefresh, tokenType: 'Bearer', expiresIn: env.auth.accessTtl };
  });
}
export async function logout(rawToken) {
  if (!rawToken) return;
  await RefreshToken.update({ revokedAt: new Date() }, { where: { tokenHash: hashToken(rawToken), revokedAt: null } });
}

export async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await User.unscoped().findByPk(userId, { attributes: ['id', 'passwordHash', 'status'] });
  if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  if (user.status !== 'active') throw new AppError('Account is not active', 403, 'ACCOUNT_NOT_ACTIVE');
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw new AppError('Current password is incorrect', 401, 'INVALID_CURRENT_PASSWORD');
  }
  const passwordHash = await bcrypt.hash(newPassword, env.auth.bcryptRounds);
  user.passwordHash = passwordHash;
  await user.save();
  // A password change invalidates every other session: revoke all outstanding
  // refresh tokens so the user must sign in again everywhere with the new password.
  await RefreshToken.update({ revokedAt: new Date() }, { where: { userId: user.id, revokedAt: null } });
  return publicUser(user);
}
export async function cleanupExpiredRefreshTokens() {
  return RefreshToken.destroy({ where: { expiresAt: { [Op.lt]: new Date() } } });
}
export { publicUser };
