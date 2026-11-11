import crypto from 'node:crypto';
import { Router } from 'express';

import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError, sendSuccess } from '../../utils/responseHandler.js';
import { Evidence, EvidenceCustody, ForensicFinding, LandParcel, User } from '../../models/index.js';
import { recordAudit } from '../../services/audit.service.js';

const router = Router();
router.use('/evidence', authenticate);

const parseId = (value, label = 'id') => {
  const id = Number.parseInt(value, 10);
  if (!Number.isInteger(id) || id <= 0) throw new AppError(`Invalid ${label}`, 422, 'VALIDATION_ERROR');
  return id;
};

// ---- Evidence --------------------------------------------------------------

router.post(
  '/evidence',
  authorize('investigation:update'),
  asyncHandler(async (req, res) => {
    const description = req.body?.description;
    if (!description || String(description).trim().length < 3) {
      throw new AppError('description is required', 422, 'VALIDATION_ERROR');
    }
    const evidence = await Evidence.create({
      parcelId: req.body?.parcelId ? parseId(req.body.parcelId, 'parcelId') : null,
      custodyRef: `EVD-${crypto.randomUUID()}`,
      description: String(description).trim(),
      collectedBy: req.user.id,
      status: 'collected',
    });
    await EvidenceCustody.create({ evidenceId: evidence.id, actorId: req.user.id, action: 'collected', notes: 'Evidence registered' });
    await recordAudit(req, { action: 'evidence.create', entityType: 'evidence', entityId: evidence.id });
    return sendSuccess(res, { data: evidence, statusCode: 201, message: 'Evidence recorded' });
  })
);

router.get(
  '/evidence',
  authorize('investigation:read'),
  asyncHandler(async (req, res) => {
    const rows = await Evidence.findAll({
      order: [['createdAt', 'DESC']],
      include: [{ model: User, as: 'collector', attributes: ['id', 'fullName', 'email', 'role'] }],
    });
    return sendSuccess(res, { data: rows, message: 'Evidence' });
  })
);

// ---- Forensic findings -----------------------------------------------------

router.get(
  '/evidence/findings',
  authorize('investigation:read'),
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const where = {};
    if (req.query.caseId) where.caseId = String(req.query.caseId);
    if (req.query.riskLevel) where.riskLevel = String(req.query.riskLevel);
    if (req.query.status) where.status = String(req.query.status);
    if (req.query.evidenceId) where.evidenceId = parseId(req.query.evidenceId, 'evidenceId');

    const { count, rows } = await ForensicFinding.findAndCountAll({
      where,
      limit,
      offset: (page - 1) * limit,
      order: [['createdAt', 'DESC']],
      include: [
        { model: User, as: 'recorder', attributes: ['id', 'fullName', 'email', 'role'] },
        { model: Evidence, as: 'evidence', attributes: ['id', 'custodyRef', 'description', 'status'] },
      ],
    });
    return sendSuccess(res, { data: rows, meta: { page, limit, total: count, totalPages: Math.ceil(count / limit) }, message: 'Forensic findings' });
  })
);

router.get(
  '/evidence/findings/:id',
  authorize('investigation:read'),
  asyncHandler(async (req, res) => {
    const finding = await ForensicFinding.findByPk(parseId(req.params.id), {
      include: [
        { model: User, as: 'recorder', attributes: ['id', 'fullName', 'email', 'role'] },
        { model: Evidence, as: 'evidence' },
        { model: LandParcel, as: 'parcel', attributes: ['id', 'parcelNumber', 'county', 'status'] },
      ],
    });
    if (!finding) throw new AppError('Forensic finding not found', 404, 'FORENSIC_FINDING_NOT_FOUND');
    return sendSuccess(res, { data: finding, message: 'Forensic finding' });
  })
);

router.post(
  '/evidence/:evidenceId/findings',
  authorize('investigation:update'),
  asyncHandler(async (req, res) => {
    const evidenceId = parseId(req.params.evidenceId, 'evidenceId');
    const evidence = await Evidence.findByPk(evidenceId);
    if (!evidence) throw new AppError('Evidence not found', 404, 'EVIDENCE_NOT_FOUND');

    const { caseId, title, description, finding, riskLevel, status, parcelId } = req.body || {};
    if (!caseId || !title || !finding) throw new AppError('caseId, title and finding are required', 422, 'VALIDATION_ERROR');

    const newFinding = await ForensicFinding.create({
      evidenceId,
      parcelId: parcelId ? parseId(parcelId, 'parcelId') : evidence.parcelId ?? null,
      caseId: String(caseId).trim(),
      title: String(title).trim(),
      description: description ? String(description).trim() : null,
      finding: String(finding).trim(),
      riskLevel: riskLevel || 'medium',
      status: status || 'open',
      recordedBy: req.user.id,
    });
    await recordAudit(req, {
      action: 'forensic.finding.create',
      entityType: 'forensic_finding',
      entityId: newFinding.id,
      metadata: { caseId: newFinding.caseId, evidenceId, riskLevel: newFinding.riskLevel },
    });
    return sendSuccess(res, { data: newFinding, statusCode: 201, message: 'Forensic finding recorded' });
  })
);

router.get(
  '/evidence/:id',
  authorize('investigation:read'),
  asyncHandler(async (req, res) => {
    const evidence = await Evidence.findByPk(parseId(req.params.id), {
      include: [
        { model: User, as: 'collector', attributes: ['id', 'fullName', 'email', 'role'] },
        { model: EvidenceCustody, as: 'custody', include: [{ model: User, as: 'actor', attributes: ['id', 'fullName', 'email', 'role'] }] },
      ],
      order: [[{ model: EvidenceCustody, as: 'custody' }, 'createdAt', 'ASC']],
    });
    if (!evidence) throw new AppError('Evidence not found', 404, 'EVIDENCE_NOT_FOUND');
    return sendSuccess(res, { data: evidence, message: 'Evidence' });
  })
);

router.post(
  '/evidence/:id/custody',
  authorize('investigation:update'),
  asyncHandler(async (req, res) => {
    const evidence = await Evidence.findByPk(parseId(req.params.id));
    if (!evidence) throw new AppError('Evidence not found', 404, 'EVIDENCE_NOT_FOUND');
    const action = req.body?.action;
    if (!action) throw new AppError('action is required', 422, 'VALIDATION_ERROR');
    const entry = await EvidenceCustody.create({
      evidenceId: evidence.id,
      actorId: req.user.id,
      action: String(action).trim(),
      notes: req.body?.notes ?? null,
    });
    if (req.body?.status) evidence.status = req.body.status;
    await evidence.save();
    await recordAudit(req, { action: 'evidence.custody', entityType: 'evidence', entityId: evidence.id, metadata: { action } });
    return sendSuccess(res, { data: entry, statusCode: 201, message: 'Custody event recorded' });
  })
);

export default router;
