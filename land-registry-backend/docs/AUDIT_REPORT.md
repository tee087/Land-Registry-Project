# LandRegistryChain Backend — Updated Phase 1 Audit Report

> **Historical document.** This report describes the backend as it was on 4 November
> 2026, before the land, registration, transfer, document, audit, notification,
> evidence and blockchain modules were implemented. Several statements below (for
> example "not implemented") are no longer true. For current behaviour see
> [`../README.md`](../README.md) and [`API.md`](API.md).

**Audit scope:** The supplied backend ZIP was inspected on 4 November 2026. This report describes the files present in this archive. The React frontend was not included in the archive and was not inspected.

## 1. Executive summary

The project has an initial Node.js/Express backend foundation, MySQL/Sequelize configuration, authentication and user modules, and an initial database migration. It does **not** yet implement land parcels, registration workflows, ownership, transfers, document management, or blockchain operations.

The previous version of this report is superseded because it described an earlier backend snapshot.

| Area | Current finding | Evidence |
|---|---|---|
| Node.js / Express | Implemented foundation | `src/app.js`, `src/server.js`, `package.json` |
| MySQL / Sequelize | Configured | `src/config/database.js`, `database/config.cjs` |
| Database migration | Initial users and refresh-token migration exists | `database/migrations/20261104000100-create-users-and-refresh-tokens.js` |
| Input validation | Zod schemas and validation middleware exist | `src/modules/auth/auth.validation.js`, `src/middleware/validate.js` |
| Authentication | Initial implementation exists | `src/modules/auth/`, `src/middleware/authenticate.js` |
| User management | Initial implementation exists | `src/modules/users/`, `src/models/User.js` |
| Refresh-token persistence | Implemented using hashed tokens | `src/models/RefreshToken.js`, auth service |
| Role authorization | Initial role/permission middleware exists | `src/middleware/authorize.js` |
| Land parcels | Not implemented | No land model or land module |
| Registration workflow | Not implemented | No registration module |
| Ownership / joint ownership | Not implemented | No ownership model or ownership workflow |
| Transfers | Not implemented | No transfer module |
| Document storage / hashing | Not implemented | No document module or integrity service |
| Blockchain | Documentation only | No Hardhat setup, Solidity contract, Ethers.js integration, or blockchain transaction processing |

## 2. Existing backend capabilities

### 2.1 Application foundation

The backend currently includes:
- Express application and server entry points.
- Helmet security headers and configured CORS.
- Request IDs and Morgan request logging.
- Global rate limiting and request-body size limits.
- Centralized success/error response handling.
- Structured 404 and error middleware.
- Health endpoint at `GET /api/health`.
- Graceful server shutdown and database connection handling.

### 2.2 Database foundation

- Sequelize is configured to use the MySQL dialect.
- `mysql2` is included as the database driver.
- Sequelize CLI migration configuration is present.
- An initial migration creates `users` and `refresh_tokens`.
- The application does not use destructive `sequelize.sync({ force: true })`.

**Important:** The existence of a migration file does not prove that it has been executed against the user's local MySQL database. Run the migration-status command and inspect the database to verify the local state.

### 2.3 Authentication and users

The following features are present in the source code:

| Feature | Status |
|---|---|
| Public user registration | Implemented; new accounts receive the `landowner` role |
| User login | Implemented |
| Password hashing | Implemented with `bcryptjs` |
| JWT access tokens | Implemented |
| Refresh tokens | Implemented; random tokens are stored as SHA-256 hashes |
| Refresh-token rotation | Implemented |
| Logout / token revocation | Implemented |
| Current-user endpoint | Implemented |
| User profile read/update | Implemented |
| Administrator user listing/status update | Present in the user routes |
| Role-based authorization middleware | Initial implementation |
| Password change | Not implemented |
| Password reset / recovery | Not implemented |
| Email verification workflow | Not implemented |
| Comprehensive authentication tests | Not present in the supplied test suite |

The authentication implementation is an initial foundation, not a complete production-ready identity and access-management system.

### 2.4 Authentication issues to address

1. Add authenticated password-change functionality, including verification of the current password.
2. Add a secure password-reset workflow using short-lived, single-use reset tokens. Do not reveal whether an email address is registered.
3. Add tests for registration, login, invalid credentials, refresh rotation, revoked/expired tokens, logout, authorization and account status.
4. Configure the authentication-specific rate limiter to return the same standard JSON error envelope used by the rest of the API. The current auth limiter does not define a custom response handler.
5. Review logout behavior and document whether the endpoint should require an authenticated access token in addition to the refresh token.
6. Implement email verification only when the project requirements and delivery mechanism are defined.

## 3. Ownership decision

Ownership is not implemented in the current backend. The database and smart-contract designs must support the agreed ownership model from the beginning.

**Recommendation: support both single ownership and joint ownership.**

- **Single ownership:** one owner is associated with a parcel and holds 100% ownership.
- **Joint ownership:** two or more owners may share one parcel, with an explicit percentage/share recorded for each owner.
- The total ownership shares for a parcel must equal 100%.
- Ownership changes must preserve historical records rather than overwrite the only record of previous ownership.
- Transfer rules must define whether all joint owners must approve a transfer, or whether a legally authorized representative can act for them. This is a business/legal rule that must be confirmed before implementation.

A suitable database design should represent ownership as relationships between parcels and owners, rather than placing a single owner ID directly on the parcel and assuming that this covers joint ownership.

For smart-contract storage, shares can be represented as integer basis points (for example, 10,000 basis points = 100%) to avoid floating-point arithmetic. The database and contract must enforce the same total-share rule.

## 4. Blockchain decision and implementation status

The blockchain component is currently **documentation only**. There is no blockchain implementation in the supplied source archive.

| Area | Recommended decision | Current implementation status |
|---|---|---|
| Development network | Local Hardhat network first | Not installed/configured |
| Later test network | Ethereum Sepolia, after local testing and review | Not configured |
| Backend database | MySQL with Sequelize | Existing foundation configured |
| Smart-contract language | Solidity | No contract exists |
| Backend blockchain library | Ethers.js v6 | Not installed |
| Smart-contract development tool | Hardhat 2 with Ethers v6-compatible tooling | Not installed |
| Ownership model | Single and joint ownership with defined shares | Not implemented |
| Owner information on-chain | Pseudonymous references; no personal data | Not implemented |

Sepolia is a later test-network option, not a current deployment target. It should only be introduced after the contract, local deployment, tests, and backend integration work on the local Hardhat network.

### 4.1 On-chain privacy

Do not store owner names, national ID numbers, phone numbers, email addresses, physical addresses, GPS coordinates, or title-deed files on a public blockchain.

Use a backend-generated pseudonymous owner reference or a carefully designed digest. Keep the identity-to-reference mapping and personal information in the protected MySQL database. Pseudonymous identifiers and hashes can still be linkable, so they must not automatically be treated as anonymous data.

### 4.2 Blockchain work still required

- Install and configure the local Hardhat toolchain.
- Add and test a Solidity land-registry contract.
- Integrate the backend using Ethers.js v6.
- Define contract roles and signer security.
- Add transaction, outbox, event and checkpoint persistence through migrations.
- Implement transaction receipt/confirmation tracking and retry/reconciliation.
- Implement event listening and duplicate-event protection.
- Integrate blockchain submissions only with approved land-registry domain workflows.

Do not claim a parcel registration or ownership transfer is blockchain-verified until the transaction and relevant contract state have actually been checked.

## 5. Recommended division of responsibilities

**MySQL should remain the main application database** for personal information, parcel details, applications, ownership shares, documents, approvals, access controls, and operational records.

**The blockchain should store only the minimum evidence needed for independent verification**, such as stable parcel references, pseudonymous owner references, document digests, approved status changes, and transaction history.

The blockchain must not replace the authoritative application workflow or be treated as proof that an underlying land claim is legally valid.

## 6. Testing and verification status

The supplied archive contains `test/foundation.test.js`. It covers basic foundation behavior such as health responses, structured 404 responses, malformed/oversized request bodies, security headers, and CORS.

It does not provide comprehensive authentication, database integration, ownership, or blockchain tests.

The earlier audit's environment-dependent checks must not be mistaken for completed verification on the user's computer. In particular, the presence of code and migrations does not establish that dependencies are installed, the database is running, migrations have executed, or all tests pass locally.

Run these commands from `land-registry-backend/`:

```bash
npm install
npm run db:migrate:status
npm test
npm run dev
```

The backend's health endpoint can then be checked at:

```text
http://localhost:5000/api/health
```

A successful local verification should also include confirming that the expected `users` and `refresh_tokens` tables exist in the configured MySQL database.

## 7. Updated development plan

| Phase | Work | Exit condition |
|---|---|---|
| 1 — Audit and decisions | Correct audit documents; approve ownership and blockchain direction | Documentation reviewed and decisions confirmed |
| 2 — Database design | ER diagram, parcel/owner relationship, joint shares, migrations and constraints | Schema and migration tests pass |
| 3 — Authentication completion | Password change/reset, consistent rate-limit errors, auth tests | Authentication acceptance tests pass |
| 4 — Land parcels | Parcel model, identifiers, search and status | Parcel tests pass |
| 5 — Registration workflow | Applications, review and approval | Workflow tests pass |
| 6 — Ownership and transfers | Single/joint ownership, share validation, transfer approvals and history | Ownership and transfer tests pass |
| 7 — Documents and integrity | Secure document storage, versioning and SHA-256 verification | Upload and integrity tests pass |
| 8 — Local blockchain toolchain | Hardhat local network and Ethers.js v6 connectivity | Backend reads local chain ID |
| 9 — Smart contract | Solidity contract, access control, ownership and events | Contract compiles and tests pass |
| 10 — Blockchain integration | Outbox, transactions, receipts, event listener and reconciliation | Failure/retry and integration tests pass |
| 11 — Investigations, GIS and audit | Evidence chain of custody, spatial functions and audit trail | Module acceptance tests pass |
| 12 — Deployment readiness | API documentation, frontend integration, backups, security and legal review | End-to-end review completed |

## 8. Final conclusion

The supplied backend is more advanced than the previous `AUDIT_REPORT.md` described. It already contains authentication, user management, JWTs, refresh-token persistence, Zod validation, authorization middleware, and an initial users/refresh-tokens migration.

However, it is still an initial backend foundation. Ownership, land registration, transfers, document management, and blockchain functionality have not yet been implemented.

The recommended direction is to support single and joint ownership, retain MySQL as the application database, develop the blockchain integration locally with Hardhat first, use Solidity for the contract and Ethers.js v6 for backend connectivity, and consider Sepolia only at a later testing stage.

**Scope of this update:** documentation only. No application source code, database schema, authentication behavior, or blockchain functionality is changed by this audit-document revision.


## Supporting Services audit (Phase 1)

The six supporting-service areas in the supplied archive are not yet implemented as complete modules:

| Area | Current status |
|---|---|
| Document storage and management | Not implemented |
| SHA-256 document integrity verification | Not implemented; SHA-256 is currently used only to hash refresh tokens |
| Central audit logging and activity tracking | Not implemented; request IDs and HTTP request logs are not an audit trail |
| Notifications (in-app, email, SMS) | Not implemented |
| File security and resource-level access control | General API security and initial RBAC exist; document-specific controls do not |
| Background processing and system monitoring | No job queue or worker; the existing health endpoint checks MySQL only |

The existing Express app, Sequelize/MySQL connection, migrations, authentication, role middleware, Zod validation, request IDs, centralized errors, and test conventions should be reused. The land, registration, ownership, transfer, investigation, and evidence domain modules needed for integration are not present in this archive.

See [`SUPPORTING_SERVICES_PHASE1_AUDIT.md`](./SUPPORTING_SERVICES_PHASE1_AUDIT.md) for the detailed status matrix, architecture recommendations, dependencies, security considerations, implementation sequence, and exact file-change plan. Phase 1 is documentation-only; no application code or dependencies were changed.
