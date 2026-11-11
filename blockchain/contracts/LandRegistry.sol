// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title LandRegistry
 * @notice Tamper-evident on-chain ledger for approved land-registry events.
 *
 * DESIGN PRINCIPLE:
 *   This contract does NOT determine, grant, transfer, or declare legal
 *   ownership of land. Legal ownership is established exclusively by the
 *   authorized land registration process running off-chain (backend +
 *   MariaDB). This contract merely records approved registry events:
 *   a parcel reference, an opaque registry record reference, a document
 *   digest, and an event type. It provides tamper-evident history,
 *   document integrity verification, and audit trails.
 *
 *   Only opaque references and cryptographic document hashes are stored
 *   on-chain. Personal data remains in MySQL. No wallet address is ever
 *   used to establish land ownership.
 */
contract LandRegistry {
    // Event types recorded on-chain.
    // 0 = Unknown, 1 = RegistrationApproved, 2 = TransferApproved,
    // 3 = DocumentAnchored, 4 = ParcelStatusChanged
    enum EventType {
        Unknown,
        RegistrationApproved,
        TransferApproved,
        DocumentAnchored,
        ParcelStatusChanged
    }

    enum ParcelStatus {
        Unknown,
        Registered,
        Frozen,
        Disputed,
        Archived
    }

    struct Parcel {
        string parcelReference;        // e.g. parcel number (opaque reference)
        ParcelStatus status;
        uint256 updatedAt;
        bool exists;
    }

    // Records an anchored registry event so the same registry record
    // cannot be recorded twice for the same parcel.
    struct RegistryEvent {
        bytes32 registryRecordReference; // keccak256("registration:<id>") etc.
        bytes32 documentHash;
        EventType eventType;
        uint256 recordedAt;
    }

    address public admin;
    mapping(address => bool) public registrars;
    mapping(string => Parcel) private parcels;
    // parcelReference => registryRecordReference => whether already recorded
    mapping(string => mapping(bytes32 => bool)) private eventRecorded;

    event RegistryEventRecorded(
        string indexed parcelReference,
        bytes32 indexed registryRecordReference,
        EventType eventType,
        bytes32 documentHash,
        uint256 recordedAt
    );
    event ParcelStatusChanged(
        string indexed parcelReference,
        ParcelStatus status,
        uint256 recordedAt
    );
    event RegistrarUpdated(address indexed registrar, bool allowed);

    modifier onlyAdmin() {
        require(msg.sender == admin, "LandRegistry: not admin");
        _;
    }

    modifier onlyRegistrar() {
        require(msg.sender == admin || registrars[msg.sender], "LandRegistry: not registrar");
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    function setRegistrar(address registrar, bool allowed) external onlyAdmin {
        registrars[registrar] = allowed;
        emit RegistrarUpdated(registrar, allowed);
    }

    /**
     * @notice Record an approved registry event on-chain.
     * @dev This does NOT change legal ownership. It anchors an event that
     *      was already approved by the authorized off-chain registry process.
     *      Duplicate (parcelReference, registryRecordReference) pairs are
     *      rejected to prevent double-recording.
     */
    function recordRegistryEvent(
        string calldata parcelReference,
        bytes32 registryRecordReference,
        bytes32 documentHash,
        EventType eventType
    ) external onlyRegistrar {
        require(registryRecordReference != bytes32(0), "LandRegistry: zero reference");
        require(documentHash != bytes32(0), "LandRegistry: zero document hash");
        require(eventType != EventType.Unknown, "LandRegistry: unknown event type");

        // Prevent duplicate recording of the same registry event.
        if (eventRecorded[parcelReference][registryRecordReference]) {
            revert("LandRegistry: registry event already recorded");
        }

        Parcel storage parcel = parcels[parcelReference];
        if (!parcel.exists) {
            parcel.parcelReference = parcelReference;
            parcel.status = ParcelStatus.Registered;
            parcel.updatedAt = block.timestamp;
            parcel.exists = true;
        }

        eventRecorded[parcelReference][registryRecordReference] = true;
        parcel.updatedAt = block.timestamp;

        emit RegistryEventRecorded(
            parcelReference,
            registryRecordReference,
            eventType,
            documentHash,
            block.timestamp
        );

        if (eventType == EventType.ParcelStatusChanged) {
            // For status-change events the caller may also call setParcelStatus
            // directly; this event just records that the status change was approved.
        }
    }

    /**
     * @notice Update parcel status (e.g. freeze/unfreeze/dispute/archive).
     * @dev Restricted to authorized registrars. This records a status change
     *      event; it does not transfer ownership.
     */
    function setParcelStatus(
        string calldata parcelReference,
        ParcelStatus status
    ) external onlyRegistrar {
        require(status != ParcelStatus.Unknown, "LandRegistry: unknown status");
        Parcel storage parcel = parcels[parcelReference];
        if (!parcel.exists) {
            parcel.parcelReference = parcelReference;
            parcel.status = status;
            parcel.updatedAt = block.timestamp;
            parcel.exists = true;
        } else {
            parcel.status = status;
            parcel.updatedAt = block.timestamp;
        }
        emit ParcelStatusChanged(parcelReference, status, block.timestamp);
    }

    /**
     * @notice Read a parcel's on-chain metadata. Read-only.
     */
    function getParcel(string calldata parcelReference)
        external
        view
        returns (
            string memory parcelReferenceOut,
            ParcelStatus status,
            uint256 updatedAt,
            bool exists
        )
    {
        Parcel storage parcel = parcels[parcelReference];
        return (parcel.parcelReference, parcel.status, parcel.updatedAt, parcel.exists);
    }

    /**
     * @notice Check whether a specific registry event has already been recorded.
     * @dev Read-only idempotency check used by the backend worker.
     */
    function isEventRecorded(string calldata parcelReference, bytes32 registryRecordReference)
        external
        view
        returns (bool)
    {
        return eventRecorded[parcelReference][registryRecordReference];
    }
}
