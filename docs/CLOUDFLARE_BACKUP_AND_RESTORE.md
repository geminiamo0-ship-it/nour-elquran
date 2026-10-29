# Cloudflare data protection and restore runbook

Status: design/runbook for #104/#56; **no remote database, export schedule or restore has been created/executed by CF-01**. Use [ADR 0004](adr/0004-cloudflare-only-platform.md).

## Protection scopes
| Component | Protection and recovery |
|---|---|
| D1 | Time Travel automatically enabled for production-backend D1 databases: 30 days Paid / 7 days Free; point-in-time whole-database restore |
| D1 long retention | Periodic private SQL exports to a dedicated backup R2 prefix/bucket, immutable dated keys, metadata/checksum and least-privilege access |
| Private R2 assets | Content-addressed/versioned object keys, deletion/retention policy, separate recoverable copies where required; D1 restore does not restore deleted objects |
| Lesson DO SQLite | Durable operations and snapshots, queued outbox, sequence reconciliation; D1 Time Travel does not back up a DO |
| Auth sessions and external effects | Revalidate/revoke sessions as necessary after restore; reconcile notification/payment provider events with preserved dedupe IDs |

Time Travel history and restore have no separate D1 charge. Export storage/operations are metered under their services. No capacity or full-platform fixed-cost guarantee.

## Before remote provisioning
Choose isolated dev/staging/prod resource names and bindings, then record actual IDs privately in deployment configuration. Never deploy the zero-UUID local sample as production. Review CLI --help/current official docs and pin the tool in the implementation PR.
Confirm D1 production storage backend, plan and actual retention; observe permissions and bindings. Enable job observability, export-failure alerting and appropriate data retention. Do not call a backup configured merely because a runbook exists.

## Export policy to implement under #56
Start with a proposed daily private export, capture migration version, export time, D1 bookmark, object manifest/version references and checksum. Retention beyond 30 days requires an explicit child-data/finance policy; do not commit a speculative permanent retention period. Run exports at a suitable low-use time and measure impact/limits.
Avoid public URLs, GitHub artifacts with real student data, logged dump content and names/voices in object keys. Keep minimal job IDs and delivery outcomes.

## Restore rehearsal and incident steps
1. Identify the affected state and scope. Freeze conflicting writes/jobs for a production restore; record latest bookmark, active migrations, R2 manifest and in-flight operations. Rehearse with synthetic staging data first.
2. Prefer selective repair when possible. Time Travel restore overwrites the whole database at the chosen point; in-flight queries can be cancelled. It is not row-level undo and does not retroactively undo payments/messages.
3. Use a timestamp/bookmark within the actual plan window. Verify the exact target DB, environment and recorded prior bookmark before an authorized destructive restore; this owner adoption alone is not authorization for a production restore.
4. Validate schema version, row invariants, foreign_key_check, published-report/annotation references, private-object availability, per-learner authorization and reserved/consumed/compensatory rights.
5. Reconcile post-checkpoint provider events and DO outboxes by stable event ID and version. Never replay charges or duplicate credits blindly.
6. Reconcile unfinished uploads/exports, orphan objects and stale jobs. Keep permissions/session revocation effective after rollback; a restored grant must not silently re-enable an expired substitute.
7. Resume writes/jobs in order, observe errors/lag, document actual loss window and measured recovery time. Prove forward recovery and application rollback; retain the prior bookmark needed to undo restore.

## Required evidence before real records
D1 native migration/constraint and concurrency tests; actual Worker bindings/auth; export checksum + isolated restore rehearsal; R2 object/reference reconciliation; DO restart/replay; session and substitute revocation after restore; documented RPO/RTO measured on the tested environment.
Local SQLite export/restore tests are useful migration evidence, **not proof Time Travel or cloud backups work for this account**.

References: [Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/), [SQL import/export](https://developers.cloudflare.com/d1/best-practices/import-export-data/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/).
