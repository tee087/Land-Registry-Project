# Production readiness and go-live controls

This project now has a production deployment baseline, but code changes alone do
not make it a legally authoritative or approved government land registry. Do not
load real title records until the owner of the service has completed and signed off
the controls below.

## Implemented baseline

- PostgreSQL/Neon database support with versioned Sequelize migrations.
- Production configuration rejects wildcard CORS, weak JWT secrets, missing
  database settings, and missing durable object-storage credentials.
- Document files use a private S3-compatible bucket in production. Vercel clients
  upload and download with short-lived signed URLs instead of sending large files
  through function request/response bodies.
- Uploaded documents are checked against the declared size, MIME type, and storage
  provider SHA-256 checksum before a database record is created.
- Document storage keys have a database uniqueness constraint.
- CI uses PostgreSQL to run the existing backend migration and test workflow.
- Production registration creates pending accounts and sends expiring, single-use
  email verification links. Password recovery is generic-response and revokes all
  outstanding refresh sessions when the password changes.
- Privileged roles are restricted to MFA enrollment until a TOTP authenticator is
  enabled. TOTP secrets are encrypted with AES-256-GCM; sign-in then requires the
  current six-digit code. The encryption key is separate from database storage.
- API-wide and authentication-specific rate counters can use a shared Redis or
  Valkey service. Production startup requires its URL.
- HTTP logs record URL paths without query strings so verification and recovery
  tokens in links do not enter application request logs. Email action tokens are sent
  in URL fragments, which are not sent in the HTTP request to the frontend host.

## Required before public production traffic

### Deployment and secrets

1. Create separate Vercel environments for preview and production. Set `NODE_ENV`,
   `DATABASE_URL`, `JWT_ACCESS_SECRET`, `CORS_ORIGINS`, `S3_BUCKET`,
   `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_REGION`. Add `S3_ENDPOINT`
   for a non-AWS S3-compatible provider and set `S3_FORCE_PATH_STYLE` only if that
   provider requires it.
   Also configure `FRONTEND_URL`, `REDIS_URL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`,
   `SMTP_PASSWORD`, `SMTP_FROM`, and `MFA_ENCRYPTION_KEY`. Generate the MFA key from
   32 cryptographically random bytes, hex encoded. Store a protected recovery copy;
   losing it makes enrolled MFA secrets unreadable and requires a controlled reset.
2. Keep the Neon URL and storage credentials in Vercel server-side environment
   settings only. Use Neon’s pooled URL for API runtime connections and a protected
   direct database URL for schema migration jobs.
3. Keep the object bucket private, block public ACLs, use least-privilege credentials,
   configure encryption and retention at the provider, and allow only the production
   frontend origin in the bucket CORS policy. Allow `PUT`, `GET`, `Content-Type`, and
   `x-amz-checksum-sha256`.
4. Run migrations from a protected deployment job before routing traffic. Do not run
   schema migrations on every serverless function startup.
5. Do not deploy the blockchain worker/listener as an HTTP Vercel service. They need
   a separate scheduled or continuously running worker deployment. Until that is
   configured and monitored, blockchain writes must be treated as pending and not
   relied on for approvals.

### Security, operations, and legal authority

- Apply the new auth-token and MFA migrations before deployment. Verify SMTP delivery,
  link expiry and one-time use, email resend behavior, password reset, refresh-session
  revocation, Redis behavior across multiple API instances, and privileged MFA in a
  separate preview environment. Redis/store or email provider failure behavior still
  needs operational monitoring.
- Provision privileged accounts only through the protected operator workflow. Their
  first login is restricted to authenticator setup; test device replacement, loss,
  compromised-account freeze, and identity re-proofing before enabling the role.
- Define registrar invitations and privileged-role approval, recovery, and removal
  procedures. Public self-registration only creates landowner accounts.
- Define who may create, freeze, review, approve, correct, and transfer records.
  Require separation of duties for high-impact changes and document appeal and
  correction procedures.
- Complete a threat model, independent security review, privacy impact assessment,
  penetration test, and applicable legal and records-management approvals for the
  jurisdiction. Blockchain hashes do not establish legal title or document truth.
- Complete [the backup and restore runbook](docs/BACKUP_RESTORE_RUNBOOK.md), configure
  provider retention/versioning, and have an operator record a successful restore
  exercise before real records are loaded. Define retention, deletion, incident
  response, and disaster recovery targets with named owners.
- Send application, database, Vercel, storage, and privileged-action logs to a
  monitored system with alerting. Database audit rows alone are mutable by database
  administrators and are not tamper-proof evidence.
- Review dependencies and resolve the npm audit findings before release. Keep a
  repeatable dependency update and vulnerability response process.

### Independent approvals still outstanding

This repository cannot complete or attest the legal review, privacy impact assessment,
independent security review, or penetration test. The service owner must appoint
qualified reviewers for the target jurisdiction and record their signed decisions in
the release evidence. See [the release review checklist](docs/PRODUCTION_REVIEW_CHECKLIST.md).

## Deployment smoke-check sequence

1. Run the CI workflow on the production commit and require it to pass.
2. Apply migrations to a fresh Neon branch and confirm migration status.
3. Deploy a preview with separate preview database and bucket credentials.
4. Confirm registration, login, permissions for each role, document direct upload,
   download and checksum verification, audit-log entries, and database unavailability
   behavior.
5. Test backup restoration and verify the service’s runbook and alerts.
6. Promote only after the service owner and required legal/security reviewers approve
   the deployment and data handling.
