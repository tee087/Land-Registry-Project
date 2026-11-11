# Production legal and security review checklist

Complete this with reviewers qualified for the service's jurisdiction and risk. No
item below is considered approved by code changes or by this checklist itself.

## Legal, records, and privacy review

- [ ] Confirm the responsible public authority, legal mandate, and whether the service
  may create, amend, or only support official land records.
- [ ] Review data protection obligations, lawful basis, notices, data-subject rights,
  cross-border hosting, processor contracts, breach notification, and DPIA/PIPIA.
- [ ] Approve records classification, retention, archival, deletion, disclosure, and
  legal hold schedules for both database rows and document object versions.
- [ ] Define title correction, dispute, appeal, transfer, freeze, and human review
  procedures, including separation of duties and accessible user recourse.
- [ ] Approve terms, public claims, accessibility, and user notices. Do not claim an
  official government integration or legal title authority without written approval.

## Independent security review

- [ ] Complete a threat model covering account takeover, privileged insiders,
  unauthorized parcel discovery, document substitution, database compromise, storage
  links, blockchain key compromise, denial of service, and supply-chain risk.
- [ ] Review authentication, authorization, MFA recovery, secrets handling, rate
  limiting, tenant/record access controls, audit evidence, and administrator actions.
- [ ] Run an independent penetration test against a production-like environment with
  synthetic data; remediate critical/high findings and document accepted residuals.
- [ ] Review dependency vulnerabilities, CI permissions, deployment approvals,
  database migration controls, cloud IAM, encryption, logging, and alert response.
- [ ] Exercise incident response, privileged-account loss, database/object restore,
  key rotation, and blockchain worker reconciliation.

## Required sign-off record

| Approval | Reviewer / organization | Date | Evidence / decision |
| --- | --- | --- | --- |
| Legal authority and records management | ____________________ | __________ | ____________________ |
| Privacy/DPIA | ____________________ | __________ | ____________________ |
| Independent security assessment | ____________________ | __________ | ____________________ |
| Service owner go-live decision | ____________________ | __________ | ____________________ |

Do not load real land records until every required approval is signed and the service
owner has accepted the residual-risk register.
