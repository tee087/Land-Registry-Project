import User from './User.js';
import RefreshToken from './RefreshToken.js';
import LandParcel from './LandParcel.js';
import Ownership from './Ownership.js';
import Registration from './Registration.js';
import Transfer from './Transfer.js';
import Document from './Document.js';
import AuditLog from './AuditLog.js';
import Notification from './Notification.js';
import Evidence from './Evidence.js';
import EvidenceCustody from './EvidenceCustody.js';
import ForensicFinding from './ForensicFinding.js';
import BlockchainTransaction from './BlockchainTransaction.js';

// User / RefreshToken associations are already declared in RefreshToken.js.

// Parcels
LandParcel.belongsTo(User, { foreignKey: 'registeredBy', as: 'registeredByUser' });
LandParcel.hasMany(Ownership, { foreignKey: 'parcelId', as: 'ownerships' });
LandParcel.hasMany(Registration, { foreignKey: 'parcelId', as: 'registrations' });
LandParcel.hasMany(Transfer, { foreignKey: 'parcelId', as: 'transfers' });
LandParcel.hasMany(Document, { foreignKey: 'parcelId', as: 'documents' });
LandParcel.hasMany(Evidence, { foreignKey: 'parcelId', as: 'evidence' });

// Ownership
Ownership.belongsTo(LandParcel, { foreignKey: 'parcelId', as: 'parcel' });
Ownership.belongsTo(User, { foreignKey: 'ownerId', as: 'owner' });

// Registrations
Registration.belongsTo(LandParcel, { foreignKey: 'parcelId', as: 'parcel' });
Registration.belongsTo(User, { foreignKey: 'applicantId', as: 'applicant' });
Registration.belongsTo(User, { foreignKey: 'reviewedBy', as: 'reviewer' });

// Transfers
Transfer.belongsTo(LandParcel, { foreignKey: 'parcelId', as: 'parcel' });
Transfer.belongsTo(User, { foreignKey: 'fromOwnerId', as: 'fromOwner' });
Transfer.belongsTo(User, { foreignKey: 'toOwnerId', as: 'toOwner' });
Transfer.belongsTo(User, { foreignKey: 'initiatedBy', as: 'initiator' });
Transfer.belongsTo(User, { foreignKey: 'reviewedBy', as: 'reviewer' });

// Documents / audit / notifications
Document.belongsTo(LandParcel, { foreignKey: 'parcelId', as: 'parcel' });
Document.belongsTo(Registration, { foreignKey: 'registrationId', as: 'registration' });
Document.belongsTo(User, { foreignKey: 'uploadedBy', as: 'uploader' });
AuditLog.belongsTo(User, { foreignKey: 'actorId', as: 'actor' });
Notification.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Evidence
Evidence.belongsTo(LandParcel, { foreignKey: 'parcelId', as: 'parcel' });
Evidence.belongsTo(User, { foreignKey: 'collectedBy', as: 'collector' });
Evidence.hasMany(EvidenceCustody, { foreignKey: 'evidenceId', as: 'custody' });
Evidence.hasMany(ForensicFinding, { foreignKey: 'evidenceId', as: 'findings' });
EvidenceCustody.belongsTo(Evidence, { foreignKey: 'evidenceId', as: 'evidence' });
EvidenceCustody.belongsTo(User, { foreignKey: 'actorId', as: 'actor' });

// Forensic findings
ForensicFinding.belongsTo(Evidence, { foreignKey: 'evidenceId', as: 'evidence' });
ForensicFinding.belongsTo(LandParcel, { foreignKey: 'parcelId', as: 'parcel' });
ForensicFinding.belongsTo(User, { foreignKey: 'recordedBy', as: 'recorder' });

export {
  User,
  RefreshToken,
  LandParcel,
  Ownership,
  Registration,
  Transfer,
  Document,
  AuditLog,
  Notification,
  Evidence,
  EvidenceCustody,
  ForensicFinding,
  BlockchainTransaction,
};
