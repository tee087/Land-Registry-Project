# API reference

Base path: `/api`. All responses use the standard envelope defined in
`src/utils/responseHandler.js`. Send access tokens as
`Authorization: Bearer <accessToken>`. Every response includes an `X-Request-ID`
header.

Success:

```json
{ "success": true, "message": "...", "data": {}, "meta": {}, "requestId": "...", "timestamp": "..." }
```

Error:

```json
{ "success": false, "message": "...", "error": { "code": "...", "details": {} }, "requestId": "...", "timestamp": "..." }
```

## Health

| Method | Path | Access |
|---|---|---|
| GET | `/health` | Public; reports `ok`/`degraded` plus DB check (503 when DB is down) |
| GET | `/health/live` | Public; liveness only, never touches the database |
| GET | `/health/ready` | Public; readiness, 503 when the database is unreachable |

## Authentication

| Method | Path | Access |
|---|---|---|
| POST | `/auth/register` | Public; always creates `landowner`; rate limited |
| POST | `/auth/login` | Public; email verification required in production; privileged roles use TOTP MFA |
| POST | `/auth/verify-email` | Public; consumes one-time verification token |
| POST | `/auth/email-verification/request` | Public; generic resend response; rate limited |
| POST | `/auth/password-reset/request` | Public; generic response; rate limited |
| POST | `/auth/password-reset/confirm` | Public; one-time token; revokes refresh sessions |
| POST | `/auth/mfa/setup` | Authenticated privileged account; password recheck |
| POST | `/auth/mfa/enable` | Authenticated privileged account; verifies six-digit TOTP |
| POST | `/auth/refresh` | Public; rotates refresh token; rate limited |
| POST | `/auth/logout` | Public; revokes supplied refresh token |
| GET | `/auth/me` | Authenticated |

Registration body:

```json
{ "fullName": "Jane Doe", "email": "jane@example.test", "phone": "+254700000000", "password": "StrongPass123" }
```

Phone is optional. Password requires at least 10 characters with uppercase,
lowercase and a number. Login body: `{ "email", "password", "mfaCode?" }`.
Refresh/logout body: `{ "refreshToken": "..." }`.

## Users

| Method | Path | Access |
|---|---|---|
| GET | `/users/me` | Authenticated |
| PATCH | `/users/me` | Authenticated; `fullName`, `phone`, `walletAddress`; audited |
| GET | `/users/lookup?email=jane@example.test` | Authenticated; exact-email lookup of an active user for transfer recipients |
| GET | `/users?page=1&limit=20` | Administrator; includes `walletAddress` |
| PATCH | `/users/:id/status` | Administrator; `active`, `suspended` or `disabled`; audited and notifies the user |

Role assignment is not exposed through the API. Administrators cannot deactivate
their own account. Profile and status changes are written to the audit trail; status
changes also create an in-app notification for the affected account.

## Roles

| Role | Main permissions |
|---|---|
| `landowner` | own profile, `registration:create`, `transfer:create`, `document:create`, own reads |
| `registrar` | `land:read/create/update`, `registration:read/review`, `transfer:read/review`, `document:read/verify` |
| `administrator` | `*` (all endpoints) |
| `investigator` | `land:read`, `investigation:read/update`, `document:read:case` |
| `auditor` | `audit:read`, `land:read`, `registration:read`, `transfer:read` |

The permission map is centralized in `src/middleware/authorize.js`. Routes also apply
resource-level checks (for example, parcel ownership).

## Parcels

| Method | Path | Access |
|---|---|---|
| GET | `/parcels?page=&limit=&status=&county=` | Authenticated; users without `land:read` see only current parcels they own |
| GET | `/parcels/search?q=NAIROBI/BLOCK103/45` | Authenticated; exact parcel-number match |
| GET | `/parcels/:id` | Authenticated; owner or `land:read` |
| GET | `/parcels/:id/ownerships` | Authenticated; owner or `land:read`; history, current first |
| POST | `/parcels` | `land:create` (registrar/administrator) |
| PATCH | `/parcels/:id` | `land:update` (registrar/administrator) |
| POST | `/parcels/:id/freeze` | `land:update` (registrar/administrator) |

Create body:

```json
{ "parcelNumber": "NAIROBI/BLOCK103/45", "county": "Nairobi", "block": "BLOCK103",
  "location": "Kasarani", "areaHectares": 0.5, "latitude": -1.23, "longitude": 36.82 }
```

`parcelNumber` is normalized to uppercase and must be unique. `parcelNumber` and
`county` are required. Parcel status is one of `active`, `frozen`, `disputed`,
`archived`. Freeze body: `{ "frozen": true, "reason": "..." }` (omit `frozen` or set
`false` to unfreeze). Freeze/unfreeze runs in a transaction, is idempotent (a no-op
returns the current status without a second audit/outbox entry), and enqueues a
blockchain outbox entry only when the status actually changes.

PATCH accepts `county`, `block`, `location`, `areaHectares`, `latitude`, `longitude`,
`status`.

## Registrations

| Method | Path | Access |
|---|---|---|
| POST | `/registrations` | `registration:create` (landowner) |
| GET | `/registrations?status=` | Authenticated; users without `registration:read` see only their own |
| GET | `/registrations/:id` | Applicant or `registration:read` |
| POST | `/registrations/:id/review` | `registration:review` (registrar/administrator) |

Create body: `{ "parcelId": 1 }`. A parcel that is `frozen` or `archived` cannot be
registered, and a user cannot have two pending registrations for the same parcel.

Review body: `{ "decision": "approve" | "reject", "notes": "..." }`. Approval marks
the registration `approved`, creates a current 100% ownership record for the applicant
(if none exists), sets the parcel to `active`, enqueues a blockchain outbox entry and
notifies the applicant.

Approval re-checks the parcel and applicant inside the transaction. It rejects a
parcel that became `frozen`/`archived`, an applicant whose account is no longer
`active` (`APPLICANT_INACTIVE`), and a parcel that already has a different current
owner (`PARCEL_ALREADY_OWNED`). A rejected approval rolls back the registration
decision, so the request remains reviewable.

## Transfers

| Method | Path | Access |
|---|---|---|
| POST | `/transfers` | `transfer:create` (current owner) |
| GET | `/transfers?status=` | Authenticated; users without `transfer:read` see transfers they sent/received/initiated |
| GET | `/transfers/:id` | Transfer participant or `transfer:read` |
| POST | `/transfers/:id/review` | `transfer:review` (registrar/administrator) |

Create body: `{ "parcelId": 1, "toOwnerId": 2, "notes": "..." }`. The caller must be
the current owner; the recipient must exist and be `active`; frozen/disputed parcels
cannot be transferred, and a second pending transfer for the same parcel is rejected
with `TRANSFER_PENDING`.

Review body: `{ "decision": "approve" | "reject", "notes": "..." }`. Approval ends the
sender's current ownership, creates a current 100% ownership record for the recipient,
enqueues a blockchain outbox entry and notifies both parties. Approval re-checks the
parcel status (`PARCEL_LOCKED` for frozen/disputed/archived), the sender's current
ownership (`NOT_CURRENT_OWNER`), the recipient account (`INVALID_RECIPIENT`) and that
the recipient does not already own the parcel (`RECIPIENT_ALREADY_OWNER`).

The outbox payload contains `ownerAddress` and `toAddress` set to the recipient's
wallet address and `fromAddress` set to the sender's wallet address. Database user IDs
are never used as on-chain addresses.

Current limitation: joint-ownership share validation and multi-owner approval rules
are not implemented yet; workflows currently settle 100% ownership.

## Documents

| Method | Path | Access |
|---|---|---|
| POST | `/parcels/:id/documents/upload-url` | `document:create` **and** current ownership of the parcel |
| POST | `/parcels/:id/documents/complete` | Same; verifies the signed object upload before recording it |
| POST | `/registrations/:id/documents/upload-url` | `document:create` **and** applicant ownership |
| POST | `/registrations/:id/documents/complete` | Same; verifies the signed object upload before recording it |
| GET | `/parcels/:id/documents` | `document:read`, `document:read:case`, or current ownership |
| GET | `/documents/:id` | `document:read`, `document:read:case`, uploader, or parcel owner |
| GET | `/documents/:id/download-url` | Same resource-level access; returns a 60-second signed URL |
| POST | `/documents/:id/verify` | Same resource-level access as `GET /documents/:id` |

The frontend computes SHA-256, requests a signed upload URL with `originalName`,
`mimeType`, `sizeBytes`, and base64 `sha256`, uploads the file directly to private
object storage, then sends those fields plus `storageKey` to `/complete`. Production
accepts PDF, JPEG, PNG, and TIFF files up to 10 MB. Signed URLs are short-lived and
the server checks the provider checksum before saving a document record.

Local development without object storage can use the compatibility upload route with
a small base64 body:

```json
{ "originalName": "title.pdf", "mimeType": "application/pdf", "contentBase64": "<base64 or data URL>" }
```

Local compatibility uploads are stored under a random `storageKey` in `UPLOAD_DIR`.
Production disables this route and requires direct object-storage uploads. Uploading
the same filename again creates a new version and marks the previous one `isCurrent: false`.

Verify re-hashes the stored file and returns:

```json
{ "documentId": 1, "expected": "<sha256>", "actual": "<sha256>", "matches": true }
```

A match proves byte equality with the recorded digest, not legal authenticity.

## Evidence and custody

| Method | Path | Access |
|---|---|---|
| POST | `/evidence` | `investigation:update` (investigator/administrator) |
| GET | `/evidence` | `investigation:read` |
| GET | `/evidence/:id` | `investigation:read`; includes custody history |
| POST | `/evidence/:id/custody` | `investigation:update` |

Create body: `{ "description": "...", "parcelId": 1 }` (`parcelId` optional). The server
generates a `custodyRef` (`EVD-<uuid>`) and records the initial `collected` custody
event.

Custody body: `{ "action": "...", "notes": "...", "status": "collected" | "in_custody" | "analyzed" | "released" }`.
`action` is required; `status` is optional.

## Audit logs

| Method | Path | Access |
|---|---|---|
| GET | `/audit-logs?page=&limit=&entityType=&entityId=&actorId=&action=` | `audit:read` (auditor/administrator) |

Audit records include actor, action, entity type/id, request ID, IP, JSON metadata and
timestamp. Domain operations write audit entries through `src/services/audit.service.js`.

## Notifications

| Method | Path | Access |
|---|---|---|
| GET | `/notifications?unread=true` | Authenticated; own notifications only |
| POST | `/notifications/read-all` | Authenticated; marks all own notifications read |
| POST | `/notifications/:id/read` | Authenticated; own notification only |

Notifications are created in-app by registration and transfer review operations and
by administrator account-status changes. Email/SMS delivery is not implemented.

## Blockchain

| Method | Path | Access |
|---|---|---|
| GET | `/blockchain/status` | Administrator; reports configuration flags, status counts and the last failure |
| GET | `/blockchain/transactions?page=&limit=&status=&entityType=&action=` | Administrator; outbox/transaction records |
| GET | `/blockchain/transactions/:id` | Administrator; one outbox/transaction record |
| POST | `/blockchain/transactions/:id/retry` | Administrator; resets the retry budget and requeues a non-confirmed event (audited) |
| GET | `/blockchain/parcels/:parcelNumber` | Administrator, registrar or auditor; compares on-chain and database owner, digest and status |

Statuses: `pending`, `submitted`, `confirmed`, `failed`. Outbox entries are written by
approved registration/transfer reviews and parcel freeze/unfreeze operations. A
separate worker (`npm run blockchain:worker`) submits them and a listener
(`npm run blockchain:listener`) reconciles events. The worker records `txHash`,
`blockNumber` and `confirmedAt` only after a successful receipt; a database approval is
never presented as a chain confirmation.

Live anchoring requires `BLOCKCHAIN_RPC_URL`, `BLOCKCHAIN_CONTRACT_ADDRESS` and
`BLOCKCHAIN_PRIVATE_KEY` (plus an optional `BLOCKCHAIN_CHAIN_ID`). Without them the
outbox still accepts events, `/blockchain/status` reports `configured: false`, the
worker/listener exit, and on-chain reads return `503 BLOCKCHAIN_NOT_CONFIGURED`.

## CORS and rate limiting

CORS allows only origins listed in `CORS_ORIGINS` (plus non-browser requests without an
`Origin` header). The global limit is controlled by `RATE_LIMIT_WINDOW_MS` and
`RATE_LIMIT_MAX`; auth routes have an additional 10-requests-per-15-minutes limiter.
