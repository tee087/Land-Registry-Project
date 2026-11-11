import { Router } from 'express';

import { authenticate } from '../../middleware/authenticate.js';
import { authorizeRoles } from '../../middleware/authorize.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError, sendSuccess } from '../../utils/responseHandler.js';
import { recordAudit } from '../../services/audit.service.js';
import { BlockchainTransaction, Document, LandParcel, Ownership, Registration, Transfer, User } from '../../models/index.js';
import {
  blockchainConfig,
  isBlockchainConfigured,
  readParcelOnChain,
  computeRegistryRecordReference,
  VERIFICATION_STATUS,
} from '../../services/blockchain.service.js';

const router = Router();
router.use('/blockchain', authenticate);

router.get(
  '/blockchain/status',
  authorizeRoles('administrator'),
  asyncHandler(async (req, res) => {
    const rows = await BlockchainTransaction.findAll({
      attributes: ['status'],
      raw: true,
    });
    const counts = { pending: 0, submitted: 0, confirmed: 0, failed: 0 };
    for (const row of rows) counts[row.status] = (counts[row.status] || 0) + 1;

    const lastFailure = await BlockchainTransaction.findOne({
      where: { status: 'failed' },
      order: [['updatedAt', 'DESC']],
      attributes: ['id', 'entityType', 'entityId', 'action', 'lastError', 'updatedAt'],
    });

    return sendSuccess(res, {
      data: {
        configured: isBlockchainConfigured(),
        rpcConfigured: Boolean(blockchainConfig.rpcUrl),
        contractConfigured: Boolean(blockchainConfig.contractAddress),
        signerConfigured: Boolean(blockchainConfig.privateKey),
        chainId: blockchainConfig.chainId,
        counts,
        lastFailure,
      },
      message: 'Blockchain integration status',
    });
  })
);

router.get(
  '/blockchain/transactions',
  authorizeRoles('administrator'),
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const where = {};
    if (req.query.status) where.status = String(req.query.status);
    if (req.query.entityType) where.entityType = String(req.query.entityType);
    if (req.query.action) where.action = String(req.query.action);
    const { count, rows } = await BlockchainTransaction.findAndCountAll({
      where,
      limit,
      offset: (page - 1) * limit,
      order: [['createdAt', 'DESC']],
    });
    return sendSuccess(res, { data: rows, meta: { page, limit, total: count, totalPages: Math.ceil(count / limit) }, message: 'Blockchain transactions' });
  })
);

router.get(
  '/blockchain/transactions/:id',
  authorizeRoles('administrator'),
  asyncHandler(async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) throw new AppError('Invalid transaction id', 422, 'VALIDATION_ERROR');
    const transaction = await BlockchainTransaction.findByPk(id);
    if (!transaction) throw new AppError('Blockchain transaction not found', 404, 'BLOCKCHAIN_TRANSACTION_NOT_FOUND');
    return sendSuccess(res, { data: transaction, message: 'Blockchain transaction' });
  })
);

router.post(
  '/blockchain/transactions/:id/retry',
  authorizeRoles('administrator'),
  asyncHandler(async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) throw new AppError('Invalid transaction id', 422, 'VALIDATION_ERROR');
    const transaction = await BlockchainTransaction.findByPk(id);
    if (!transaction) throw new AppError('Blockchain transaction not found', 404, 'BLOCKCHAIN_TRANSACTION_NOT_FOUND');
    if (transaction.status === 'confirmed') {
      throw new AppError('Transaction is already confirmed on chain', 409, 'BLOCKCHAIN_TRANSACTION_CONFIRMED');
    }

    transaction.status = 'pending';
    transaction.attempts = 0;
    transaction.txHash = null;
    transaction.nextAttemptAt = null;
    transaction.lastError = null;
    await transaction.save();

    await recordAudit(req, {
      action: 'blockchain.retry',
      entityType: 'blockchain_transaction',
      entityId: transaction.id,
      metadata: { entityType: transaction.entityType, domainEntityId: transaction.entityId, domainAction: transaction.action },
    });

    return sendSuccess(res, { data: transaction, message: 'Blockchain transaction queued for retry' });
  })
);

/**
 * Verify a parcel by separately reporting:
 *  A. Official registry ownership information (from MariaDB — authoritative)
 *  B. Registry approval status (Registration/Transfer approved?)
 *  C. Blockchain anchoring status (pending/confirmed/failed)
 *  D. Document integrity verification (hash match?)
 *  E. Event reference verification (matches?)
 *
 * Blockchain confirmation is NEVER reported as legal proof of ownership.
 */
router.get(
  '/blockchain/parcels/:parcelNumber',
  authorizeRoles('administrator', 'auditor', 'registrar'),
  asyncHandler(async (req, res) => {
    const parcelNumber = String(req.params.parcelNumber || '').trim().toUpperCase();
    if (!parcelNumber) throw new AppError('parcelNumber is required', 422, 'VALIDATION_ERROR');

    // --- A. Official registry information from MariaDB (authoritative) ---
    const parcel = await LandParcel.findOne({
      where: { parcelNumber },
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
          where: { isCurrent: true },
          required: false,
          attributes: ['id', 'originalName', 'sha256', 'version'],
        },
      ],
    });

    const currentOwner = parcel?.ownerships?.[0]?.owner ?? null;
    const currentDocument = parcel?.documents?.[0] ?? null;
    const dbHash = currentDocument?.sha256 ? `0x${currentDocument.sha256}`.toLowerCase() : null;

    // Find the most recent approved registration or transfer for this parcel.
    const [latestRegistration, latestTransfer] = await Promise.all([
      Registration.findOne({
        where: { parcelId: parcel?.id, status: 'approved' },
        order: [['reviewedAt', 'DESC'], ['createdAt', 'DESC']],
        attributes: ['id', 'status', 'reviewedBy', 'reviewedAt'],
        include: [{ model: User, as: 'reviewer', attributes: ['id', 'fullName', 'email'] }],
      }),
      Transfer.findOne({
        where: { parcelId: parcel?.id, status: 'approved' },
        order: [['reviewedAt', 'DESC'], ['createdAt', 'DESC']],
        attributes: ['id', 'status', 'reviewedBy', 'reviewedAt'],
        include: [{ model: User, as: 'reviewer', attributes: ['id', 'fullName', 'email'] }],
      }),
    ]);

    const latestApprovedEvent = latestRegistration || latestTransfer;
    const registryApprovalStatus = latestApprovedEvent
      ? VERIFICATION_STATUS.REGISTRY_APPROVED
      : parcel
        ? VERIFICATION_STATUS.REGISTRY_PENDING
        : VERIFICATION_STATUS.REGISTRY_REJECTED;

    // --- B/C/D/E. Blockchain verification ---
    let blockchainStatus = VERIFICATION_STATUS.BLOCKCHAIN_FAILED;
    let documentHashStatus = VERIFICATION_STATUS.DOCUMENT_HASH_NOT_AVAILABLE;
    let eventReferenceStatus = VERIFICATION_STATUS.EVENT_REFERENCE_NOT_AVAILABLE;
    let onChain = null;
    let blockchainTxHash = null;
    let blockchainConfirmedAt = null;

    try {
      onChain = await readParcelOnChain(parcelNumber);

      // Find the outbox row for this parcel's latest approved event.
      const outbox = await BlockchainTransaction.findOne({
        where: {
          entityType: latestApprovedEvent ? (latestRegistration ? 'registration' : 'transfer') : null,
          entityId: latestApprovedEvent ? latestApprovedEvent.id : null,
        },
        order: [['createdAt', 'DESC']],
      });

      if (outbox) {
        if (outbox.status === 'confirmed') {
          blockchainStatus = VERIFICATION_STATUS.BLOCKCHAIN_CONFIRMED;
          blockchainTxHash = outbox.txHash ?? null;
          blockchainConfirmedAt = outbox.confirmedAt ?? null;
        } else if (outbox.status === 'failed') {
          blockchainStatus = VERIFICATION_STATUS.BLOCKCHAIN_FAILED;
        } else {
          blockchainStatus = VERIFICATION_STATUS.BLOCKCHAIN_PENDING;
        }
      }

      // D. Document hash comparison.
      const chainHash = String(onChain?.documentHash || '').toLowerCase();
      if (dbHash && chainHash) {
        documentHashStatus = dbHash === chainHash
          ? VERIFICATION_STATUS.DOCUMENT_HASH_MATCH
          : VERIFICATION_STATUS.DOCUMENT_HASH_MISMATCH;
      } else if (!dbHash) {
        documentHashStatus = VERIFICATION_STATUS.DOCUMENT_HASH_NOT_AVAILABLE;
      }

      // E. Event reference comparison.
      if (latestApprovedEvent && outbox?.payload?.registryRecordReference) {
        const expectedReference = computeRegistryRecordReference(
          latestRegistration ? 'registration' : 'transfer',
          latestApprovedEvent.id
        );
        eventReferenceStatus = normalizeReference(expectedReference) === normalizeReference(outbox.payload.registryRecordReference)
          ? VERIFICATION_STATUS.EVENT_REFERENCE_MATCH
          : VERIFICATION_STATUS.EVENT_REFERENCE_MISMATCH;
      }
    } catch {
      // Blockchain unavailable — do not fabricate verification.
      blockchainStatus = VERIFICATION_STATUS.BLOCKCHAIN_FAILED;
      onChain = null;
    }

    const verification = {
      registryApprovalStatus,
      blockchainStatus,
      documentHashStatus,
      eventReferenceStatus,
      // Convenience booleans for the frontend.
      isRegistryApproved: registryApprovalStatus === VERIFICATION_STATUS.REGISTRY_APPROVED,
      isBlockchainConfirmed: blockchainStatus === VERIFICATION_STATUS.BLOCKCHAIN_CONFIRMED,
      isDocumentHashMatch: documentHashStatus === VERIFICATION_STATUS.DOCUMENT_HASH_MATCH,
      isEventReferenceMatch: eventReferenceStatus === VERIFICATION_STATUS.EVENT_REFERENCE_MATCH,
      // Explicit warning: blockchain confirmation is not legal proof of ownership.
      note: 'Blockchain confirmation verifies that an approved registry event was immutably recorded. It does not establish or reverse legal ownership.',
    };

    return sendSuccess(res, {
      data: {
        parcelNumber,
        // A. Official registry ownership (authoritative — from MariaDB).
        registry: parcel
          ? {
              id: parcel.id,
              parcelNumber: parcel.parcelNumber,
              status: parcel.status,
              owner: currentOwner,
              document: currentDocument,
              latestRegistration: latestRegistration
                ? {
                    id: latestRegistration.id,
                    status: latestRegistration.status,
                    reviewedBy: latestRegistration.reviewer,
                    reviewedAt: latestRegistration.reviewedAt,
                  }
                : null,
              latestTransfer: latestTransfer
                ? {
                    id: latestTransfer.id,
                    status: latestTransfer.status,
                    reviewedBy: latestTransfer.reviewer,
                    reviewedAt: latestTransfer.reviewedAt,
                  }
                : null,
            }
          : null,
        // C/D/E. Blockchain verification (evidence only — not legal title).
        blockchain: {
          onChain,
          transactionHash: blockchainTxHash,
          confirmedAt: blockchainConfirmedAt,
          status: blockchainStatus,
        },
        verification,
      },
      message: 'Parcel verification',
    });
  })
);

function normalizeReference(value) {
  return String(value || '').toLowerCase();
}

export default router;
