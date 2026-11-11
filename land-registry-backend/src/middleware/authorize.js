import { AppError } from '../utils/responseHandler.js';

// Roles are deliberately assigned by trusted administrators, never by public registration.
export const ROLE_PERMISSIONS = Object.freeze({
  landowner: ['profile:read', 'profile:update', 'land:read:own', 'registration:create', 'registration:read:own', 'transfer:create', 'transfer:read:own', 'document:create', 'document:read:own'],
  registrar: ['profile:read', 'land:read', 'land:create', 'land:update', 'registration:read', 'registration:review', 'transfer:read', 'transfer:review', 'document:read', 'document:verify'],
  administrator: ['*'],
  investigator: ['profile:read', 'land:read', 'investigation:read', 'investigation:update', 'document:read:case'],
  auditor: ['profile:read', 'audit:read', 'land:read', 'registration:read', 'transfer:read'],
});
export function authorize(...required) {
  return (req, res, next) => {
    if (!req.user) return next(new AppError('Authentication required', 401, 'AUTHENTICATION_REQUIRED'));
    const permissions = ROLE_PERMISSIONS[req.user.role] || [];
    if (permissions.includes('*') || required.every((permission) => permissions.includes(permission))) return next();
    return next(new AppError('You do not have permission to perform this action', 403, 'FORBIDDEN'));
  };
}
export function authorizeRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(new AppError('Authentication required', 401, 'AUTHENTICATION_REQUIRED'));
    if (roles.includes(req.user.role)) return next();
    return next(new AppError('Your role cannot perform this action', 403, 'FORBIDDEN'));
  };
}
