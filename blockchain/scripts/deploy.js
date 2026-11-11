const hre = require('hardhat');

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const factory = await hre.ethers.getContractFactory('LandRegistry');
  const contract = await factory.deploy();
  await contract.waitForDeployment();

  console.log(`LandRegistry deployed to: ${await contract.getAddress()}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log('Set BLOCKCHAIN_CONTRACT_ADDRESS in the backend environment to the address above.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
