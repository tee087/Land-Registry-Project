import { Router } from 'express';
import { Op } from 'sequelize';

import { authenticate } from '../../middleware/authenticate.js';
import { authorize, ROLE_PERMISSIONS } from '../../middleware/authorize.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError, sendSuccess } from '../../utils/responseHandler.js';
import { User, LandParcel, Ownership, Registration, Transfer, Document } from '../../models/index.js';
import { recordAudit, notify } from '../../services/audit.service.js';
import { enqueueBlockchainEvent, computeRegistryRecordReference, EVENT_TYPE } from '../../services/blockchain.service.js';

const router = Router();
router.use(['/parcels', '/registrations', '/transfers'], authenticate);

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

async function blockchainPayload(parcelId, { entityType, entityId, eventType }, { transaction } = {}) {
  const [parcel, document] = await Promise.all([
    LandParcel.findByPk(parcelId, { transaction, attributes: ['id', 'parcelNumber'] }),
    Document.findOne({
      where: { parcelId, isCurrent: true },
      order: [['version', 'DESC']],
      transaction,
      attributes: ['sha256'],
    }),
  ]);
  // The registry record reference anchors the approved off-chain registry record
  // (registration or transfer). It is NOT a legal owner; the database remains
  // the source of truth for ownership.
  const registryRecordReference = computeRegistryRecordReference(entityType, entityId);
  return {
    parcelId,
    parcelNumber: parcel?.parcelNumber ?? null,
    registryRecordReference,
    eventType,
    documentHash: document?.sha256 ?? null,
  };
}

async function assertCanReadParcel(user, parcelId) {
  if (hasPermission(user, 'land:read')) return;
  if (!(await isOwner(user.id, parcelId))) {
    throw new AppError('You do not have access to this parcel', 403, 'FORBIDDEN');
  }
}

// ---- Parcels ------------------------------------------------------------

router.get(
  '/parcels/search',
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || '').trim().toUpperCase();
    if (!q) throw new AppError('Query parameter "q" is required', 422, 'VALIDATION_ERROR');
    const parcel = await LandParcel.findOne({
      where: { parcelNumber: q },
      include: [
        {
          model: Ownership,
          as: 'ownerships',
          where: { isCurrent: true },
          required: false,
          include: [{ model: User, as: 'owner', attributes: ['id', 'fullName', 'email'] }],
        },
        {
          model: Document,
          as: 'documents',
          attributes: ['id', 'originalName', 'mimeType', 'sha256', 'version', 'isCurrent', 'createdAt'],
        },
      ],
    });
    return sendSuccess(res, { data: parcel, message: parcel ? 'Parcel found' : 'Parcel not found' });
  })
);

router.get(
  '/parcels',
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const where = {};
    if (req.query.status) where.status = String(req.query.status);
    if (req.query.county) where.county = String(req.query.county);

    if (!hasPermission(req.user, 'land:read')) {
      const owned = await Ownership.findAll({ where: { ownerId: req.user.id, isCurrent: true }, attributes: ['parcelId'] });
      const ids = owned.map((row) => row.parcelId);
      if (ids.length === 0) return sendSuccess(res, { data: [], meta: { page, limit, total: 0, totalPages: 0 }, message: 'Parcels' });
      where.id = { [Op.in]: ids };
    }

    const { count, rows } = await LandParcel.findAndCountAll({
      where,
      limit,
      offset: (page - 1) * limit,
      order: [['createdAt', 'DESC']],
    });
    return sendSuccess(res, { data: rows, meta: { page, limit, total: count, totalPages: Math.ceil(count / limit) }, message: 'Parcels' });
  })
);

router.get(
  '/parcels/:id',
  asyncHandler(async (req, res) => {
    const parcel = await LandParcel.findByPk(parseId(req.params.id), {
      include: [
        { model: Ownership, as: 'ownerships', where: { isCurrent: true }, required: false, include: [{ model: User, as: 'owner', attributes: ['id', 'fullName', 'email'] }] },
        { model: Document, as: 'documents', attributes: ['id', 'originalName', 'mimeType', 'sha256', 'version', 'isCurrent', 'createdAt'] },
      ],
    });
    if (!parcel) throw new AppError('Parcel not found', 404, 'PARCEL_NOT_FOUND');
    await assertCanReadParcel(req.user, parcel.id);
    return sendSuccess(res, { data: parcel, message: 'Parcel' });
  })
);

router.get(
  '/parcels/:id/ownerships',
  asyncHandler(async (req, res) => {
    const parcelId = parseId(req.params.id);
    await assertCanReadParcel(req.user, parcelId);
    const ownerships = await Ownership.findAll({
      where: { parcelId },
      order: [['isCurrent', 'DESC'], ['createdAt', 'DESC']],
      include: [{ model: User, as: 'owner', attributes: ['id', 'fullName', 'email', 'phone'] }],
    });
    return sendSuccess(res, { data: ownerships, message: 'Ownership history' });
  })
);

router.post(
  '/parcels',
  authorize('land:create'),
  asyncHandler(async (req, res) => {
    const { parcelNumber, county, block, location, areaHectares, latitude, longitude } = req.body || {};
    if (!parcelNumber || !county) throw new AppError('parcelNumber and county are required', 422, 'VALIDATION_ERROR');
    const normalized = String(parcelNumber).trim().toUpperCase();
    if (await LandParcel.findOne({ where: { parcelNumber: normalized } })) {
      throw new AppError('A parcel with this number already exists', 409, 'PARCEL_EXISTS');
    }
    const parcel = await LandParcel.create({
      parcelNumber: normalized,
      county: String(county).trim(),
      block: block ? String(block).trim() : null,
      location: location ? String(location).trim() : null,
      areaHectares: areaHectares ?? null,
      latitude: latitude ?? null,
      longitude: longitude ?? null,
      registeredBy: req.user.id,
    });
    await recordAudit(req, { action: 'parcel.create', entityType: 'land_parcel', entityId: parcel.id, metadata: { parcelNumber: parcel.parcelNumber } });
    return sendSuccess(res, { data: parcel, statusCode: 201, message: 'Parcel created' });
  })
);

router.patch(
  '/parcels/:id',
  authorize('land:update'),
  asyncHandler(async (req, res) => {
    const parcel = await LandParcel.findByPk(parseId(req.params.id));
    if (!parcel) throw new AppError('Parcel not found', 404, 'PARCEL_NOT_FOUND');
    const editable = ['county', 'block', 'location', 'areaHectares', 'latitude', 'longitude', 'status'];
    for (const field of editable) {
      if (req.body?.[field] !== undefined) parcel[field] = req.body[field];
    }
    await parcel.save();
    await recordAudit(req, { action: 'parcel.update', entityType: 'land_parcel', entityId: parcel.id });
    return sendSuccess(res, { data: parcel, message: 'Parcel updated' });
  })
);

router.post(
  '/parcels/:id/freeze',
  authorize('land:update'),
  asyncHandler(async (req, res) => {
    const frozen = req.body?.frozen !== false;
    const targetStatus = frozen ? 'frozen' : 'active';

    const { parcel, changed } = await LandParcel.sequelize.transaction(async (transaction) => {
      const locked = await LandParcel.findByPk(parseId(req.params.id), {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!locked) throw new AppError('Parcel not found', 404, 'PARCEL_NOT_FOUND');
      if (locked.status === targetStatus) return { parcel: locked, changed: false };

      locked.status = targetStatus;
      await locked.save({ transaction });
      await enqueueBlockchainEvent({
        entityType: 'parcel',
        entityId: locked.id,
        action: frozen ? 'freeze' : 'unfreeze',
        payload: { parcelId: locked.id, parcelNumber: locked.parcelNumber },
        transaction,
      });
      return { parcel: locked, changed: true };
    });

    if (changed) {
      await recordAudit(req, {
        action: frozen ? 'parcel.freeze' : 'parcel.unfreeze',
        entityType: 'land_parcel',
        entityId: parcel.id,
        metadata: { reason: req.body?.reason ?? null },
      });
    }
    return sendSuccess(res, {
      data: parcel,
      message: changed
        ? frozen
          ? 'Parcel frozen'
          : 'Parcel unfrozen'
        : `Parcel is already ${targetStatus}`,
    });
  })
);

// ---- Registrations ------------------------------------------------------

router.post(
  '/registrations',
  authorize('registration:create'),
  asyncHandler(async (req, res) => {
    const parcelId = parseId(req.body?.parcelId, 'parcelId');
    const parcel = await LandParcel.findByPk(parcelId);
    if (!parcel) throw new AppError('Parcel not found', 404, 'PARCEL_NOT_FOUND');
    if (parcel.status === 'frozen' || parcel.status === 'archived') {
      throw new AppError('Parcel is not open for registration', 409, 'PARCEL_NOT_OPEN');
    }
    const existing = await Registration.findOne({ where: { parcelId, applicantId: req.user.id, status: { [Op.in]: ['submitted', 'under_review'] } } });
    if (existing) throw new AppError('You already have a pending registration for this parcel', 409, 'REGISTRATION_PENDING');
    const registration = await Registration.create({ parcelId, applicantId: req.user.id, status: 'submitted' });
    await recordAudit(req, { action: 'registration.submit', entityType: 'registration', entityId: registration.id, metadata: { parcelId } });
    return sendSuccess(res, { data: registration, statusCode: 201, message: 'Registration submitted' });
  })
);

router.get(
  '/registrations',
  asyncHandler(async (req, res) => {
    const where = {};
    if (req.query.status) where.status = String(req.query.status);
    if (!hasPermission(req.user, 'registration:read')) where.applicantId = req.user.id;
    const rows = await Registration.findAll({
      where,
      order: [['createdAt', 'DESC']],
      include: [
        { model: LandParcel, as: 'parcel', attributes: ['id', 'parcelNumber', 'county', 'status'] },
        { model: User, as: 'applicant', attributes: ['id', 'fullName', 'email'] },
        { model: User, as: 'reviewer', attributes: ['id', 'fullName', 'email'] },
      ],
    });
    return sendSuccess(res, { data: rows, message: 'Registrations' });
  })
);

router.get(
  '/registrations/:id',
  asyncHandler(async (req, res) => {
    const registration = await Registration.findByPk(parseId(req.params.id), {
      include: [
        { model: LandParcel, as: 'parcel' },
        { model: User, as: 'applicant', attributes: ['id', 'fullName', 'email'] },
        { model: User, as: 'reviewer', attributes: ['id', 'fullName', 'email'] },
      ],
    });
    if (!registration) throw new AppError('Registration not found', 404, 'REGISTRATION_NOT_FOUND');
    if (registration.applicantId !== req.user.id && !hasPermission(req.user, 'registration:read')) {
      throw new AppError('You do not have access to this registration', 403, 'FORBIDDEN');
    }
    return sendSuccess(res, { data: registration, message: 'Registration' });
  })
);

router.post(
  '/registrations/:id/review',
  authorize('registration:review'),
  asyncHandler(async (req, res) => {
    const decision = req.body?.decision;
    if (!['approve', 'reject'].includes(decision)) {
      throw new AppError('decision must be "approve" or "reject"', 422, 'VALIDATION_ERROR');
    }
    const result = await LandParcel.sequelize.transaction(async (transaction) => {
      const registration = await Registration.findByPk(parseId(req.params.id), { transaction, lock: transaction.LOCK.UPDATE });
      if (!registration) throw new AppError('Registration not found', 404, 'REGISTRATION_NOT_FOUND');
      if (!['submitted', 'under_review'].includes(registration.status)) {
        throw new AppError('Registration has already been reviewed', 409, 'REGISTRATION_CLOSED');
      }
      registration.status = decision === 'approve' ? 'approved' : 'rejected';
      registration.reviewedBy = req.user.id;
      registration.reviewedAt = new Date();
      registration.decisionNotes = req.body?.notes ?? null;
      await registration.save({ transaction });

      if (decision === 'approve') {
        const parcel = await LandParcel.findByPk(registration.parcelId, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        if (!parcel) throw new AppError('Parcel not found', 404, 'PARCEL_NOT_FOUND');
        if (parcel.status === 'frozen' || parcel.status === 'archived') {
          throw new AppError('Parcel is not open for registration approval', 409, 'PARCEL_NOT_OPEN');
        }
        const applicant = await User.findByPk(registration.applicantId, { transaction });
        if (!applicant || applicant.status !== 'active') {
          throw new AppError('Applicant account is not active', 409, 'APPLICANT_INACTIVE');
        }

        // This workflow settles 100% ownership. Refuse to create a second
        // current owner for a parcel that is already held by somebody else.
        const currentOwnerships = await Ownership.findAll({
          where: { parcelId: registration.parcelId, isCurrent: true },
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        if (currentOwnerships.some((row) => row.ownerId !== registration.applicantId)) {
          throw new AppError('Parcel already has a different current owner', 409, 'PARCEL_ALREADY_OWNED');
        }
        if (currentOwnerships.length === 0) {
          await Ownership.create(
            { parcelId: registration.parcelId, ownerId: registration.applicantId, sharePercent: 100, isCurrent: true, acquiredAt: new Date() },
            { transaction }
          );
        }

        parcel.status = 'active';
        await parcel.save({ transaction });
        const onChain = await blockchainPayload(registration.parcelId, {
          entityType: 'registration',
          entityId: registration.id,
          eventType: EVENT_TYPE.RegistrationApproved,
        }, { transaction });
        await enqueueBlockchainEvent({
          entityType: 'registration',
          entityId: registration.id,
          action: 'approve',
          payload: { ...onChain },
          transaction,
        });
      }
      return registration;
    });

    await notify(result.applicantId, {
      type: 'registration',
      title: `Registration ${result.status}`,
      body: result.decisionNotes || `Your registration was ${result.status}.`,
    });
    await recordAudit(req, { action: `registration.${result.status}`, entityType: 'registration', entityId: result.id });
    return sendSuccess(res, { data: result, message: `Registration ${result.status}` });
  })
);

// ---- Transfers ----------------------------------------------------------

router.post(
  '/transfers',
  authorize('transfer:create'),
  asyncHandler(async (req, res) => {
    const parcelId = parseId(req.body?.parcelId, 'parcelId');
    const toOwnerId = parseId(req.body?.toOwnerId, 'toOwnerId');
    const parcel = await LandParcel.findByPk(parcelId);
    if (!parcel) throw new AppError('Parcel not found', 404, 'PARCEL_NOT_FOUND');
    if (parcel.status === 'frozen' || parcel.status === 'disputed') {
      throw new AppError('Parcel is frozen or disputed', 409, 'PARCEL_LOCKED');
    }
    if (!(await isOwner(req.user.id, parcelId))) {
      throw new AppError('You are not the current owner of this parcel', 403, 'NOT_OWNER');
    }
    if (toOwnerId === req.user.id) throw new AppError('Cannot transfer to yourself', 422, 'VALIDATION_ERROR');
    const recipient = await User.findByPk(toOwnerId);
    if (!recipient || recipient.status !== 'active') throw new AppError('Recipient not found or inactive', 422, 'INVALID_RECIPIENT');
    const pending = await Transfer.findOne({ where: { parcelId, status: 'pending' } });
    if (pending) throw new AppError('A transfer for this parcel is already pending review', 409, 'TRANSFER_PENDING');
    const transfer = await Transfer.create({
      parcelId,
      fromOwnerId: req.user.id,
      toOwnerId,
      initiatedBy: req.user.id,
      status: 'pending',
      notes: req.body?.notes ?? null,
    });
    await recordAudit(req, { action: 'transfer.initiate', entityType: 'transfer', entityId: transfer.id, metadata: { parcelId, toOwnerId } });
    return sendSuccess(res, { data: transfer, statusCode: 201, message: 'Transfer requested' });
  })
);

router.get(
  '/transfers',
  asyncHandler(async (req, res) => {
    const where = {};
    if (req.query.status) where.status = String(req.query.status);
    if (!hasPermission(req.user, 'transfer:read')) {
      where[Op.or] = [{ fromOwnerId: req.user.id }, { toOwnerId: req.user.id }, { initiatedBy: req.user.id }];
    }
    const rows = await Transfer.findAll({
      where,
      order: [['createdAt', 'DESC']],
      include: [
        { model: LandParcel, as: 'parcel', attributes: ['id', 'parcelNumber', 'county', 'status'] },
        { model: User, as: 'fromOwner', attributes: ['id', 'fullName', 'email', 'walletAddress'] },
        { model: User, as: 'toOwner', attributes: ['id', 'fullName', 'email', 'walletAddress'] },
        { model: User, as: 'initiator', attributes: ['id', 'fullName', 'email'] },
        { model: User, as: 'reviewer', attributes: ['id', 'fullName', 'email'] },
      ],
    });
    return sendSuccess(res, { data: rows, message: 'Transfers' });
  })
);

router.get(
  '/transfers/:id',
  asyncHandler(async (req, res) => {
    const transfer = await Transfer.findByPk(parseId(req.params.id), {
      include: [
        { model: LandParcel, as: 'parcel' },
        { model: User, as: 'fromOwner', attributes: ['id', 'fullName', 'email', 'walletAddress'] },
        { model: User, as: 'toOwner', attributes: ['id', 'fullName', 'email', 'walletAddress'] },
        { model: User, as: 'initiator', attributes: ['id', 'fullName', 'email'] },
        { model: User, as: 'reviewer', attributes: ['id', 'fullName', 'email'] },
      ],
    });
    if (!transfer) throw new AppError('Transfer not found', 404, 'TRANSFER_NOT_FOUND');
    const participant = [transfer.fromOwnerId, transfer.toOwnerId, transfer.initiatedBy].includes(req.user.id);
    if (!participant && !hasPermission(req.user, 'transfer:read')) {
      throw new AppError('You do not have access to this transfer', 403, 'FORBIDDEN');
    }
    return sendSuccess(res, { data: transfer, message: 'Transfer' });
  })
);

router.post(
  '/transfers/:id/review',
  authorize('transfer:review'),
  asyncHandler(async (req, res) => {
    const decision = req.body?.decision;
    if (!['approve', 'reject'].includes(decision)) {
      throw new AppError('decision must be "approve" or "reject"', 422, 'VALIDATION_ERROR');
    }
    const result = await LandParcel.sequelize.transaction(async (transaction) => {
      const transfer = await Transfer.findByPk(parseId(req.params.id), { transaction, lock: transaction.LOCK.UPDATE });
      if (!transfer) throw new AppError('Transfer not found', 404, 'TRANSFER_NOT_FOUND');
      if (transfer.status !== 'pending') throw new AppError('Transfer has already been reviewed', 409, 'TRANSFER_CLOSED');
      transfer.status = decision === 'approve' ? 'approved' : 'rejected';
      transfer.reviewedBy = req.user.id;
      transfer.reviewedAt = new Date();
      if (req.body?.notes) transfer.notes = req.body.notes;
      await transfer.save({ transaction });

      if (decision === 'approve') {
        const parcel = await LandParcel.findByPk(transfer.parcelId, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        if (!parcel) throw new AppError('Parcel not found', 404, 'PARCEL_NOT_FOUND');
        if (['frozen', 'disputed', 'archived'].includes(parcel.status)) {
          throw new AppError('Parcel is not transferable in its current status', 409, 'PARCEL_LOCKED');
        }

        const fromOwnership = await Ownership.findOne({
          where: { parcelId: transfer.parcelId, ownerId: transfer.fromOwnerId, isCurrent: true },
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        if (!fromOwnership) {
          throw new AppError('Sender is no longer the current owner', 409, 'NOT_CURRENT_OWNER');
        }
        const recipientOwnership = await Ownership.findOne({
          where: { parcelId: transfer.parcelId, ownerId: transfer.toOwnerId, isCurrent: true },
          transaction,
        });
        if (recipientOwnership) {
          throw new AppError('Recipient already holds a current ownership record for this parcel', 409, 'RECIPIENT_ALREADY_OWNER');
        }
        const recipient = await User.findByPk(transfer.toOwnerId, { transaction });
        if (!recipient || recipient.status !== 'active') {
          throw new AppError('Recipient account is not active', 409, 'INVALID_RECIPIENT');
        }

        const now = new Date();
        await Ownership.update(
          { isCurrent: false, endedAt: now },
          { where: { parcelId: transfer.parcelId, ownerId: transfer.fromOwnerId, isCurrent: true }, transaction }
        );
        await Ownership.create(
          { parcelId: transfer.parcelId, ownerId: transfer.toOwnerId, sharePercent: 100, isCurrent: true, acquiredAt: now },
          { transaction }
        );
        const onChain = await blockchainPayload(transfer.parcelId, {
          entityType: 'transfer',
          entityId: transfer.id,
          eventType: EVENT_TYPE.TransferApproved,
        }, { transaction });
        await enqueueBlockchainEvent({
          entityType: 'transfer',
          entityId: transfer.id,
          action: 'approve',
          // The payload anchors the approved off-chain transfer record. It does
          // not carry wallet addresses; legal title is set by the database.
          payload: { ...onChain },
          transaction,
        });
      }
      return transfer;
    });

    await notify(result.fromOwnerId, { type: 'transfer', title: `Transfer ${result.status}`, body: result.notes || null });
    await notify(result.toOwnerId, { type: 'transfer', title: `Transfer ${result.status}`, body: result.notes || null });
    await recordAudit(req, { action: `transfer.${result.status}`, entityType: 'transfer', entityId: result.id });
    return sendSuccess(res, { data: result, message: `Transfer ${result.status}` });
  })
);

export default router;
