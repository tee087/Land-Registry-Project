// Minimal ABI for blockchain/contracts/LandRegistry.sol (kept in sync manually).
// NOTE: No owner/newOwner parameters. Legal ownership is established off-chain;
// the contract anchors approved registry events only.
export const LAND_REGISTRY_ABI = [
  'function recordRegistryEvent(string parcelReference, bytes32 registryRecordReference, bytes32 documentHash, uint8 eventType)',
  'function setParcelStatus(string parcelReference, uint8 status)',
  'function getParcel(string parcelReference) view returns (string parcelReference, uint8 status, uint256 updatedAt, bool exists)',
  'function isEventRecorded(string parcelReference, bytes32 registryRecordReference) view returns (bool)',
  'function setRegistrar(address registrar, bool allowed)',
  'event RegistryEventRecorded(string indexed parcelReference, bytes32 indexed registryRecordReference, uint8 eventType, bytes32 documentHash, uint256 recordedAt)',
  'event ParcelStatusChanged(string indexed parcelReference, uint8 status, uint256 recordedAt)',
  'event RegistrarUpdated(address indexed registrar, bool allowed)',
];

// EventType enum values (must match Solidity):
// 0 = Unknown, 1 = RegistrationApproved, 2 = TransferApproved,
// 3 = DocumentAnchored, 4 = ParcelStatusChanged
export const EVENT_TYPE = Object.freeze({
  Unknown: 0,
  RegistrationApproved: 1,
  TransferApproved: 2,
  DocumentAnchored: 3,
  ParcelStatusChanged: 4,
});

// ParcelStatus enum values (must match Solidity):
// 0 = Unknown, 1 = Registered, 2 = Frozen, 3 = Disputed, 4 = Archived
export const PARCEL_STATUS = Object.freeze({
  Unknown: 0,
  Registered: 1,
  Frozen: 2,
  Disputed: 3,
  Archived: 4,
});
