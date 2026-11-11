require('@nomicfoundation/hardhat-ethers');

const networks = {
  hardhat: {},
  localhost: {
    url: process.env.BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:8545',
  },
};

if (process.env.BLOCKCHAIN_RPC_URL && process.env.BLOCKCHAIN_PRIVATE_KEY) {
  networks.sepolia = {
    url: process.env.BLOCKCHAIN_RPC_URL,
    accounts: [process.env.BLOCKCHAIN_PRIVATE_KEY],
  };
}

module.exports = {
  solidity: {
    version: '0.8.24',
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks,
};
