# Backup and restore runbook

This runbook is a release control, not proof that backups are configured. The service
owner must fill in the service names, retention periods, recovery objectives, and
exercise evidence below before any real registry records are loaded.

## Owners and targets

| Control | Value to record |
| --- | --- |
| Database provider / project / production branch | ____________________ |
| Database backup and point-in-time retention | ____________________ |
| Object storage bucket and version retention | ____________________ |
| Recovery point objective (maximum data loss) | ____________________ |
| Recovery time objective (maximum outage) | ____________________ |
| Primary restore operator / alternate | ____________________ |
| Incident commander / approval authority | ____________________ |
| Last restore exercise and evidence reference | ____________________ |

## Configure before production

1. Enable managed PostgreSQL backups and point-in-time recovery for the production
   Neon project. Limit project and restore permissions to named operators; require
   MFA on provider accounts. Set retention only after the records-retention owner
   approves it.
2. Enable object versioning and provider-side encryption for the private documents
   bucket. Confirm lifecycle rules retain prior versions for the approved period and
   restrict permanent deletion to a separate operator role.
3. Put any database export, object inventory, and recovery key material in an
   encrypted backup location with access logging. Never commit exports or credentials
   to this repository or store them in the frontend.
4. Configure alerts for backup failures, storage growth, and unexpected deletion.
   Keep production and preview data/credentials separate.

## Scheduled PostgreSQL export

Use a protected operator environment with named libpq service entries for backup and
restore connections. Protect the service file (mode `0600`) and keep its password out
of shell history, command arguments, and output. Write the dump to an encrypted,
access-controlled location.

```sh
umask 077
pg_dump --dbname="service=production-backup" --format=custom --no-owner --no-acl --file="land-registry-$(date -u +%Y%m%dT%H%M%SZ).dump"
```

This export supplements managed point-in-time recovery. It does not back up the
private document bucket or verify that a restore works.

## Restore exercise

1. Open an incident/change record, identify the restore point and approval owner, and
   create an isolated temporary database branch. Never restore over production during
   an exercise.
2. Restore a database snapshot/export to the isolated target. For a custom-format
   `pg_dump` archive:

   ```sh
   pg_restore --no-owner --no-acl --dbname="service=restore-target" ./land-registry-backup.dump
   ```

3. Confirm Sequelize migration status, row counts for critical tables, foreign-key
   integrity, recent audit records, and application startup against the restored copy.
   Use an approved, non-production test identity and do not expose the branch publicly.
4. Restore representative document versions to a separate test bucket. Confirm the
   database storage keys resolve and SHA-256 checksums match the restored objects.
5. Record elapsed restore time, selected recovery point, missing data, observed
   recovery point/time, operator names, and remediation items. Obtain owner sign-off.
6. Delete the temporary branch and restored objects under the approved cleanup
   procedure, then retain the exercise record without retaining unnecessary personal
   data.

## Recovery incident

Declare an incident, freeze writes if integrity is in doubt, preserve provider audit
logs, and notify the named data/security/legal owners. Select a recovery point with
the decision authority, restore to a new database and bucket prefix, verify counts
and checksums, and route traffic only after dual approval. Preserve a record of any
lost or replayed transactions and reconcile pending blockchain outbox events before
resuming writes. Do not present an on-chain hash as a substitute for recovered source
records.
