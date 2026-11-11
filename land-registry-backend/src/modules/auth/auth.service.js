import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Op } from 'sequelize';
import env from '../../config/environment.js';
import User from '../../models/User.js';
import RefreshToken from '../../models/RefreshToken.js';
import AuthToken from '../../models/AuthToken.js';
import { sendAuthLink } from '../../services/email.service.js';
import { generateSecret, generateURI, verify as verifyTotp } from 'otplib';
import { AppError } from '../../utils/responseHandler.js';

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const privilegedRoles = new Set(['registrar', 'administrator', 'investigator', 'auditor']);
function encryptionKey() { return Buffer.from(env.mfaEncryptionKey || '', 'hex'); }
function encryptSecret(secret) {
  const iv = crypto.randomBytes(12); const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const data = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return [iv.toString('hex'), cipher.getAuthTag().toString('hex'), data.toString('hex')].join(':');
}
function decryptSecret(value) {
  const [iv, tag, data] = value.split(':'); const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(tag, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'hex')), decipher.final()]).toString('utf8');
}
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
  if (existing) {
    if (env.email.required && existing.status === 'pending') await issueAuthLink(existing, 'email_verification');
    return { accepted: true, verificationRequired: env.email.required };
  }
  const passwordHash = await bcrypt.hash(input.password, env.auth.bcryptRounds);
  const user = await User.create({ fullName: input.fullName, email: input.email, phone: input.phone || null, passwordHash, role: 'landowner', status: env.email.required ? 'pending' : 'active' });
  if (env.email.required) {
    await issueAuthLink(user, 'email_verification');
    return { user: publicUser(user), verificationRequired: true };
  }
  const refreshToken = await issueRefreshToken(user);
  return { user: publicUser(user), accessToken: accessToken(user), refreshToken, tokenType: 'Bearer', expiresIn: env.auth.accessTtl };
}
export async function login(input) {
  const user = await User.unscoped().findOne({ where: { email: input.email }, attributes: ['id', 'fullName', 'email', 'phone', 'walletAddress', 'passwordHash', 'role', 'status', 'emailVerifiedAt', 'mfaSecretEncrypted', 'mfaEnabledAt', 'lastLoginAt', 'createdAt', 'updatedAt'] });
  if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  if (user.status !== 'active') throw new AppError('Your account is not active', 403, 'ACCOUNT_NOT_ACTIVE');
  if (env.email.required && !user.emailVerifiedAt) throw new AppError('Verify your email before signing in', 403, 'EMAIL_NOT_VERIFIED');
  if (privilegedRoles.has(user.role) && user.mfaEnabledAt) {
    const valid = input.mfaCode && (await verifyTotp({ secret: decryptSecret(user.mfaSecretEncrypted), token: input.mfaCode })).valid;
    if (!valid) throw new AppError('A valid authenticator code is required', 401, 'MFA_REQUIRED');
  }
  user.lastLoginAt = new Date();
  await user.save();
  const refreshToken = await issueRefreshToken(user);
  return { user: publicUser(user), accessToken: accessToken(user), refreshToken, tokenType: 'Bearer', expiresIn: env.auth.accessTtl, mfaEnrollmentRequired: env.isProduction && privilegedRoles.has(user.role) && !user.mfaEnabledAt };
}
export async function setupMfa(userId, password) {
  const user = await User.unscoped().findByPk(userId, { attributes: ['id','email','passwordHash','role','mfaSecretEncrypted','mfaEnabledAt'] });
  if (!user || !privilegedRoles.has(user.role)) throw new AppError('MFA enrollment is limited to privileged accounts', 403, 'MFA_NOT_APPLICABLE');
  if (user.mfaEnabledAt) throw new AppError('MFA is already enabled. Contact a security administrator to reset it.', 409, 'MFA_ALREADY_ENABLED');
  if (!(await bcrypt.compare(password, user.passwordHash))) throw new AppError('Password is incorrect', 401, 'INVALID_CREDENTIALS');
  const secret = generateSecret();
  user.mfaSecretEncrypted = encryptSecret(secret); await user.save();
  return { secret, otpauthUrl: generateURI({ issuer: 'Land Registry', label: user.email, secret }) };
}
export async function enableMfa(userId, code) {
  const user = await User.unscoped().findByPk(userId, { attributes: ['id','role','mfaSecretEncrypted','mfaEnabledAt'] });
  if (!user || !privilegedRoles.has(user.role) || !user.mfaSecretEncrypted || user.mfaEnabledAt) throw new AppError('Start MFA enrollment first', 400, 'MFA_SETUP_REQUIRED');
  if (!(await verifyTotp({ secret: decryptSecret(user.mfaSecretEncrypted), token: code })).valid) throw new AppError('Authenticator code is invalid', 400, 'INVALID_MFA_CODE');
  user.mfaEnabledAt = new Date(); await user.save();
  return { enabled: true };
}
export async function issueAuthLink(user, purpose) {
  const token = purpose === 'email_verification'
    ? String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')
    : crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
  const tokenHash = purpose === 'email_verification'
    ? hashToken(`${user.id}:${token}:${expiresAt.toISOString()}`)
    : hashToken(token);
  const issued = await User.sequelize.transaction(async (transaction) => {
    await User.unscoped().findByPk(user.id, { transaction, lock: transaction.LOCK.UPDATE });
    const recent = await AuthToken.findOne({ where: { userId: user.id, purpose, createdAt: { [Op.gt]: new Date(Date.now() - 60_000) } }, transaction });
    if (recent) return false;
    await AuthToken.update({ usedAt: new Date() }, { where: { userId: user.id, purpose, usedAt: null }, transaction });
    await AuthToken.create({ userId: user.id, tokenHash, purpose, expiresAt }, { transaction });
    return true;
  });
  if (!issued) return false;
  setImmediate(() => {
    void sendAuthLink({ to: user.email, token, purpose }).catch(async () => {
      try {
        await AuthToken.update({ usedAt: new Date() }, { where: { tokenHash, usedAt: null } });
      } catch {
        console.error(`[auth] failed to invalidate undelivered token for purpose=${purpose}`);
      }
      console.error(`[auth] email delivery failed for purpose=${purpose}`);
    });
  });
  return true;
}
export async function verifyEmail(rawToken) {
  return User.sequelize.transaction(async (transaction) => {
    const candidate = await AuthToken.findOne({ where: { tokenHash: hashToken(rawToken), purpose: 'email_verification', usedAt: null }, transaction });
    if (!candidate) throw new AppError('Verification link is invalid or expired', 400, 'INVALID_AUTH_LINK');
    const user = await User.findByPk(candidate.userId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!user) throw new AppError('Account is unavailable', 400, 'INVALID_AUTH_LINK');
    const token = await AuthToken.findOne({ where: { id: candidate.id, usedAt: null }, transaction, lock: transaction.LOCK.UPDATE });
    if (!token || token.expiresAt <= new Date()) throw new AppError('Verification link is invalid or expired', 400, 'INVALID_AUTH_LINK');
    token.usedAt = new Date(); await token.save({ transaction });
    user.emailVerifiedAt = new Date(); user.status = 'active'; await user.save({ transaction });
    return { verified: true };
  });
}
export async function verifyEmailCode(rawEmail, code) {
  return User.sequelize.transaction(async (transaction) => {
    const user = await User.unscoped().findOne({
      where: { email: rawEmail.toLowerCase() },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!user) throw new AppError('Verification code is invalid or expired', 400, 'INVALID_AUTH_LINK');

    const candidate = await AuthToken.findOne({
      where: {
        userId: user.id,
        purpose: 'email_verification',
        usedAt: null,
        expiresAt: { [Op.gt]: new Date() },
      },
      order: [['createdAt', 'DESC']],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    const expectedHash = candidate
      ? hashToken(`${user.id}:${code}:${candidate.expiresAt.toISOString()}`)
      : null;
    if (!candidate || candidate.tokenHash !== expectedHash) {
      throw new AppError('Verification code is invalid or expired', 400, 'INVALID_AUTH_LINK');
    }

    candidate.usedAt = new Date();
    await candidate.save({ transaction });
    user.emailVerifiedAt = new Date();
    user.status = 'active';
    await user.save({ transaction });
    return { verified: true };
  });
}

export async function requestEmailVerification(email) {
  const user = await User.unscoped().findOne({ where: { email: email.toLowerCase() } });
  if (env.email.required && user && !user.emailVerifiedAt && ['pending', 'active'].includes(user.status)) await issueAuthLink(user, 'email_verification');
  return { accepted: true };
}
export async function requestPasswordReset(email) {
  const user = await User.findOne({ where: { email: email.toLowerCase() } });
  if (user && user.status === 'active') await issueAuthLink(user, 'password_reset');
  return { accepted: true };
}
export async function resetPassword(rawToken, newPassword) {
  const passwordHash = await bcrypt.hash(newPassword, env.auth.bcryptRounds);
  await User.sequelize.transaction(async (transaction) => {
    const candidate = await AuthToken.findOne({ where: { tokenHash: hashToken(rawToken), purpose: 'password_reset', usedAt: null }, transaction });
    if (!candidate) throw new AppError('Password reset link is invalid or expired', 400, 'INVALID_AUTH_LINK');
    const user = await User.findByPk(candidate.userId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!user || user.status !== 'active') throw new AppError('Account is unavailable', 400, 'INVALID_AUTH_LINK');
    const token = await AuthToken.findOne({ where: { id: candidate.id, usedAt: null }, transaction, lock: transaction.LOCK.UPDATE });
    if (!token || token.expiresAt <= new Date()) throw new AppError('Password reset link is invalid or expired', 400, 'INVALID_AUTH_LINK');
    token.usedAt = new Date(); await token.save({ transaction });
    user.passwordHash = passwordHash; await user.save({ transaction });
    await RefreshToken.update({ revokedAt: new Date() }, { where: { userId: user.id, revokedAt: null }, transaction });
    await AuthToken.update({ usedAt: new Date() }, { where: { userId: user.id, purpose: 'password_reset', usedAt: null }, transaction });
  });
  return { reset: true };
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
