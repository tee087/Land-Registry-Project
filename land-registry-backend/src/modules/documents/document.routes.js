import crypto from 'node:crypto';
import { Router } from 'express';

import { authenticate } from '../../middleware/authenticate.js';
import { authorize, ROLE_PERMISSIONS } from '../../middleware/authorize.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError, sendSuccess } from '../../utils/responseHandler.js';
import { Ownership, Document, Registration } from '../../models/index.js';
import { recordAudit } from '../../services/audit.service.js';
import env from '../../config/environment.js';
import {
  createDocumentUploadUrl,
  createDocumentDownloadUrl,
  documentStorageDriver,
  getDocument,
  putDocument,
  verifyUploadedDocument,
} from '../../services/document-storage.service.js';

const router = Router();
router.use(['/parcels', '/documents', '/registrations'], authenticate);

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

const newStorageKey = () => crypto.randomUUID();

router.post(
  '/parcels/:id/documents/upload-url',
  authorize('document:create'),
  asyncHandler(async (req, res) => {
    const parcelId = parseId(req.params.id, 'parcel id');
    if (!(await isOwner(req.user.id, parcelId))) {
      throw new AppError('You can only upload documents for parcels you own', 403, 'FORBIDDEN');
    }
    return createUploadUrl(req, res, { ...req.body, resourceType: 'parcels', resourceId: parcelId });
  })
);

router.post(
  '/registrations/:id/documents/upload-url',
  authorize('document:create'),
  asyncHandler(async (req, res) => {
    const registrationId = parseId(req.params.id, 'registration id');
    const registration = await Registration.findByPk(registrationId);
    if (!registration) throw new AppError('Registration not found', 404, 'REGISTRATION_NOT_FOUND');
    if (registration.applicantId !== req.user.id) {
      throw new AppError('You can only upload documents for your own registration applications', 403, 'FORBIDDEN');
    }
    return createUploadUrl(req, res, { ...req.body, resourceType: 'registrations', resourceId: registrationId });
  })
);

router.post(
  '/parcels/:id/documents/complete',
  authorize('document:create'),
  asyncHandler(async (req, res) => {
    const parcelId = parseId(req.params.id, 'parcel id');
    if (!(await isOwner(req.user.id, parcelId))) {
      throw new AppError('You can only upload documents for parcels you own', 403, 'FORBIDDEN');
    }
    return finalizeDirectUpload(req, res, { ...req.body, resourceType: 'parcels', resourceId: parcelId });
  })
);

router.post(
  '/registrations/:id/documents/complete',
  authorize('document:create'),
  asyncHandler(async (req, res) => {
    const registrationId = parseId(req.params.id, 'registration id');
    const registration = await Registration.findByPk(registrationId);
    if (!registration) throw new AppError('Registration not found', 404, 'REGISTRATION_NOT_FOUND');
    if (registration.applicantId !== req.user.id) {
      throw new AppError('You can only upload documents for your own registration applications', 403, 'FORBIDDEN');
    }
    return finalizeDirectUpload(req, res, { ...req.body, resourceType: 'registrations', resourceId: registrationId });
  })
);

function validateUploadMetadata({ originalName, mimeType, sizeBytes, sha256 }) {
  if (typeof originalName !== 'string' || !originalName.trim() || originalName.length > 255 || /[\u0000-\u001f]/.test(originalName)) {
    throw new AppError('A valid originalName (maximum 255 characters) is required', 422, 'VALIDATION_ERROR');
  }
  if (!['application/pdf', 'image/jpeg', 'image/png', 'image/tiff'].includes(mimeType)) {
    throw new AppError('Only PDF, JPEG, PNG, and TIFF documents are accepted', 422, 'UNSUPPORTED_DOCUMENT_TYPE');
  }
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > MAX_BYTES) {
    throw new AppError('Document size must be between 1 byte and 10MB', 413, 'PAYLOAD_TOO_LARGE');
  }
  if (typeof sha256 !== 'string' || !/^[A-Za-z0-9+/]{43}=$/.test(sha256) || Buffer.from(sha256, 'base64').length !== 32) {
    throw new AppError('A valid base64 SHA-256 digest is required', 422, 'VALIDATION_ERROR');
  }
}

async function createUploadUrl(req, res, { resourceType, resourceId, originalName, mimeType, sizeBytes, sha256 }) {
  validateUploadMetadata({ originalName, mimeType, sizeBytes, sha256 });
  if (documentStorageDriver !== 's3') {
    throw new AppError('Direct uploads require configured S3-compatible storage', 503, 'DIRECT_UPLOAD_UNAVAILABLE');
  }
  const storageKey = `land-registry/${req.user.id}/${resourceType}/${resourceId}/${newStorageKey()}`;
  const signed = await createDocumentUploadUrl(storageKey, mimeType, sha256);
  return sendSuccess(res, {
    data: { storageKey, uploadUrl: signed.url, headers: signed.headers, expiresIn: 300 },
    message: 'Upload URL created',
  });
}

async function finalizeDirectUpload(req, res, { resourceType, resourceId, storageKey, originalName, mimeType, sizeBytes, sha256 }) {
  validateUploadMetadata({ originalName, mimeType, sizeBytes, sha256 });
  const expectedPrefix = `land-registry/${req.user.id}/${resourceType}/${resourceId}/`;
  if (typeof storageKey !== 'string' || !storageKey.startsWith(expectedPrefix) || !/^[\w/-]+$/.test(storageKey)) {
    throw new AppError('Invalid document storage key', 422, 'VALIDATION_ERROR');
  }
  const stored = await verifyUploadedDocument(storageKey);
  if (!stored || stored.ContentLength !== sizeBytes || stored.ContentType !== mimeType || stored.ChecksumSHA256 !== sha256) {
    throw new AppError('Uploaded document metadata or checksum did not match', 422, 'UPLOAD_VERIFICATION_FAILED');
  }

  const existing = await Document.findOne({ where: { storageKey } });
  if (existing) return sendSuccess(res, { data: existing, message: 'Document already recorded' });

  const scope = resourceType === 'parcels' ? { parcelId: resourceId } : { registrationId: resourceId };
  const previous = await Document.findOne({ where: { ...scope, originalName }, order: [['version', 'DESC']] });
  const version = previous ? previous.version + 1 : 1;
  await Document.update({ isCurrent: false }, { where: { ...scope, originalName, isCurrent: true } });
  const document = await Document.create({
    ...scope,
    uploadedBy: req.user.id,
    originalName,
    storageKey,
    mimeType,
    sizeBytes,
    sha256: crypto.createHash('sha256').update(Buffer.from(sha256, 'base64')).digest('hex'),
    version,
    isCurrent: true,
  });
  await recordAudit(req, {
    action: 'document.upload',
    entityType: 'document',
    entityId: document.id,
    metadata: { ...scope, sha256: document.sha256, version },
  });
  return sendSuccess(res, { data: document, statusCode: 201, message: 'Document uploaded' });
}

router.post(
  '/parcels/:id/documents',
  authorize('document:create'),
  asyncHandler(async (req, res) => {
    if (env.isProduction) throw new AppError('Use the signed direct-upload flow', 410, 'DIRECT_UPLOAD_REQUIRED');
    const parcelId = parseId(req.params.id);
    if (!(await isOwner(req.user.id, parcelId))) {
      throw new AppError('You can only upload documents for parcels you own', 403, 'FORBIDDEN');
    }
    const { originalName, mimeType, contentBase64 } = req.body || {};
    if (!originalName || !mimeType) throw new AppError('originalName and mimeType are required', 422, 'VALIDATION_ERROR');
    const buffer = decodeContent(contentBase64);
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

    const storageKey = newStorageKey();
    await putDocument(storageKey, buffer, String(mimeType));

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
    if (env.isProduction) throw new AppError('Use the signed direct-upload flow', 410, 'DIRECT_UPLOAD_REQUIRED');
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

    const storageKey = newStorageKey();
    await putDocument(storageKey, buffer, String(mimeType));

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
  '/documents/:id/download-url',
  asyncHandler(async (req, res) => {
    const document = await Document.findByPk(parseId(req.params.id));
    if (!document) throw new AppError('Document not found', 404, 'DOCUMENT_NOT_FOUND');
    await assertDocumentAccess(req.user, document);
    if (documentStorageDriver !== 's3') {
      throw new AppError('Direct downloads require configured S3-compatible storage', 503, 'DIRECT_DOWNLOAD_UNAVAILABLE');
    }
    const downloadUrl = await createDocumentDownloadUrl(document.storageKey, document.mimeType, document.originalName);
    await recordAudit(req, { action: 'document.download', entityType: 'document', entityId: document.id });
    return sendSuccess(res, { data: { downloadUrl, expiresIn: 60 }, message: 'Download URL created' });
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
      const buffer = await getDocument(document.storageKey);
      if (!buffer) throw new Error('Stored document file is missing');
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
    const buffer = await getDocument(document.storageKey);
    if (!buffer) throw new AppError('Stored document file is missing', 404, 'FILE_MISSING');
    await recordAudit(req, { action: 'document.download', entityType: 'document', entityId: document.id });
    res.setHeader('Content-Type', document.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(document.originalName)}"`);
    res.setHeader('Content-Length', buffer.length);
    return res.send(buffer);
  })
);

export default router;
