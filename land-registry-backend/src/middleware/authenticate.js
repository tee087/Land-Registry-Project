import jwt from 'jsonwebtoken';
import env from '../config/environment.js';
import User from '../models/User.js';
import { AppError } from '../utils/responseHandler.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const authenticate = asyncHandler(async (req, res, next) => {
  const [scheme, token] = (req.get('authorization') || '').split(' ');
  if (scheme !== 'Bearer' || !token) throw new AppError('Authentication required', 401, 'AUTHENTICATION_REQUIRED');
  let payload;
  try { payload = jwt.verify(token, env.auth.accessSecret, { issuer: 'land-registry-api', audience: 'land-registry-client' }); }
  catch { throw new AppError('Invalid or expired access token', 401, 'INVALID_TOKEN'); }
  const user = await User.findByPk(payload.sub);
  if (!user || user.status !== 'active') throw new AppError('Account is unavailable', 401, 'ACCOUNT_UNAVAILABLE');
  req.user = user;
  next();
});
