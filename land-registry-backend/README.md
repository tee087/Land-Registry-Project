# LandRegistryChain Backend

Node.js 20+ / Express 4 / PostgreSQL (Sequelize) REST API. ES modules. Independent of the React frontend.

## 1. Current status

This repository contains a production-oriented implementation baseline. It is not
approved to replace an official land registry or hold legally authoritative records
until the deployment, security, legal, privacy, backup and recovery controls in
[`PRODUCTION_READINESS.md`](PRODUCTION_READINESS.md) have been completed.

Implemented:

- Authentication and user management (JWT access tokens, rotating refresh tokens,
  roles, administrative user status changes).
- Land parcels with identifiers, status, optional coordinates and ownership history.
- Registration applications with registrar review/approval.
- Ownership transfers with registrar review/approval.
- Private object-storage document upload/download using short-lived signed URLs,
  checksum verification, versioning and resource-level access.
- Centralized audit logging written by domain operations.
- In-app notifications.
- Forensic evidence registration and custody events.
- Durable blockchain outbox, worker and event listener, plus a Hardhat/Solidity contract.
- Docker Compose stack (PostgreSQL, migrations, backend, frontend/nginx).

Remaining production work:

- Registrar invitation/approval and privileged-account recovery procedures.
- Full joint-ownership rules (the schema records `share_percent`, but workflows
  currently grant/settle 100% ownership).
- GIS/spatial queries; latitude and longitude are stored but not spatially indexed.
- Production SMTP and shared Redis credentials/configuration, plus operational alerting.
- Automated frontend tests and comprehensive auth/domain test coverage.
- Blockchain backfill, reorg handling and an automated reconciliation job.

A matching SHA-256 digest proves byte-level equality with the stored digest; it does
not prove legal authenticity. Likewise, a parcel is only "blockchain-confirmed" once
the worker/listener has processed the operation against a configured chain.

## 2. Requirements

- Node.js 20+ (see `.nvmrc`)
- PostgreSQL 14+ (Neon or local PostgreSQL)
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
| DATABASE_URL | - | PostgreSQL connection string; use Neon’s pooled URL for the deployed API |
| DB_HOST, DB_PORT | 127.0.0.1, 5432 | Local PostgreSQL location when `DATABASE_URL` is blank |
| DB_NAME, DB_USER, DB_PASSWORD | land_registry_chain, postgres, - | Local PostgreSQL database/account when `DATABASE_URL` is blank |
| DB_MIGRATION_USER, DB_MIGRATION_PASSWORD | DB_USER/DB_PASSWORD | Optional separate account used only by sequelize-cli |
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
| DOCUMENT_STORAGE_DRIVER | local in development; s3 in production | Local disk or S3-compatible durable object storage |
| S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY | - | Private bucket and credentials required in production |
| S3_ENDPOINT | - | Optional custom S3 endpoint (for example, an S3-compatible provider) |
| S3_FORCE_PATH_STYLE | false | Enable for providers that require path-style bucket addressing |
| AWS_REGION | auto | Object-storage region; use the provider’s region value |
| UPLOAD_DIR | uploads | Local development storage directory only |
| BLOCKCHAIN_RPC_URL | - | EVM JSON-RPC URL (worker/listener) |
| BLOCKCHAIN_CONTRACT_ADDRESS | - | Deployed `LandRegistry` address |
| BLOCKCHAIN_PRIVATE_KEY | - | Backend signer key; never commit or log it |
| BLOCKCHAIN_CHAIN_ID | - | Optional expected chain ID |

In production, set `DATABASE_URL` (preferred) or all of `DB_NAME`, `DB_USER` and
`DB_PASSWORD`, plus `CORS_ORIGINS` and `JWT_ACCESS_SECRET`. Neon connections use TLS.
`*` is rejected for CORS and the JWT secret must be at least 32 characters.

## 5. Database setup

1. Create a PostgreSQL database. For Neon, create a project and copy its pooled connection string into `DATABASE_URL` in `.env`. For local PostgreSQL, create `land_registry_chain` and set the `DB_*` variables in `.env`.
2. Run the migrations against that database:
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

### Vercel and Neon deployment

The repository root `vercel.json` deploys the Vite frontend at `/` and the Express API
under `/api/*`. The frontend calls the API through the same-origin `/api` route. The
API uses `src/app.js` as its Express entrypoint; long-running blockchain workers are
not part of that serverless function.

1. Create a Neon database and configure `DATABASE_URL` in the Vercel backend service.
   Use the pooled URL at runtime; run migrations from a protected job using a direct
   URL with the `NODE_ENV` set appropriately. Never expose database URLs to Vite.
2. Configure `NODE_ENV=production`, a unique 32+ character `JWT_ACCESS_SECRET`, and
   `CORS_ORIGINS` for the deployed site. Add `S3_BUCKET`, `AWS_REGION`,
   `AWS_ACCESS_KEY_ID`, and `AWS_SECRET_ACCESS_KEY` for a private S3-compatible bucket.
   Add `S3_ENDPOINT` for providers such as R2 and configure the bucket CORS policy
   for the exact frontend origin, `PUT`, and the signed upload headers.
3. Apply `npm run db:migrate` from this directory in a protected deployment job before
   routing traffic to the new build. Do not run migrations during a Vercel build or
   on every function cold start.
4. Exercise the smoke-check and restore procedures in
   [`PRODUCTION_READINESS.md`](PRODUCTION_READINESS.md). The blockchain worker requires
   its own scheduled/worker deployment; it does not run continuously on Vercel.

Keep all credentials in server-side environment settings, never in committed files
or frontend `VITE_*` variables. The legal, security, account-recovery, backup and
operational requirements for live registry data are listed in
[`PRODUCTION_READINESS.md`](PRODUCTION_READINESS.md).

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

The foundation tests do not require PostgreSQL in most cases; the health test accepts
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

In production, the API issues a five-minute signed upload URL after checking the
user’s parcel ownership or registration access. The browser uploads directly to a
private S3-compatible bucket, then the API checks the uploaded size, MIME type and
S3 SHA-256 checksum before creating the document record. Download URLs expire after
one minute. The API does not proxy file bytes through a Vercel Function. Configure
the bucket’s CORS policy to allow the deployed frontend origin, `PUT`, and the
`Content-Type` and `x-amz-checksum-sha256` headers. Keep the bucket private and block
public ACLs. Local development can use local storage for small files; local storage
is rejected in production. `POST /documents/:id/verify` re-hashes the stored bytes.
Uploads and downloads are written to the audit log.

## 11. Blockchain integration

The backend keeps PostgreSQL as the source of truth and uses a transactional outbox
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
cp .env.example .env        # set DB_PASSWORD, JWT_ACCESS_SECRET, CORS_ORIGINS
docker compose up --build
```

This starts PostgreSQL, runs migrations, then starts the backend and frontend. The API is
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
database         PostgreSQL setup, Sequelize CLI config and migrations
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
