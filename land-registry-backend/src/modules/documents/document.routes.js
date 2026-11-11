import crypto from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { Router } from 'express';

import { authenticate } from '../../middleware/authenticate.js';
import { authorize, ROLE_PERMISSIONS } from '../../middleware/authorize.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError, sendSuccess } from '../../utils/responseHandler.js';
import { Ownership, Document, Registration } from '../../models/index.js';
import { recordAudit } from '../../services/audit.service.js';

const router = Router();
router.use(['/parcels', '/documents', '/registrations'], authenticate);

const UPLOAD_DIR = process.env.UPLOAD_DIR ? path.resolve(process.env.UPLOAD_DIR) : path.resolve('uploads');
const MAX_BYTES = 10 * 1024 * 1024;

const hasPermission = (user, permission) => {
  const perms = ROLE_PERMISSIONS[user?.role] || [];
  return perms.includes('*') || perms.includes(permission);
};
const parseId = (value, label = 'id') => {
  const id = Number.parseInt(value, 10);
  if (!Number.isInteger(id) || id <= 0) throw new AppError(`Invalid ${label}`, 422, 'VALIDATION_ERROR');
  return id;
};
const isOwner = async (userId, parcelId) =>
  (await Ownership.count({ where: { parcelId, ownerId: userId, isCurrent: true } })) > 0;

const isApplicant = async (userId, registrationId) =>
  (await Registration.count({ where: { id: registrationId, applicantId: userId } })) > 0;

async function assertDocumentAccess(user, doc) {
  if (hasPermission(user, 'document:read') || hasPermission(user, 'document:read:case')) return;
  if (doc.uploadedBy === user.id) return;
  if (doc.parcelId && (await isOwner(user.id, doc.parcelId))) return;
  if (doc.registrationId && (await isApplicant(user.id, doc.registrationId))) return;
  throw new AppError('You do not have access to this document', 403, 'FORBIDDEN');
}

function decodeContent(contentBase64) {
  if (typeof contentBase64 !== 'string' || contentBase64.length === 0) {
    throw new AppError('contentBase64 is required', 422, 'VALIDATION_ERROR');
  }
  const stripped = contentBase64.includes(',') ? contentBase64.slice(contentBase64.indexOf(',') + 1) : contentBase64;
  const buffer = Buffer.from(stripped, 'base64');
  if (buffer.length === 0) throw new AppError('Document content is empty or invalid', 422, 'VALIDATION_ERROR');
  if (buffer.length > MAX_BYTES) throw new AppError('Document exceeds the 10MB limit', 413, 'PAYLOAD_TOO_LARGE');
  return buffer;
}

const safeExtension = (name) => {
  const ext = path.extname(String(name || '')).toLowerCase();
  return /^\.[a-z0-9]{1,10}$/.test(ext) ? ext : '.bin';
};

router.post(
  '/parcels/:id/documents',
  authorize('document:create'),
  asyncHandler(async (req, res) => {
    const parcelId = parseId(req.params.id);
    if (!(await isOwner(req.user.id, parcelId))) {
      throw new AppError('You can only upload documents for parcels you own', 403, 'FORBIDDEN');
    }
    const { originalName, mimeType, contentBase64 } = req.body || {};
    if (!originalName || !mimeType) throw new AppError('originalName and mimeType are required', 422, 'VALIDATION_ERROR');
    const buffer = decodeContent(contentBase64);
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    const storageKey = `${crypto.randomUUID()}${safeExtension(originalName)}`;
    await fs.writeFile(path.join(UPLOAD_DIR, storageKey), buffer);

    const previous = await Document.findOne({
      where: { parcelId, originalName: String(originalName) },
      order: [['version', 'DESC']],
    });
    const version = previous ? previous.version + 1 : 1;

    await Document.update(
      { isCurrent: false },
      { where: { parcelId, originalName: String(originalName), isCurrent: true } }
    );

    const document = await Document.create({
      parcelId,
      uploadedBy: req.user.id,
      originalName: String(originalName),
      storageKey,
      mimeType: String(mimeType),
      sizeBytes: buffer.length,
      sha256,
      version,
      isCurrent: true,
    });
    await recordAudit(req, {
      action: 'document.upload',
      entityType: 'document',
      entityId: document.id,
      metadata: { parcelId, sha256, version },
    });
    return sendSuccess(res, { data: document, statusCode: 201, message: 'Document uploaded' });
  })
);

router.post(
  '/registrations/:id/documents',
  authorize('document:create'),
  asyncHandler(async (req, res) => {
    const registrationId = parseId(req.params.id);
    const registration = await Registration.findByPk(registrationId);
    if (!registration) throw new AppError('Registration not found', 404, 'REGISTRATION_NOT_FOUND');
    if (registration.applicantId !== req.user.id) {
      throw new AppError('You can only upload documents for your own registration applications', 403, 'FORBIDDEN');
    }
    const { originalName, mimeType, contentBase64 } = req.body || {};
    if (!originalName || !mimeType) throw new AppError('originalName and mimeType are required', 422, 'VALIDATION_ERROR');
    const buffer = decodeContent(contentBase64);
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    const storageKey = `${crypto.randomUUID()}${safeExtension(originalName)}`;
    await fs.writeFile(path.join(UPLOAD_DIR, storageKey), buffer);

    const previous = await Document.findOne({
      where: { registrationId, originalName: String(originalName) },
      order: [['version', 'DESC']],
    });
    const version = previous ? previous.version + 1 : 1;

    await Document.update(
      { isCurrent: false },
      { where: { registrationId, originalName: String(originalName), isCurrent: true } }
    );

    const document = await Document.create({
      registrationId,
      uploadedBy: req.user.id,
      originalName: String(originalName),
      storageKey,
      mimeType: String(mimeType),
      sizeBytes: buffer.length,
      sha256,
      version,
      isCurrent: true,
    });
    await recordAudit(req, {
      action: 'document.upload',
      entityType: 'document',
      entityId: document.id,
      metadata: { registrationId, sha256, version },
    });
    return sendSuccess(res, { data: document, statusCode: 201, message: 'Document uploaded' });
  })
);

router.get(
  '/registrations/:id/documents',
  asyncHandler(async (req, res) => {
    const registrationId = parseId(req.params.id);
    const registration = await Registration.findByPk(registrationId);
    if (!registration) throw new AppError('Registration not found', 404, 'REGISTRATION_NOT_FOUND');
    if (
      !hasPermission(req.user, 'document:read') &&
      !hasPermission(req.user, 'document:read:case') &&
      registration.applicantId !== req.user.id
    ) {
      throw new AppError('You do not have access to this registration', 403, 'FORBIDDEN');
    }
    const documents = await Document.findAll({
      where: { registrationId },
      order: [['createdAt', 'DESC']],
    });
    return sendSuccess(res, { data: documents, message: 'Documents' });
  })
);

router.get(
  '/parcels/:id/documents',
  asyncHandler(async (req, res) => {
    const parcelId = parseId(req.params.id);
    if (
      !hasPermission(req.user, 'document:read') &&
      !hasPermission(req.user, 'document:read:case') &&
      !(await isOwner(req.user.id, parcelId))
    ) {
      throw new AppError('You do not have access to this parcel', 403, 'FORBIDDEN');
    }
    const documents = await Document.findAll({ where: { parcelId }, order: [['createdAt', 'DESC']] });
    return sendSuccess(res, { data: documents, message: 'Documents' });
  })
);

router.get(
  '/documents/:id',
  asyncHandler(async (req, res) => {
    const document = await Document.findByPk(parseId(req.params.id));
    if (!document) throw new AppError('Document not found', 404, 'DOCUMENT_NOT_FOUND');
    await assertDocumentAccess(req.user, document);
    return sendSuccess(res, { data: document, message: 'Document' });
  })
);

router.post(
  '/documents/:id/verify',
  asyncHandler(async (req, res) => {
    const document = await Document.findByPk(parseId(req.params.id));
    if (!document) throw new AppError('Document not found', 404, 'DOCUMENT_NOT_FOUND');
    await assertDocumentAccess(req.user, document);
    let actual;
    try {
      const buffer = await fs.readFile(path.join(UPLOAD_DIR, document.storageKey));
      actual = crypto.createHash('sha256').update(buffer).digest('hex');
    } catch {
      throw new AppError('Stored document file is missing', 404, 'FILE_MISSING');
    }
    const matches = actual === document.sha256;
    await recordAudit(req, {
      action: 'document.verify',
      entityType: 'document',
      entityId: document.id,
      metadata: { matches },
    });
    return sendSuccess(res, {
      data: { documentId: document.id, expected: document.sha256, actual, matches },
      message: matches ? 'Document integrity verified' : 'Document integrity check FAILED',
    });
  })
);

router.get(
  '/documents/:id/download',
  asyncHandler(async (req, res) => {
    const document = await Document.findByPk(parseId(req.params.id));
    if (!document) throw new AppError('Document not found', 404, 'DOCUMENT_NOT_FOUND');
    await assertDocumentAccess(req.user, document);
    const filePath = path.join(UPLOAD_DIR, document.storageKey);
    try {
      await fs.access(filePath);
    } catch {
      throw new AppError('Stored document file is missing', 404, 'FILE_MISSING');
    }
    await recordAudit(req, { action: 'document.download', entityType: 'document', entityId: document.id });
    res.setHeader('Content-Type', document.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(document.originalName)}"`);
    return res.sendFile(filePath);
  })
);

export default router;
