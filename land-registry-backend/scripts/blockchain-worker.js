import { ethers } from 'ethers';
import { Op } from 'sequelize';

import { sequelize } from '../src/config/database.js';
import BlockchainTransaction from '../src/models/BlockchainTransaction.js';
import Registration from '../src/models/Registration.js';
import Transfer from '../src/models/Transfer.js';
import LandParcel from '../src/models/LandParcel.js';
import { blockchainConfig, isBlockchainConfigured, computeRegistryRecordReference, EVENT_TYPE, PARCEL_STATUS } from '../src/services/blockchain.service.js';
import { LAND_REGISTRY_ABI } from '../src/services/landRegistryAbi.js';

const MAX_ATTEMPTS = Math.max(1, Number.parseInt(process.env.BLOCKCHAIN_MAX_ATTEMPTS, 10) || 5);
const CONFIRMATION_TIMEOUT_MS = Math.max(5000, Number.parseInt(process.env.BLOCKCHAIN_CONFIRMATION_TIMEOUT_MS, 10) || 120000);
const CLAIM_WINDOW_MS = 5 * 60 * 1000;
const BACKOFF_BASE_MS = 30 * 1000;
const BACKOFF_MAX_MS = 30 * 60 * 1000;

/** A failure that retrying cannot fix (bad payload, unsupported action, chain conflict). */
class PermanentError extends Error {}

function toBytes32(hash) {
  if (!hash) throw new PermanentError('payload.documentHash is required');
  if (/^0x[0-9a-fA-F]{64}$/.test(hash)) return hash.toLowerCase();
  if (/^[0-9a-fA-F]{64}$/.test(hash)) return `0x${hash}`.toLowerCase();
  throw new PermanentError('payload.documentHash must be a 32-byte hex string (SHA-256)');
}

function requireFields(payload, fields) {
  for (const field of fields) {
    if (!payload?.[field]) throw new PermanentError(`payload.${field} is required`);
  }
}

function normalizeHash(value) {
  return String(value || '').toLowerCase();
}

function backoffFor(attempts) {
  const delay = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** Math.max(0, attempts - 1));
  return new Date(Date.now() + delay);
}

/**
 * Read a parcel's on-chain metadata. Returns exists=false when the parcel
 * is not yet anchored (not an error for registration events).
 */
async function readParcel(contract, parcelReference) {
  try {
    const result = await contract.getParcel(parcelReference);
    return {
      exists: Boolean(result.exists),
      parcelReference: result.parcelReference,
      statusCode: Number(result.status),
      status: Number(result.status) === PARCEL_STATUS.Registered ? 'Registered'
        : Number(result.status) === PARCEL_STATUS.Frozen ? 'Frozen'
        : Number(result.status) === PARCEL_STATUS.Disputed ? 'Disputed'
        : Number(result.status) === PARCEL_STATUS.Archived ? 'Archived'
        : 'Unknown',
      updatedAt: Number(result.updatedAt),
    };
  } catch (error) {
    const reason = error?.revert?.args?.[0] || error?.shortMessage || error?.message || '';
    if (String(reason).toLowerCase().includes('unknown parcel')) {
      return { exists: false };
    }
    throw error;
  }
}

/**
 * Verify that the domain record exists and is approved before anchoring.
 * The worker must never create or update Ownership records.
 */
async function verifyDomainRecord(entityType, entityId) {
  switch (entityType) {
    case 'registration': {
      const record = await Registration.findByPk(entityId);
      if (!record) throw new PermanentError(`Registration ${entityId} not found`);
      if (record.status !== 'approved') {
        throw new PermanentError(`Registration ${entityId} is not approved (status: ${record.status})`);
      }
      return record;
    }
    case 'transfer': {
      const record = await Transfer.findByPk(entityId);
      if (!record) throw new PermanentError(`Transfer ${entityId} not found`);
      if (record.status !== 'approved') {
        throw new PermanentError(`Transfer ${entityId} is not approved (status: ${record.status})`);
      }
      return record;
    }
    default:
      throw new PermanentError(`Unsupported entity type: ${entityType}`);
  }
}

/**
 * Check whether the intended effect already exists on chain. This makes the
 * worker idempotent when a previous run mined a transaction but crashed before
 * recording the confirmation, or when an operator retries a completed job.
 */
async function preflight(contract, tx) {
  const payload = tx.payload || {};
  switch (`${tx.entityType}:${tx.action}`) {
    case 'registration:approve':
    case 'transfer:approve': {
      requireFields(payload, ['parcelNumber', 'registryRecordReference', 'documentHash', 'eventType']);
      const reference = normalizeHash(payload.registryRecordReference);
      const hash = normalizeHash(toBytes32(payload.documentHash));
      const eventType = Number(payload.eventType);

      // Verify the domain record exists and is approved in the database.
      await verifyDomainRecord(tx.entityType, tx.entityId);

      const parcel = await readParcel(contract, payload.parcelNumber);
      const alreadyRecorded = await contract.isEventRecorded(payload.parcelNumber, reference);

      if (alreadyRecorded) {
        return { alreadyApplied: true, reason: 'Registry event already recorded on chain' };
      }
      return { alreadyApplied: false };
    }
    case 'parcel:freeze':
    case 'parcel:unfreeze': {
      requireFields(payload, ['parcelNumber']);
      const target = tx.action === 'freeze' ? PARCEL_STATUS.Frozen : PARCEL_STATUS.Registered;
      const parcel = await readParcel(contract, payload.parcelNumber);
      if (!parcel.exists) throw new PermanentError('Parcel is not registered on chain');
      if (parcel.statusCode === target) {
        return { alreadyApplied: true, reason: `Parcel is already ${parcel.status} on chain` };
      }
      return { alreadyApplied: false };
    }
    default:
      throw new PermanentError(`Unsupported outbox action: ${tx.entityType}:${tx.action}`);
  }
}

async function submit(contract, tx) {
  const payload = tx.payload || {};
  switch (`${tx.entityType}:${tx.action}`) {
    case 'registration:approve':
    case 'transfer:approve': {
      requireFields(payload, ['parcelNumber', 'registryRecordReference', 'documentHash', 'eventType']);
      return contract.recordRegistryEvent(
        payload.parcelNumber,
        payload.registryRecordReference,
        toBytes32(payload.documentHash),
        Number(payload.eventType)
      );
    }
    case 'parcel:freeze':
      return contract.setParcelStatus(payload.parcelNumber, PARCEL_STATUS.Frozen);
    case 'parcel:unfreeze':
      return contract.setParcelStatus(payload.parcelNumber, PARCEL_STATUS.Registered);
    default:
      throw new PermanentError(`Unsupported outbox action: ${tx.entityType}:${tx.action}`);
  }
}

async function markConfirmed(record, receipt = null) {
  record.status = 'confirmed';
  record.lastError = null;
  record.confirmedAt = new Date();
  record.nextAttemptAt = null;
  if (receipt) {
    record.blockNumber = receipt.blockNumber ?? record.blockNumber;
    if (receipt.transactionHash) record.txHash = receipt.transactionHash;
  }
  await record.save();
}

async function markRetryableFailure(record, message) {
  record.status = record.attempts >= MAX_ATTEMPTS ? 'failed' : 'pending';
  record.lastError = String(message || 'Unknown error').slice(0, 1000);
  record.nextAttemptAt = record.status === 'pending' ? backoffFor(record.attempts) : null;
  if (record.status === 'failed') record.txHash = null;
  await record.save();
}

async function markPermanentFailure(record, message) {
  record.status = 'failed';
  record.lastError = String(message || 'Unknown error').slice(0, 1000);
  record.nextAttemptAt = null;
  await record.save();
}

/** Reconcile a transaction that was already broadcast. Returns true when handled. */
async function reconcileSubmitted(provider, record) {
  if (!record.txHash) {
    record.status = 'pending';
    await record.save();
    return false;
  }

  const receipt = await provider.getTransactionReceipt(record.txHash);
  if (receipt) {
    if (receipt.status === 1) {
      await markConfirmed(record, receipt);
      console.log(`[blockchain-worker] ${record.entityType}:${record.action}#${record.id} -> confirmed (${record.txHash})`);
    } else {
      await markPermanentFailure(record, `Transaction reverted in block ${receipt.blockNumber}`);
      console.error(`[blockchain-worker] ${record.entityType}:${record.action}#${record.id} reverted (${record.txHash})`);
    }
    return true;
  }

  const transaction = await provider.getTransaction(record.txHash);
  if (!transaction) {
    record.status = 'pending';
    record.txHash = null;
    record.lastError = 'Previously submitted transaction is no longer available; will resubmit';
    record.nextAttemptAt = backoffFor(record.attempts);
    await record.save();
    return true;
  }

  record.lastError = 'Waiting for on-chain confirmation';
  record.nextAttemptAt = backoffFor(record.attempts);
  await record.save();
  return true;
}

async function processRecord(provider, contract, record) {
  if (record.status === 'submitted' || record.txHash) {
    const handled = await reconcileSubmitted(provider, record);
    if (handled) return;
  }

  record.attempts += 1;
  let preflightResult;
  try {
    preflightResult = await preflight(contract, record);
  } catch (error) {
    if (error instanceof PermanentError) {
      await markPermanentFailure(record, error.message);
      console.error(`[blockchain-worker] ${record.entityType}:${record.action}#${record.id} blocked: ${error.message}`);
    } else {
      await markRetryableFailure(record, error.message);
      console.error(`[blockchain-worker] ${record.entityType}:${record.action}#${record.id} preflight error: ${error.message}`);
    }
    return;
  }

  if (preflightResult.alreadyApplied) {
    await markConfirmed(record);
    console.log(`[blockchain-worker] ${record.entityType}:${record.action}#${record.id} -> confirmed (already applied: ${preflightResult.reason})`);
    return;
  }

  record.status = 'submitted';
  await record.save();

  let response;
  try {
    response = await submit(contract, record);
  } catch (error) {
    if (error instanceof PermanentError) {
      await markPermanentFailure(record, error.message);
      console.error(`[blockchain-worker] ${record.entityType}:${record.action}#${record.id} blocked: ${error.message}`);
    } else {
      await markRetryableFailure(record, error.message);
      console.error(`[blockchain-worker] ${record.entityType}:${record.action}#${record.id} submit failed: ${error.message}`);
    }
    return;
  }

  record.txHash = response.hash;
  record.lastError = null;
  record.nextAttemptAt = backoffFor(record.attempts);
  await record.save();

  try {
    const receipt = await response.wait(1, CONFIRMATION_TIMEOUT_MS);
    if (receipt && receipt.status === 1) {
      await markConfirmed(record, receipt);
      console.log(`[blockchain-worker] ${record.entityType}:${record.action}#${record.id} -> confirmed (${response.hash})`);
    } else {
      await markPermanentFailure(record, 'Transaction was not mined successfully');
      console.error(`[blockchain-worker] ${record.entityType}:${record.action}#${record.id} -> failed (${response.hash})`);
    }
  } catch (error) {
    record.status = 'submitted';
    record.lastError = `Awaiting confirmation: ${String(error.message || error).slice(0, 900)}`;
    record.nextAttemptAt = backoffFor(record.attempts);
    await record.save();
    console.log(`[blockchain-worker] ${record.entityType}:${record.action}#${record.id} submitted, awaiting confirmation (${response.hash})`);
  }
}

async function main() {
  if (!isBlockchainConfigured()) {
    console.log('[blockchain-worker] BLOCKCHAIN_RPC_URL/ADDRESS/PRIVATE_KEY not set; nothing to do.');
    return;
  }

  const provider = new ethers.JsonRpcProvider(blockchainConfig.rpcUrl);
  const wallet = new ethers.Wallet(blockchainConfig.privateKey, provider);
  const contract = new ethers.Contract(blockchainConfig.contractAddress, LAND_REGISTRY_ABI, wallet);

  const now = new Date();
  const candidates = await BlockchainTransaction.findAll({
    where: {
      status: { [Op.in]: ['pending', 'submitted'] },
      [Op.or]: [{ nextAttemptAt: null }, { nextAttemptAt: { [Op.lte]: now } }],
    },
    order: [['createdAt', 'ASC']],
    limit: 25,
  });

  console.log(`[blockchain-worker] Found ${candidates.length} transaction(s) due for processing`);

  let processed = 0;
  for (const candidate of candidates) {
    const [claimed] = await BlockchainTransaction.update(
      { nextAttemptAt: new Date(Date.now() + CLAIM_WINDOW_MS) },
      {
        where: {
          id: candidate.id,
          status: { [Op.in]: ['pending', 'submitted'] },
          [Op.or]: [{ nextAttemptAt: null }, { nextAttemptAt: { [Op.lte]: now } }],
        },
      }
    );
    if (!claimed) continue;

    const record = await BlockchainTransaction.findByPk(candidate.id);
    if (!record) continue;

    try {
      await processRecord(provider, contract, record);
      processed += 1;
    } catch (error) {
      await markRetryableFailure(record, error.message);
      console.error(`[blockchain-worker] ${record.entityType}:${record.action}#${record.id} unexpected error: ${error.message}`);
    }
  }

  console.log(`[blockchain-worker] Processed ${processed} transaction(s)`);
}

main()
  .catch((error) => {
    console.error('[blockchain-worker] Fatal:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
