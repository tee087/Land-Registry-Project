# LandRegistryChain Backend

Node.js 20+ / Express 4 / MySQL 8 (Sequelize) REST API. ES modules. Independent of the React frontend.

## 1. Current status

This is a working prototype of the land-registry domain, not a production-certified
system. Do not use real landowner data until security, legal and operational reviews
are complete.

Implemented:

- Authentication and user management (JWT access tokens, rotating refresh tokens,
  roles, administrative user status changes).
- Land parcels with identifiers, status, optional coordinates and ownership history.
- Registration applications with registrar review/approval.
- Ownership transfers with registrar review/approval.
- Document upload, versioning, SHA-256 integrity checks, download and resource-level access.
- Centralized audit logging written by domain operations.
- In-app notifications.
- Forensic evidence registration and custody events.
- Durable blockchain outbox, worker and event listener, plus a Hardhat/Solidity contract.
- Docker Compose stack (MySQL, migrations, backend, frontend/nginx).

Not implemented yet:

- Password change, password reset, email verification.
- Full joint-ownership rules (the schema records `share_percent`, but workflows
  currently grant/settle 100% ownership).
- GIS/spatial queries; latitude and longitude are stored but not spatially indexed.
- Email/SMS notification delivery (only in-app notifications exist).
- Automated frontend tests and comprehensive auth/domain test coverage.
- Blockchain backfill, reorg handling and an automated reconciliation job.

A matching SHA-256 digest proves byte-level equality with the stored digest; it does
not prove legal authenticity. Likewise, a parcel is only "blockchain-confirmed" once
the worker/listener has processed the operation against a configured chain.

## 2. Requirements

- Node.js 20+ (see `.nvmrc`)
- MySQL 8+ (XAMPP/WAMP/MySQL Server all work)
- Optional: a local Hardhat node and deployed `LandRegistry` contract for blockchain writes

## 3. Installation

```bash
cd land-registry-backend
npm install
```

## 4. Environment variables

Copy `.env.example` to `.env` and edit it. Never commit or share `.env`.

| Variable | Default | Purpose |
|---|---|---|
| NODE_ENV | development | development / test / production |
| PORT | 5000 | API port |
| TRUST_PROXY | 0 | Reverse-proxy hops to trust |
| BODY_LIMIT | 1mb | Max JSON / form body size |
| DB_HOST, DB_PORT | 127.0.0.1, 3306 | MySQL location |
| DB_NAME, DB_USER, DB_PASSWORD | land_registry_chain, lrc_app, - | Runtime MySQL database/account |
| DB_MIGRATION_USER, DB_MIGRATION_PASSWORD | DB_USER/DB_PASSWORD | Separate account used only by sequelize-cli |
| DB_NAME_TEST | `<DB_NAME>_test` | Database used when NODE_ENV=test (must end in `_test`) |
| DB_LOGGING | false | Print SQL (dev only) |
| DB_POOL_MAX / MIN / ACQUIRE_MS / IDLE_MS | 10 / 0 / 30000 / 10000 | Connection pool |
| DB_CONNECT_RETRIES, DB_CONNECT_RETRY_DELAY_MS | 3, 2000 | Startup retries |
| DB_REQUIRE_ON_STARTUP | true | Exit if DB unreachable at boot |
| CORS_ORIGINS | localhost:5173, localhost:3000 | Comma-separated approved origins |
| RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX | 900000, 300 | Global rate limit |
| JWT_ACCESS_SECRET | - | At least 32 characters; required in production |
| JWT_ACCESS_TTL | 15m | Access-token lifetime |
| REFRESH_TOKEN_TTL_DAYS | 7 | Refresh-token lifetime |
| BCRYPT_ROUNDS | 12 | Password hashing cost (10-14) |
| UPLOAD_DIR | uploads | Directory for uploaded document bytes |
| BLOCKCHAIN_RPC_URL | - | EVM JSON-RPC URL (worker/listener) |
| BLOCKCHAIN_CONTRACT_ADDRESS | - | Deployed `LandRegistry` address |
| BLOCKCHAIN_PRIVATE_KEY | - | Backend signer key; never commit or log it |
| BLOCKCHAIN_CHAIN_ID | - | Optional expected chain ID |

In production, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `CORS_ORIGINS` and
`JWT_ACCESS_SECRET` are mandatory; `*` is rejected for CORS and the JWT secret must be
at least 32 characters.

## 5. Database setup

1. Edit the passwords in `database/setup.sql`, then run:
   ```bash
   mysql -u root -p < database/setup.sql
   ```
   (Or create the databases/users in phpMyAdmin.)
2. Put the same credentials in `.env`.
3. Run migrations:
   ```bash
   npm run db:migrate
   npm run db:migrate:status
   npm run db:migrate:undo      # undo the last migration only
   npm run db:seed              # only if seeders are added
   ```
   Migrations live in `database/migrations/`. Because the project is ESM, write them
   as **`.cjs`** files using `module.exports = { up, down }`. The app never calls
   `sequelize.sync({ force: true })`.

## 6. Start the backend

```bash
npm run dev      # auto-restart on changes
npm start        # plain start
```

Verify:

```bash
curl http://localhost:5000/api/health        # combined health + DB check
curl http://localhost:5000/api/health/live   # liveness, no DB access
curl http://localhost:5000/api/health/ready  # readiness, DB must be reachable
```

### Creating the first administrator

Public registration always creates a `landowner`. Bootstrap the first administrator
from a trusted terminal after migrations:

```bash
ADMIN_NAME="System Administrator" \
ADMIN_EMAIL="admin@example.test" \
ADMIN_PASSWORD="Use-A-Unique-Strong-Password1" \
npm run admin:create
```

The script refuses to create a second administrator once one exists. Remove the
password from your shell environment afterwards.

## 7. Run tests

```bash
npm test
npm run lint
```

The foundation tests do not require MySQL in most cases; the health test accepts
200 or 503. `NODE_ENV=test` requires the database name to end with `_test`.

## 8. API overview

Base path `/api`. All responses use the standard envelope in
`src/utils/responseHandler.js`. Send access tokens as `Authorization: Bearer <accessToken>`.
See [`docs/API.md`](docs/API.md) for request/response details.

| Area | Endpoints |
|---|---|
| Health | `GET /health`, `GET /health/live`, `GET /health/ready` |
| Auth | `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `GET /auth/me` |
| Users | `GET/PATCH /users/me`, `GET /users`, `PATCH /users/:id/status` |
| Parcels | `GET /parcels`, `GET /parcels/search?q=`, `GET /parcels/:id`, `GET /parcels/:id/ownerships`, `POST /parcels`, `PATCH /parcels/:id`, `POST /parcels/:id/freeze` |
| Registrations | `POST /registrations`, `GET /registrations`, `GET /registrations/:id`, `POST /registrations/:id/review` |
| Transfers | `POST /transfers`, `GET /transfers`, `POST /transfers/:id/review` |
| Documents | `POST /parcels/:id/documents`, `GET /parcels/:id/documents`, `GET /documents/:id`, `GET /documents/:id/download`, `POST /documents/:id/verify` |
| Evidence | `POST /evidence`, `GET /evidence`, `GET /evidence/:id`, `POST /evidence/:id/custody` |
| Audit | `GET /audit-logs` |
| Notifications | `GET /notifications`, `POST /notifications/read-all`, `POST /notifications/:id/read` |
| Blockchain | `GET /blockchain/status`, `GET /blockchain/transactions` (administrator) |

## 9. Roles and permissions

The permission map lives in `src/middleware/authorize.js`.

- `landowner`: own profile, registration creation, own transfers, own parcels/documents.
- `registrar`: land administration, registration/transfer review, document access.
- `administrator`: full access (`*`).
- `investigator`: read land records, evidence and case documents.
- `auditor`: read audit logs and land/registration/transfer records.

Role checks alone are not sufficient; services also perform resource-level checks
(for example, parcel ownership before document upload or transfer creation).

## 10. Documents and integrity

Documents are uploaded as base64 JSON to `POST /parcels/:id/documents` (10 MB decoded
limit), hashed with SHA-256, written under `UPLOAD_DIR` with a random storage key and
versioned per `(parcel, originalName)`. `POST /documents/:id/verify` re-hashes the
stored file and compares it with the recorded digest. Uploads and downloads are
recorded in the audit log.

## 11. Blockchain integration

The backend keeps MySQL as the source of truth and uses a transactional outbox
(`blockchain_transactions`) for approved operations. When `BLOCKCHAIN_RPC_URL`,
`BLOCKCHAIN_CONTRACT_ADDRESS` and `BLOCKCHAIN_PRIVATE_KEY` are set:

```bash
npm run blockchain:worker      # submit pending outbox entries
npm run blockchain:listener    # reconcile contract events
```

Without those variables the worker/listener log a message and exit. The Solidity
contract lives in `../blockchain/contracts/LandRegistry.sol`; deploy it with the
Hardhat project in `../blockchain`. Contract events and on-chain values must not
contain personal data.

Operational caveat: the worker needs the owner to have a linked `walletAddress` and a
current document hash for registration/transfer operations. If the recipient has no
wallet address, the outbox entry will fail and be marked `failed`; fix the data and
re-enqueue as appropriate.

## 12. Docker Compose

From the repository root:

```bash
cp .env.example .env        # set MYSQL_ROOT_PASSWORD, DB_NAME, JWT_ACCESS_SECRET, CORS_ORIGINS
docker compose up --build
```

This starts MySQL, runs migrations, then starts the backend and frontend. The API is
on `http://localhost:5000`, the frontend on `http://localhost:8080`. Blockchain
variables are optional and passed through to the backend container.

## 13. Project structure

```
src/config       environment, database, CORS
src/middleware   validation, authentication, authorization, errors
src/routes       health and route registry
src/modules      auth, users, land, documents, audit, notifications, evidence, blockchain
src/models       Sequelize models for users, parcels, ownership, registrations,
                 transfers, documents, audit, notifications, evidence, blockchain
src/services     audit/notification helpers, blockchain outbox, contract ABI
src/utils        response envelope, AppError, asyncHandler
database         MySQL setup, Sequelize CLI config and migrations
scripts          admin bootstrap, blockchain worker, blockchain listener
test             foundation tests
docs             API, audits and blockchain architecture
```

## 14. Response format

Success: `{ success:true, message, data, meta?, requestId, timestamp }`

Error: `{ success:false, message, error:{ code, details? }, requestId, timestamp }`

Every response carries an `X-Request-ID` header, which is also stored on audit
records for correlation.

## 15. Known limitations and roadmap

1. Complete authentication hardening (password change/reset, email verification,
   consistent auth-rate-limit error envelope, broader auth tests).
2. Implement and test joint-ownership transfer rules and share validation.
3. Add GIS/spatial indexing and true map rendering.
4. Add email/SMS delivery adapters and notification preferences.
5. Add blockchain reconciliation/backfill, retry scheduling and confirmation policy.
6. Expand domain and integration test coverage, including end-to-end DB workflows.
7. Security, privacy, legal and operational review before production use.

## 16. Historical documents

The `docs/*_PHASE1_*.md` files and `docs/AUDIT_REPORT.md` are point-in-time audits.
They are retained for history and may describe earlier snapshots. Current behaviour
is documented in this README and [`docs/API.md`](docs/API.md).
