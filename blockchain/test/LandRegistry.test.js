const assert = require('node:assert/strict');
const { ethers } = require('hardhat');

describe('LandRegistry', function () {
  async function deploy() {
    const [admin, registrar, alice, bob] = await ethers.getSigners();
    const factory = await ethers.getContractFactory('LandRegistry');
    const contract = await factory.deploy();
    await contract.waitForDeployment();
    await contract.setRegistrar(registrar.address, true);
    return { contract, admin, registrar, alice, bob };
  }

  it('records a registration-approved event without declaring a legal owner', async function () {
    const { contract, registrar } = await deploy();
    const hash = ethers.keccak256(ethers.toUtf8Bytes('doc-v1'));
    const reference = ethers.keccak256(ethers.toUtf8Bytes('registration:1'));
    await contract.connect(registrar).recordRegistryEvent(
      'NAIROBI/BLOCK103/45',
      reference,
      hash,
      1 // EventType.RegistrationApproved
    );
    const parcel = await contract.getParcel('NAIROBI/BLOCK103/45');
    assert.equal(parcel[0], 'NAIROBI/BLOCK103/45');
    assert.equal(parcel.status, 1n); // Registered
    assert.equal(parcel.exists, true);

    const recorded = await contract.isEventRecorded('NAIROBI/BLOCK103/45', reference);
    assert.equal(recorded, true);
  });

  it('records a transfer-approved event without transferring legal title on-chain', async function () {
    const { contract, registrar } = await deploy();
    const hash = ethers.keccak256(ethers.toUtf8Bytes('doc-v1'));
    const regReference = ethers.keccak256(ethers.toUtf8Bytes('registration:1'));
    const transferReference = ethers.keccak256(ethers.toUtf8Bytes('transfer:1'));
    await contract.connect(registrar).recordRegistryEvent(
      'MOMBASA/BLOCK12/8',
      regReference,
      hash,
      1 // RegistrationApproved
    );
    await contract.connect(registrar).recordRegistryEvent(
      'MOMBASA/BLOCK12/8',
      transferReference,
      hash,
      2 // TransferApproved
    );
    const parcel = await contract.getParcel('MOMBASA/BLOCK12/8');
    assert.equal(parcel.exists, true);

    const recorded = await contract.isEventRecorded('MOMBASA/BLOCK12/8', transferReference);
    assert.equal(recorded, true);
  });

  it('prevents duplicate recording of the same registry event reference', async function () {
    const { contract, registrar } = await deploy();
    const hash = ethers.keccak256(ethers.toUtf8Bytes('doc-v1'));
    const reference = ethers.keccak256(ethers.toUtf8Bytes('registration:1'));
    await contract.connect(registrar).recordRegistryEvent('X/1/1', reference, hash, 1);
    await assert.rejects(
      contract.connect(registrar).recordRegistryEvent('X/1/1', reference, hash, 1),
      /already recorded/
    );
  });

  it('rejects non-registrars from recording events', async function () {
    const { contract, alice } = await deploy();
    const hash = ethers.keccak256(ethers.toUtf8Bytes('doc-v1'));
    const reference = ethers.keccak256(ethers.toUtf8Bytes('registration:1'));
    await assert.rejects(
      contract.connect(alice).recordRegistryEvent('X/1/1', reference, hash, 1)
    );
  });

  it('does not provide any function that grants ownership by supplying an address', async function () {
    const { contract, registrar } = await deploy();
    // The contract has no registerParcel(address owner) or transferOwnership(address newOwner).
    // Verify that getParcel does not return a currentOwner field.
    const hash = ethers.keccak256(ethers.toUtf8Bytes('doc-v1'));
    const reference = ethers.keccak256(ethers.toUtf8Bytes('registration:1'));
    await contract.connect(registrar).recordRegistryEvent('Y/2/2', reference, hash, 1);
    const parcel = await contract.getParcel('Y/2/2');
    // The return has 4 fields: parcelReference, status, updatedAt, exists — no owner.
    assert.equal(parcel.length, 4);
    assert.equal(parcel.exists, true);
  });
});
