import { ethers } from 'ethers';

import BlockchainTransaction from '../models/BlockchainTransaction.js';
import { LAND_REGISTRY_ABI, EVENT_TYPE, PARCEL_STATUS } from './landRegistryAbi.js';
import { AppError } from '../utils/responseHandler.js';

// Re-export for consumers that import from this service barrel.
export { EVENT_TYPE, PARCEL_STATUS };

/**
 * Durable outbox entry for a future on-chain write. The API transaction and the
 * EVM transaction cannot be atomic, so approved domain events are queued here
 * and processed by scripts/blockchain-worker.js.
 */
export async function enqueueBlockchainEvent({ entityType, entityId, action, payload = null, transaction }) {
  // The outbox row is written in the same DB transaction as the domain change.
  // Let failures propagate so the domain change rolls back instead of being
  // committed with no durable on-chain work queued for it.
  return BlockchainTransaction.create(
    { entityType, entityId, action, payload, status: 'pending' },
    { transaction }
  );
}

export const blockchainConfig = Object.freeze({
  rpcUrl: process.env.BLOCKCHAIN_RPC_URL || '',
  contractAddress: process.env.BLOCKCHAIN_CONTRACT_ADDRESS || '',
  privateKey: process.env.BLOCKCHAIN_PRIVATE_KEY || '',
  chainId: process.env.BLOCKCHAIN_CHAIN_ID ? Number(process.env.BLOCKCHAIN_CHAIN_ID) : null,
});

export function isBlockchainConfigured() {
  return Boolean(blockchainConfig.rpcUrl && blockchainConfig.contractAddress && blockchainConfig.privateKey);
}

// The Solidity ParcelStatus enum order is Unknown, Registered, Frozen, Disputed, Archived.
export const ONCHAIN_PARCEL_STATUS = Object.freeze(['Unknown', 'Registered', 'Frozen', 'Disputed', 'Archived']);

export const DB_TO_ONCHAIN_STATUS = Object.freeze({
  active: 'Registered',
  frozen: 'Frozen',
  disputed: 'Disputed',
  archived: 'Archived',
});

export function onChainStatusLabel(value) {
  return ONCHAIN_PARCEL_STATUS[Number(value)] || 'Unknown';
}

// Verification statuses returned by the blockchain verification endpoint.
// These are separate from legal ownership; blockchain confirmation never
// establishes or reverses a registry decision.
export const VERIFICATION_STATUS = Object.freeze({
  REGISTRY_APPROVED: 'REGISTRY_APPROVED',
  REGISTRY_REJECTED: 'REGISTRY_REJECTED',
  REGISTRY_PENDING: 'REGISTRY_PENDING',
  BLOCKCHAIN_PENDING: 'BLOCKCHAIN_PENDING',
  BLOCKCHAIN_CONFIRMED: 'BLOCKCHAIN_CONFIRMED',
  BLOCKCHAIN_FAILED: 'BLOCKCHAIN_FAILED',
  DOCUMENT_HASH_MATCH: 'DOCUMENT_HASH_MATCH',
  DOCUMENT_HASH_MISMATCH: 'DOCUMENT_HASH_MISMATCH',
  DOCUMENT_HASH_NOT_AVAILABLE: 'DOCUMENT_HASH_NOT_AVAILABLE',
  EVENT_REFERENCE_MATCH: 'EVENT_REFERENCE_MATCH',
  EVENT_REFERENCE_MISMATCH: 'EVENT_REFERENCE_MISMATCH',
  EVENT_REFERENCE_NOT_AVAILABLE: 'EVENT_REFERENCE_NOT_AVAILABLE',
});

/**
 * Compute the opaque registry record reference used to anchor an approved
 * registration or transfer on-chain.
 *
 * @dev This is a one-way hash of the entity type and database id. It is
 *      NOT a wallet address and does NOT establish ownership. It simply
 *      provides an unforgeable reference to the approved off-chain record.
 */
export function computeRegistryRecordReference(entityType, entityId) {
  return ethers.keccak256(ethers.toUtf8Bytes(`${entityType}:${entityId}`));
}

/**
 * Read a parcel directly from the LandRegistry contract. Read-only, so only the
 * RPC URL and contract address are required (no private key).
 */
export async function readParcelOnChain(parcelReference) {
  if (!blockchainConfig.rpcUrl || !blockchainConfig.contractAddress) {
    throw new AppError('Blockchain reads are not configured (BLOCKCHAIN_RPC_URL / BLOCKCHAIN_CONTRACT_ADDRESS)', 503, 'BLOCKCHAIN_NOT_CONFIGURED');
  }

  const provider = new ethers.JsonRpcProvider(blockchainConfig.rpcUrl);
  try {
    const contract = new ethers.Contract(blockchainConfig.contractAddress, LAND_REGISTRY_ABI, provider);
    const result = await contract.getParcel(parcelReference);
    const statusCode = Number(result.status);
    return {
      parcelReference: result.parcelReference,
      statusCode,
      status: onChainStatusLabel(statusCode),
      updatedAt: Number(result.updatedAt),
      exists: Boolean(result.exists),
    };
  } catch (error) {
    const reason = error?.revert?.args?.[0] || error?.shortMessage || error?.message || 'unknown error';
    throw new AppError('Unable to read from the blockchain', 503, 'BLOCKCHAIN_UNAVAILABLE', {
      reason: String(reason).slice(0, 200),
    });
  } finally {
    provider.destroy();
  }
}

/**
 * Check whether a specific registry event has already been recorded on-chain.
 */
export async function isEventRecorded(parcelReference, registryRecordReference) {
  if (!blockchainConfig.rpcUrl || !blockchainConfig.contractAddress) {
    throw new AppError('Blockchain reads are not configured (BLOCKCHAIN_RPC_URL / BLOCKCHAIN_CONTRACT_ADDRESS)', 503, 'BLOCKCHAIN_NOT_CONFIGURED');
  }

  const provider = new ethers.JsonRpcProvider(blockchainConfig.rpcUrl);
  try {
    const contract = new ethers.Contract(blockchainConfig.contractAddress, LAND_REGISTRY_ABI, provider);
    return await contract.isEventRecorded(parcelReference, registryRecordReference);
  } catch (error) {
    throw new AppError('Unable to check blockchain event record', 503, 'BLOCKCHAIN_UNAVAILABLE', {
      reason: String(error?.message || error).slice(0, 200),
    });
  } finally {
    provider.destroy();
  }
}
