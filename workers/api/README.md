# Noor Workers API

CF-01 / #104 and AUTH-01 / #110 implement the local Workers/D1 foundation and opt-in maintained authentication. Cloud deployment, frontend auth integration, published lessons and uploads remain pending.

## Paths and behavior
- src/index.ts: GET /health (/healthz alias) liveness; GET /ready (/readyz alias) checks core/auth schema and explicit configuration. Without valid configuration, /v1/* and /api/auth/* return 503 AUTH_NOT_CONFIGURED regardless of supplied identity headers.
- src/authorization.ts: server-input-only read/report permission helpers; explicit account ownership, optional restricted learner scope, active qualified teacher assignment, limited staff grants, timely explicit substitute consent, brief expiry and first-publication report correction cutoff. Not an HTTP authentication implementation.
- migrations/0001_core.sql: strict accounts/learners/teachers/staff grants, assignments, lesson scope, verified-metadata anchors and private annotations. No Quran text or real student data. Complete report/booking/billing schemas follow in their own issues.
- wrangler.jsonc: LOCAL ONLY, zero UUID, workers.dev/previews off. No remote database is represented by this config. Actual environment bindings/IDs and pinned tooling are required before deployment.
- tests: Node policy/handler tests and Python SQLite constraint/replay/transaction/export-restore tests.

## Verification
From repository root: pnpm test:backend; pnpm typecheck; pnpm build:api. The runtime tests use Node's TypeScript stripping and Python standard-library SQLite; root CI installs the pinned TypeScript compiler.
AUTH-01 pins Better Auth 1.7.14 and Drizzle 0.45.2 in the root manifest and lockfile. Node/Python tests do not prove native Cloudflare D1/DO or Workers behavior. Before enabling real data: integrate a maintained auth library under #46; bind a dedicated staging D1; apply via migration tooling; verify SQL/Worker authorization, backup and restore in that environment.

## Data permissions
Accounts and learners are different identities. Same-account profile switching is intentional adult access, not isolation from the authorized owner. A child-only session requires a verified restricted profile binding. Private notes are not teacher-readable. Owner/child write and sharing powers await their explicit policy; these helpers grant no private-write API.
Teacher access and report state must be loaded server-side. The substitute correction deadline is fixed from the first publication, not reset by amendments; no first-report grace period is invented when its policy is unspecified. Consent deadline is supplied only by the server's approved scheduling policy.

See [architecture](../../docs/ARCHITECTURE.md), [ADR](../../docs/adr/0004-cloudflare-only-platform.md), [backup runbook](../../docs/CLOUDFLARE_BACKUP_AND_RESTORE.md).

## Native local integration smoke (#46)
Run `bash scripts/cloudflare-local-smoke.sh` from the repository root (Node 22, npm/npx and network access to install pinned Wrangler 4.45.0 required). The script uses a disposable local D1 state and never invokes `--remote` or `deploy`. GitHub Verify runs it in the `cloudflare-local-d1` job. This verifies migration replay and actual local Worker/D1 binding while authentication remains fail-closed; it is **not** staging or production validation.


## AUTH-01 contracts and configuration

Authentication is disabled in the checked-in configuration. Explicitly set `AUTH_ENABLED=true`, a random `AUTH_SECRET` of at least 32 characters, and canonical HTTPS `AUTH_ORIGIN` (origin only, no slash/path). Supply the D1 binding and apply 0001 then 0002. Never commit secrets. `AUTH_LOCAL_DEV=true` permits HTTP localhost/127.0.0.1 only. Local sample D1 ID is not a real resource. `nodejs_compat` is required.

| Method/path | Body / result |
| --- | --- |
| POST /api/auth/register | `{name, phoneNumber, password}` → safe user, phoneVerified flag and session cookie |
| POST /api/auth/login | `{phoneNumber, password}` → safe user and session cookie |
| POST /api/auth/logout | Revoke current session, expire cookie |
| GET /api/auth/session | Current safe user and phoneVerified flag; 401 if invalid |
| GET /v1/me/learners | Active profiles owned by authenticated account |
| POST /v1/me/learners | `{name, learnerType: "adult" or "child"}` → profile; up to eight active profiles |
| GET /v1/learners/:id | Owner-only profile; other account receives 404 |

Mutations require an Origin header exactly matching AUTH_ORIGIN. Deploy frontend/API under the same trusted origin; no cross-origin CORS session configuration is implied. Credential registration and login are each limited to five attempts per 60 seconds per trusted client IP (shared bucket if unavailable). Password length is 8–128; name 1–80; JSON bodies at most 16 KiB. Egyptian local mobile input is normalized to +20, other numbers require E.164. Client accountId/role/verification fields are rejected. Raw `/internal-auth/*` routes return 404.

Better Auth uses its own scrypt password hashing/signing and the first-party Drizzle D1 adapter with transactions disabled. Cookie cache is disabled: logout/expiry is checked in D1. Production cookies are Secure/HttpOnly/SameSite=Lax, lifetime seven days. Wrapper never returns raw session tokens or internal email addresses. Core account is created lazily from the library's server-verified subject and disabled accounts cannot access learner routes.

`phoneVerified=false` is intentional: no OTP or recovery provider is configured. Internal random `.invalid` email identifiers satisfy the library's credential schema and are not contact/recovery addresses. This slice is not ready for real-user rollout until phone ownership/recovery, frontend UX, child/adult and staff authorization, cloud staging and operational checks in #46 are completed.

Run `bash scripts/cloudflare-auth-smoke.sh` after `pnpm install --frozen-lockfile`. It refuses to overwrite `.dev.vars`, creates isolated local D1/secret state, exercises synthetic accounts and removes its own secret/state on exit. Never run it against remote resources. Migration rollback: disable AUTH_ENABLED and retain additive auth tables/data; do not delete accounts or migrate down a live database.

## Account frontend integration (#112)
Root Workers configuration now uses `workers/site` to combine the static Next.js export and existing API under the same origin. Static paths/404s pass through ASSETS; API paths delegate to this handler. No remote D1 binding or auth settings were provisioned. Authenticated frontend can be built explicitly with `NEXT_PUBLIC_ACCOUNT_UI=true`; default builds retain the demo and make no account requests. This public switch does not enable backend auth.

After opt-in frontend build, `bash scripts/cloudflare-auth-browser.sh` verifies the full local Chrome/Worker/D1 journey using a generated temporary config/secret and reserved synthetic contacts. The script never deploys or runs remote SQL. Do not turn on real-user rollout until #46 verification/recovery, role policy, staging and operations pass. Root rollback: disable UI/server flags, keep additive tables. See ADR 0006 for same-origin contracts and partial-registration recovery.


## Classroom booking guard proposal (#120, PR #121)

`migrations/0003_teacher_schedule.sql` enforces that every **new** lesson reserves one contiguous 40-minute booking for both the learner and acting teacher; adjacent bookings are allowed. D1 triggers reject overlap on inserts, status reactivation and rescheduling; canceled slots release capacity. Old 30-minute records are preserved, not rewritten. The previously approved 30-minute instructional target and teacher-only manual Start/End are **not** auto-enforced by this migration. The 40-minute reservation does not bill or extend any entitlement automatically.

`tests/test_teacher_calendar.py` covers new slots, collisions, simultaneous unrelated lessons, canceled/reactivated slots, historical rows and migrations. Apply `0003` only after `0001` and `0002`; run `pnpm test:backend` and local D1 migration smoke before staging. The migration remains a PR pending CI/review and must not be treated as already live in staging. **Not yet built:** authenticated scheduling REST endpoints, teacher presence/Start/End, media rooms, payments, reporting or compensation decisions.

Booking eligibility follow-up (#120, draft PR #121): new/reactivated scheduled lessons require an active qualified teacher, active learner and active owning account; schedule edits revalidate all three. This is enforced by additive D1 triggers and synthetic SQLite tests, not by a new HTTP API. Historical lessons can still complete after an account/learner is disabled or archived. An authenticated actor/teacher-only Start/End and two-person waiting-room presence remain separate, unimplemented authorization requirements.

### Historical lesson identities (#120, draft PR #121)
The core `0001_core.sql` already prohibits changing a lesson's `learner_id`, even if the target learner is active. The additive `0003_teacher_schedule.sql` also prevents rewriting `actual_teacher_id` once a lesson is live or completed, while allowing qualified teacher reassignment during scheduling. These are database-integrity safeguards, not authenticated teacher-only Start/End, two-person presence or substitute consent. No remote migration was applied.
