import * as service from './auth.service.js';
import { sendSuccess } from '../../utils/responseHandler.js';
import { recordAudit } from '../../services/audit.service.js';
export const register = async (req, res) => sendSuccess(res, { data: await service.register(req.body), message: 'Account created', statusCode: 201 });
export const login = async (req, res) => sendSuccess(res, { data: await service.login(req.body), message: 'Login successful' });
export const refresh = async (req, res) => sendSuccess(res, { data: await service.refresh(req.body.refreshToken), message: 'Token refreshed' });
export const logout = async (req, res) => { await service.logout(req.body?.refreshToken); return sendSuccess(res, { message: 'Logged out' }); };
export const me = async (req, res) => sendSuccess(res, { data: service.publicUser(req.user), message: 'Current user' });
export const changePassword = async (req, res) => {
  await service.changePassword(req.user.id, req.body);
  await recordAudit(req, { action: 'user.password.change', entityType: 'user', entityId: req.user.id });
  return sendSuccess(res, { message: 'Password changed successfully. All other sessions have been signed out; please sign in again with your new password.' });
};
