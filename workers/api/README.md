# Noor API foundation

CF-01 / #104 implements a modular Workers handler, read-policy helpers, local D1 migration and tests. No authentication library, real user session, cloud deployment, published lesson or upload is implemented yet.

## Paths and behavior
- src/index.ts: GET /health (/healthz alias) liveness; GET /ready (/readyz alias) checks core schema and stays 503 until auth exists. /v1/* is deliberately 503 AUTH_NOT_CONFIGURED, regardless of client identity/JWT/cookie headers.
- src/authorization.ts: server-input-only read/report permission helpers; explicit account ownership, optional restricted learner scope, active qualified teacher assignment, limited staff grants, timely explicit substitute consent, brief expiry and first-publication report correction cutoff. Not an HTTP authentication implementation.
- migrations/0001_core.sql: strict accounts/learners/teachers/staff grants, assignments, lesson scope, verified-metadata anchors and private annotations. No Quran text or real student data. Complete report/booking/billing schemas follow in their own issues.
- wrangler.jsonc: LOCAL ONLY, zero UUID, workers.dev/previews off. No remote database is represented by this config. Actual environment bindings/IDs and pinned tooling are required before deployment.
- tests: Node policy/handler tests and Python SQLite constraint/replay/transaction/export-restore tests.

## Verification
From repository root: pnpm test:backend; pnpm typecheck; pnpm build:api. The runtime tests use Node's TypeScript stripping and Python standard-library SQLite; root CI installs the pinned TypeScript compiler.
No new dependency is added by this slice. Node/Python tests do not prove native Cloudflare D1/DO or Workers behavior. Before enabling real data: integrate a maintained auth library under #46; bind a dedicated staging D1; apply via migration tooling; verify SQL/Worker authorization, backup and restore in that environment.

## Data permissions
Accounts and learners are different identities. Same-account profile switching is intentional adult access, not isolation from the authorized owner. A child-only session requires a verified restricted profile binding. Private notes are not teacher-readable. Owner/child write and sharing powers await their explicit policy; these helpers grant no private-write API.
Teacher access and report state must be loaded server-side. The substitute correction deadline is fixed from the first publication, not reset by amendments; no first-report grace period is invented when its policy is unspecified. Consent deadline is supplied only by the server's approved scheduling policy.

See [architecture](../../docs/ARCHITECTURE.md), [ADR](../../docs/adr/0004-cloudflare-only-platform.md), [backup runbook](../../docs/CLOUDFLARE_BACKUP_AND_RESTORE.md).

## Native local integration smoke (#46)
Run `bash scripts/cloudflare-local-smoke.sh` from the repository root (Node 22, npm/npx and network access to install pinned Wrangler 4.45.0 required). The script uses a disposable local D1 state and never invokes `--remote` or `deploy`. GitHub Verify runs it in the `cloudflare-local-d1` job. This verifies migration replay and actual local Worker/D1 binding while authentication remains fail-closed; it is **not** staging or production validation.

