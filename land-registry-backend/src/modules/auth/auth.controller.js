import * as service from './auth.service.js';
import { sendSuccess } from '../../utils/responseHandler.js';
import { recordAudit } from '../../services/audit.service.js';
export const register = async (req, res) => sendSuccess(res, { data: await service.register(req.body), message: 'Account created', statusCode: 201 });
export const login = async (req, res) => sendSuccess(res, { data: await service.login(req.body), message: 'Login successful' });
export const google = async (req, res) => sendSuccess(res, { data: await service.googleAuth(req.body), message: 'Google sign-in successful' });
export const refresh = async (req, res) => sendSuccess(res, { data: await service.refresh(req.body.refreshToken), message: 'Token refreshed' });
export const logout = async (req, res) => { await service.logout(req.body?.refreshToken); return sendSuccess(res, { message: 'Logged out' }); };
export const me = async (req, res) => sendSuccess(res, { data: service.publicUser(req.user), message: 'Current user' });
export const verifyEmail = async (req, res) => sendSuccess(res, {
  data: req.body.code
    ? await service.verifyEmailCode(req.body.email, req.body.code)
    : await service.verifyEmail(req.body.token),
  message: 'Email verified. Your account is ready.',
});
export const requestEmailVerification = async (req, res) => sendSuccess(res, { data: await service.requestEmailVerification(req.body.email), message: 'If verification is needed for that account, a code will be sent.' });
export const requestPasswordReset = async (req, res) => {
  await service.requestPasswordReset(req.body.email);
  return sendSuccess(res, { data: { accepted: true }, message: 'If an active account matches that address, a reset link will be sent.' });
};
export const requestOwnPasswordReset = async (req, res) => {
  const data = await service.requestPasswordReset(req.user.email, { awaitDelivery: true });
  return sendSuccess(res, { data, message: data.emailSent ? 'Password reset email accepted for delivery.' : 'A reset email was sent recently.' });
};
export const resetPassword = async (req, res) => sendSuccess(res, { data: await service.resetPassword(req.body.token, req.body.password), message: 'Password reset. Sign in with your new password.' });
export const setupMfa = async (req, res) => {
  const data = await service.setupMfa(req.user.id, req.body.password);
  await recordAudit(req, { action: 'user.mfa.setup', entityType: 'user', entityId: req.user.id });
  return sendSuccess(res, { data, message: 'Scan or manually enter this authenticator secret, then confirm a code.' });
};
export const enableMfa = async (req, res) => {
  const data = await service.enableMfa(req.user.id, req.body.code);
  await recordAudit(req, { action: 'user.mfa.enabled', entityType: 'user', entityId: req.user.id });
  return sendSuccess(res, { data, message: 'Multi-factor authentication enabled.' });
};
export const changePassword = async (req, res) => {
  await service.changePassword(req.user.id, req.body);
  await recordAudit(req, { action: 'user.password.change', entityType: 'user', entityId: req.user.id });
  return sendSuccess(res, { message: 'Password changed successfully. All other sessions have been signed out; please sign in again with your new password.' });
};
