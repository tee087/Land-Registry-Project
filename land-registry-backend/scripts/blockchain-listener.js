import { ethers } from 'ethers';
import { Op } from 'sequelize';

import { sequelize } from '../src/config/database.js';
import BlockchainTransaction from '../src/models/BlockchainTransaction.js';
import { blockchainConfig, isBlockchainConfigured } from '../src/services/blockchain.service.js';
import { LAND_REGISTRY_ABI } from '../src/services/landRegistryAbi.js';

async function main() {
  if (!isBlockchainConfigured()) {
    console.log('[blockchain-listener] BLOCKCHAIN_RPC_URL/ADDRESS/PRIVATE_KEY not set; nothing to do.');
    return;
  }

  const provider = new ethers.JsonRpcProvider(blockchainConfig.rpcUrl);
  const contract = new ethers.Contract(blockchainConfig.contractAddress, LAND_REGISTRY_ABI, provider);

  const markConfirmed = async (log) => {
    const txHash = log?.transactionHash;
    if (!txHash) return;
    try {
      await BlockchainTransaction.update(
        {
          status: 'confirmed',
          blockNumber: log.blockNumber ?? null,
          confirmedAt: new Date(),
          nextAttemptAt: null,
          lastError: null,
        },
        { where: { txHash, status: { [Op.ne]: 'confirmed' } } }
      );
    } catch {
      // Ignore reconciliation errors; the worker remains the source of truth.
    }
  };

  contract.on('ParcelRegistered', (parcelKey, parcelNumber, owner, documentHash, event) => {
    console.log(`[blockchain-listener] ParcelRegistered ${parcelNumber} owner=${owner} hash=${documentHash}`);
    markConfirmed(event?.log);
  });

  contract.on('OwnershipTransferred', (parcelKey, from, to, documentHash, event) => {
    console.log(`[blockchain-listener] OwnershipTransferred ${parcelKey} from=${from} to=${to}`);
    markConfirmed(event?.log);
  });

  contract.on('ParcelStatusChanged', (parcelKey, status, event) => {
    console.log(`[blockchain-listener] ParcelStatusChanged ${parcelKey} status=${status}`);
    markConfirmed(event?.log);
  });

  console.log('[blockchain-listener] Listening for LandRegistry events...');

  const shutdown = async () => {
    await contract.removeAllListeners();
    await provider.destroy();
    await sequelize.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error('[blockchain-listener] Fatal:', error);
  process.exitCode = 1;
});
