import AuditLog from '../models/AuditLog.js';
import Notification from '../models/Notification.js';

/**
 * Persist a centralized audit event. Audit failures must never break the
 * business operation, so write errors are logged and swallowed.
 */
export async function recordAudit(req, { action, entityType, entityId = null, metadata = null }) {
  try {
    await AuditLog.create({
      actorId: req.user?.id ?? null,
      action,
      entityType,
      entityId,
      requestId: req.id ?? null,
      ip: req.ip ?? null,
      metadata: metadata ?? null,
    });
  } catch (error) {
    console.error(`[audit] Failed to record ${action} on ${entityType}:`, error.message);
  }
}

/** Create an in-app notification for a user. Failures are non-fatal.
 * `category` defaults to `type` when not supplied so every notification is
 * grouped under an event category (registration, transfer, account, ...). */
export async function notify(userId, { type, title, body = null, category = null }) {
  try {
    await Notification.create({ userId, type, title, body, category: category ?? type });
  } catch (error) {
    console.error('[notify] Failed to create notification:', error.message);
  }
}
