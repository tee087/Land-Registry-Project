# LandRegistryChain — Supporting Services Audit (Phase 1)

> **Historical document.** This Phase 1 audit describes the archive as it was on
> 4 November 2026. Document storage/integrity, audit logging, in-app notifications,
> evidence custody and blockchain outbox processing have since been implemented.
> Email/SMS delivery, resource-level hardening beyond the current checks, and
> separate liveness/readiness monitoring remain incomplete. See
> [`../README.md`](../README.md) and [`API.md`](API.md) for current behaviour.

**Audit date:** 4 November 2026  
**Scope:** Phase 1 inspection and architecture planning only.  
**Source:** The supplied `land-registry-backend` project archive and the Supporting Services Master Prompt.  
**Important:** This report describes the files present in the supplied archive. It does not claim that the local MySQL database, external providers, or runtime environment were tested.

## 1. Executive summary

The backend has a usable Node.js 20+ / Express 4 / Sequelize / MySQL foundation, initial authentication and user modules, request correlation IDs, centralized error handling, global rate limiting, and a database health check.

The six Supporting Services areas in the Master Prompt are **not implemented as complete services** in this archive:

1. Document storage and management — not implemented.
2. SHA-256 document integrity verification — not implemented.
3. Audit logging and activity tracking — not implemented. Request IDs and HTTP request logging exist, but they are not an audit trail.
4. Notification service — not implemented.
5. File security and access control — only general API security and initial role permissions exist; document-level controls are absent.
6. Background processing and system monitoring — not implemented as a job/worker system. A basic database health endpoint exists.

The project should extend its existing structure rather than create a second application, duplicate database connection, or replace authentication. Phase 1 makes no application-code, schema, dependency, or frontend changes.

## 2. Existing foundation and reusable components

| Existing component | Evidence | Reuse in supporting services |
|---|---|---|
| Express application and API router | `src/app.js`, `src/routes/index.js` | Mount future supporting-service routers using existing conventions |
| MySQL / Sequelize connection | `src/config/database.js` | Reuse the single Sequelize instance and migration workflow |
| Sequelize CLI migrations | `database/config.cjs`, `database/migrations/` | Add schema changes through migrations, not `sequelize.sync()` |
| Environment validation/configuration | `src/config/environment.js`, `.env.example` | Add validated environment settings for storage, providers and workers |
| Authentication | `src/middleware/authenticate.js`, `src/modules/auth/` | Reuse existing JWT authentication |
| Role permissions | `src/middleware/authorize.js` | Extend existing permissions carefully; add resource-level checks in services |
| Request correlation ID | `src/app.js` | Reuse `req.id` to correlate audit events, jobs and API requests |
| Central error handling | `src/middleware/errorMiddleware.js` | Reuse standard error response behavior |
| Input validation | `src/middleware/validate.js`, Zod schemas | Validate new request payloads |
| Health endpoint | `src/routes/healthRoutes.js` | Extend with separate liveness, readiness and dependency checks |
| Automated test foundation | `test/foundation.test.js`, `node:test`, `supertest` | Extend the existing test runner and conventions |
| Ignore rules for uploads | `.gitignore` | Keep local uploaded files out of Git; production storage still needs design |

### Important boundaries

- The existing `src/config/database.js` exports the shared Sequelize instance. New modules should import it rather than instantiate another connection.
- Existing roles are `landowner`, `registrar`, `administrator`, `investigator`, and `auditor`. The Master Prompt's example roles must not be copied over the existing role model without a deliberate mapping.
- Role authorization alone does not establish access to a particular parcel, document, or investigation. Resource-level authorization is required.
- The current request ID is useful for correlation, but it is not proof that an audit record was durably stored.
- The existing SHA-256 use in `auth.service.js` hashes refresh tokens. It is not document hashing or document integrity verification.

## 3. Supporting Services implementation status

| Supporting service capability | Current status | Evidence / finding |
|---|---|---|
| Document upload | Not implemented | No upload middleware, document controller, service, model or route |
| Document storage adapter | Not implemented | No storage service or configured storage root/provider |
| Document metadata | Not implemented | No document model/table or migration |
| Parcel / application / transfer document association | Not implementable yet | Parcel, registration and transfer domain modules are absent |
| Document retrieval and secure download | Not implemented | No document routes or resource-level document authorization |
| Document versioning | Not implemented | No document/version model |
| Document lifecycle/status transitions | Not implemented | No document workflow |
| SHA-256 file hashing | Not implemented | No document hash service; current refresh-token hashing is unrelated |
| Document verification/history | Not implemented | No verification service/model/route |
| Blockchain document anchoring | Not implemented | No blockchain integration; blockchain report already records this |
| Central audit event service | Not implemented | No audit model, table, service or API |
| Audit search/export | Not implemented | No audit routes or retrieval service |
| Tamper-evident audit chain | Not implemented | No audit hash-chain implementation |
| In-app notifications | Not implemented | No notification model/table/routes |
| Email delivery | Not implemented | No email provider adapter/configuration |
| SMS delivery | Not implemented | No SMS provider adapter/configuration |
| Notification preferences/delivery tracking | Not implemented | No related models or routes |
| Background job queue | Not implemented | No queue, job model, scheduler or worker |
| Retry/dead-letter handling | Not implemented | No job lifecycle or retry mechanism |
| Liveness endpoint | Not separately implemented | Existing `/api/health` is a combined service/database check |
| Readiness endpoint | Not separately implemented | No readiness route |
| Dependency monitoring | Minimal | Health route checks MySQL only |
| Storage/RPC/provider/worker monitoring | Not implemented | No corresponding dependencies or checks |
| Forensic evidence registration/custody | Not implemented | No evidence module, custody model or routes |

## 4. Current project structure relevant to the work

```text
land-registry-backend/
├── src/
│   ├── config/          # environment, database, CORS
│   ├── middleware/      # auth, authorization, validation, errors
│   ├── models/          # User, RefreshToken
│   ├── modules/
│   │   ├── auth/
│   │   └── users/
│   ├── routes/          # health and route registry
│   ├── utils/           # response handler, async handler
│   ├── app.js
│   └── server.js
├── database/
│   ├── migrations/      # initial users and refresh-token migration
│   ├── seeders/
│   ├── config.cjs
│   └── setup.sql
├── docs/
├── scripts/
├── test/
├── package.json
└── README.md
```

There are no `documents`, `integrity`, `audit`, `notifications`, `forensic-evidence`, `jobs`, or `workers` modules in the supplied archive.

## 5. Dependencies and infrastructure assessment

The current `package.json` already includes Express, Sequelize, MySQL2, Zod, Helmet, CORS, Morgan, express-rate-limit, dotenv, node:test (built into Node), and Supertest.

The following capabilities are not currently represented by installed project dependencies or configured infrastructure:

| Capability | Phase 1 finding | Phase 2 decision required |
|---|---|---|
| Multipart upload | No upload package is listed | Select a maintained streaming/multipart approach compatible with Node 20 and Express 4 |
| File signature inspection | No file-type inspection package is listed | Select a maintained magic-byte detector; do not trust extension/MIME alone |
| Malware scanning | No scanner configured | Decide whether local development uses an optional adapter and what scanner is available in deployment |
| Email | No provider library/configuration | Choose provider-neutral adapter and development test strategy |
| SMS | No provider library/configuration | Choose provider-neutral adapter and Kenya-compatible provider later |
| Queue/background work | No queue dependency or worker entry point | Decide whether a MySQL-backed queue is sufficient for this prototype or a separate queue is justified |
| Encryption at rest | No file-encryption service or key-management integration | Define threat model, key storage, rotation and recovery before implementation |
| Monitoring | No metrics/monitoring package or external monitoring configuration | Keep health endpoints minimal initially; decide whether metrics are required |
| Blockchain anchor | No Ethers.js/contract configuration in this archive | Integrate only after blockchain and document workflows are approved and implemented |

Do not install all possible libraries in Phase 1. Select only the packages required by the approved next implementation phase, and pin versions compatible with the current Node/Express stack.

## 6. Architectural recommendations

### 6.1 Document storage and metadata

- Keep actual files outside the public web root and outside the blockchain.
- Use opaque random storage keys; retain the original filename only as sanitized metadata.
- Keep document metadata, ownership/parcel associations, versions, status, storage key, and SHA-256 digest in MySQL.
- Introduce a storage adapter so local development storage can later be replaced by private object storage.
- Do not expose filesystem paths or storage credentials in API responses.
- A file upload should first be staged/quarantined, validated, hashed, and safely committed to storage before it becomes available for authorized retrieval.
- Coordinate database and filesystem operations with compensating cleanup/recovery because a MySQL transaction cannot roll back a filesystem write.

### 6.2 Integrity verification

- Hash the exact file bytes using Node's built-in `crypto` streaming APIs.
- Persist the original digest and each version's digest; never overwrite an expected digest merely because a later check differs.
- Record verification attempts, expected/calculated hashes, result, actor/system process, timestamp and error context.
- Distinguish local database/file verification from blockchain verification.
- A matching SHA-256 digest demonstrates byte equality against the recorded digest; it does not establish legal authenticity or admissibility.

### 6.3 Audit logging

- Add a centralized audit service and append-oriented audit model.
- Integrate critical events into business operations so an operation cannot silently succeed while its required audit event is lost.
- Use a transactional outbox or same-database transaction where appropriate; external side effects cannot be made atomic with MySQL.
- Restrict audit reads and prevent normal application roles from updating/deleting audit records.
- Hash chaining can make undetected edits harder, but does not make records impossible to alter if an attacker controls the database and signing/anchor mechanisms.
- Never log passwords, access/refresh tokens, private keys, encryption keys, or unnecessary sensitive document contents.

### 6.4 Notifications

- Separate notification creation from channel delivery.
- Persist notification intent and per-channel delivery state.
- Use provider adapters for email and SMS; do not couple domain services to one provider.
- Deliver asynchronously with bounded retries, idempotency, provider message IDs, and a dead-letter/failure state.
- Mark an SMS/email as delivered only when the provider returns delivery confirmation; `SENT` and `DELIVERED` are different states.
- Respect user preferences while retaining mandatory security-alert policy.

### 6.5 File security and authorization

- Reuse existing authentication and role middleware, then add document/parcel/investigation-level authorization in service methods.
- Validate extension, MIME and file signature, plus file size; do not trust client-supplied filename or MIME.
- Use randomized storage keys, path traversal protections, safe streaming headers, rate limits and access audit events.
- Quarantine suspicious files; malware scanning is an adapter/infrastructure decision.
- Define encryption-at-rest key management separately from SHA-256 integrity. Encryption protects confidentiality; hashing supports integrity comparison.

### 6.6 Background processing and monitoring

- Begin with a durable database-backed job/outbox design if it meets the expected prototype load; do not add Redis or another service without a clear need.
- Make jobs idempotent and persist status, attempts, retry schedule, last error and timestamps.
- Ensure pending jobs survive process restarts and workers shut down gracefully.
- Separate liveness (process running), readiness (can accept work), and dependency health (database, storage, RPC, providers, worker).
- Keep public health responses free of credentials, internal addresses and stack traces.

### 6.7 Forensic evidence

- Treat evidence as immutable source material: preserve originals and use verified working copies.
- Record custody events separately from ordinary document metadata, including actor, action, timestamp, reason, previous/new custodian and integrity digest.
- Restrict evidence access to authorized investigators and preserve access/export events.
- Do not equate a hash with authenticity, chain of custody, or legal admissibility.

## 7. Dependencies between the supporting services and domain modules

The archive does not contain land parcels, registration applications, ownership, transfers, investigations or evidence modules. Supporting services must be designed to integrate with these domain modules when they exist.

| Domain dependency | Why supporting services need it |
|---|---|
| User and role identity | Attribute uploads, approvals, access, audit events and notifications |
| Land parcel | Associate documents, activity history and notifications with a stable parcel |
| Registration application | Associate submitted evidence and review/approval outcomes |
| Ownership model | Determine document visibility and notify affected owners |
| Transfer workflow | Record transfer documents, approval events and notifications |
| Investigation | Scope evidence access, evidence custody and investigator notifications |
| Blockchain integration | Anchor approved document digests and verify confirmed anchors |

Do not invent placeholder parcel or investigation IDs and do not create duplicate parcel/owner models inside supporting services. Define interfaces and foreign keys only after the authoritative domain models are inspected and approved.

## 8. Recommended implementation sequence after Phase 1 approval

| Step | Work | Exit condition |
|---|---|---|
| 2 | Confirm domain model dependencies, retention policy, file limits, provider choices and storage/key-management decisions | Architecture and schema decisions approved |
| 3 | Database design and migrations for document metadata/version/verification, audit, notifications and jobs as justified | Migrations apply and roll back safely |
| 4 | Secure document storage, upload validation, retrieval and versioning | Authorized upload/download/version tests pass |
| 5 | SHA-256 hashing and verification history | Original and modified-file cases tested |
| 6 | Central audit service and critical workflow integration | Required business events are durably recorded |
| 7 | In-app notifications, then email/SMS adapters | Delivery state and retry tests pass |
| 8 | Resource-level file access controls, quarantine and encryption design | Cross-user and malicious-file tests pass |
| 9 | Durable background jobs and workers | Restart, retry, duplicate and shutdown tests pass |
| 10 | Liveness/readiness/dependency health and structured operational logging | Failure states are safely observable |
| 11 | Forensic evidence registration and chain of custody | Custody and integrity workflows tested |
| 12 | Integration/security tests and service documentation | Acceptance criteria demonstrated |

Blockchain anchoring should be connected only after document hashing and the approved blockchain integration exist. Do not submit real transactions or send real email/SMS during development tests.

## 9. Exact file change plan

### Phase 1 files created or updated in this archive

| File | Action | Reason |
|---|---|---|
| `docs/SUPPORTING_SERVICES_PHASE1_AUDIT.md` | Create | Record current status, reusable foundation, architecture, risks and next-phase plan |
| `docs/AUDIT_REPORT.md` | Update | Add a concise Supporting Services status summary and link to this report |
| `README.md` | Update | Link to the Phase 1 supporting-services audit and clarify that these services are not yet implemented |

### Existing files to retain unchanged

- `package.json` and lock/dependency configuration (no new dependency required in Phase 1).
- `src/app.js`, `src/server.js`, all current configuration, middleware, routes, modules, models and utilities.
- Existing database setup, migration, and seeder files.
- Existing tests.
- Existing blockchain architecture and blockchain Phase 1 audit documents.
- Frontend files (none are included in this backend archive).

### Planned later files (not created in Phase 1)

The exact final filenames and model relationships must be confirmed against the real domain modules before implementation. Likely additions include document/storage/integrity modules, audit service/model/routes, notification service/adapters/routes, forensic evidence/custody module, background job/worker code, migrations, and corresponding tests and documentation. Do not create empty placeholders.

## 10. Verification limits and Phase 1 exit status

- The supplied ZIP was inspected; it contains 40 project files.
- The archive does not include `node_modules`, so the automated test suite was not executed from this extracted archive.
- No live MySQL server or provider credentials were supplied for this inspection; database migrations and external integrations were not executed.
- The report is a source-code/archive inspection, not a penetration test or production security certification.
- No application source, database schema, dependency list, or frontend code was changed.

**Phase 1 result:** Inspection and architecture planning are complete for the supplied archive. The next step is to review and approve the design decisions and file plan before Phase 2 database design or implementation begins.
