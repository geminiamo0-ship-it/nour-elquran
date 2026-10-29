## B2 — staff-managed teacher identities and immutable D1 role ledger (#138)

**New endpoint:** `POST /v1/staff/teacher-actions` (JSON: `{targetUserId,action,reason,operationId}`), where action is `provision|qualify|activate|suspend|revoke_qualification`. Requires server-verified Better Auth staff session, active owning account, verified phone, explicit unrevoked `staff_grants.roles.manage`; the request cannot grant this permission itself. Strict origin checking, bounded JSON, exact four-key allowlist, UUID operation ID and mandatory reason. Actor/time come only from server.

- **Provision is disabled+unqualified**, never an active Sheikh. `qualify` requires explicit authorized staff decision; `activate` requires prior qualification. Target must already be a verified, active account (phone OTP delivery still unconfigured for real users). `suspend` immediately denies teacher access; `revoke_qualification` disables the teacher and clears qualification. Staff cannot modify own teacher role.
- `0005_teacher_roles.sql` commits each operation as a single append-only `teacher_role_events` INSERT. D1 triggers re-evaluate staff grant/target eligibility and apply teacher row mutation **atomically**, or reject both. Audit stores actor/target/role/action/time/reason/operation ID, cannot be changed/deleted. Operation replay returns an idempotent response and cannot be reused for a different action.
- Staff bootstrap `roles.manage` must ONLY be performed manually by trusted operators via restricted D1 tooling after independent identity checks. Never commit real IDs, OTP, passwords, API secrets, or create a public staff enrollment API. Do **not** manually set `phone_number_verified=1` for real users without evidence; native local CI uses only synthetic QA identities. This B2 PR **does not provision any real teacher**.
- All endpoints use the same-origin Worker and session cookie; public synthetic teacher preview remains unchanged, read-only real mode remains OFF until staging QA. Neither teacher-to-learner assignments nor bookings are created by role provisioning; those require a separate auditable admin API.
- Tests: Python SQLite applies full production migrations for D1 triggers and role replay/authorization; Node tests parse/resolve staff, plus `cloudflare-auth-smoke.mjs` native local Better Auth/D1 end-to-end with synthetic verified staff/teacher and session guard.

## Teacher read-only roster backend B1 (#136)

- `GET /v1/teacher/learners` is authenticated with Better Auth session verified by D1 and requires an active qualified teacher `teachers.auth_subject`. An eligible teacher receives `{learners:[{id,name,learnerType}],requestId}` (max 50 primary-assigned active learners); no matches means `learners:[]`.
- Only currently active, unrevoked `teacher_assignments` count for this general roster. A substitute grant **never** grants the general learner list. Archived learner, disabled owner, revoked/future/expired primary assignment excluded by SQL. No private notes, contacts, reports, or audio data.
- `401` without a valid session, `403 TEACHER_ACCESS_DENIED` without a qualified teacher; no caller-supplied teacher ID or client role is accepted. `GET /v1/teacher/lessons` remains the existing verified timetable endpoint.
- Teacher provisioning and editable study plans are NOT implemented; no server-side staff role is conferred by the public demo. Chrome preview remains synthetic until a guarded read-only UI adapter is explicitly enabled. No production D1 changes.

## Classroom terminal-status integrity (#120, draft PR #121)
The additive `0003_teacher_schedule.sql` now rejects a `live` lesson reverting to scheduled/cancelled and a completed lesson being reopened. This prevents bypass of the single-live guard through status rollback. Same-status updates and pre-start cancellation/reactivation are preserved. Synthetic SQLite tests exercise both denial and allowed transitions. These database triggers do **not** authorize teacher Start/End, verify simultaneous presence or provide request-ID idempotency; only authenticated use cases may change lesson status. No remote migration has been performed.

## Classroom live-room relational guard (#120, draft PR #121)
The additive `0003_teacher_schedule.sql` now also prevents a second `live` lesson for the same acting teacher or learner, even when their 40-minute booking intervals are adjacent and the first lesson overruns. INSERT and UPDATE paths are guarded; no timer auto-completes a lesson. `test_teacher_calendar.py` uses synthetic SQLite fixtures to cover overrun, unrelated concurrent rooms and direct inserts. This is a D1 data-integrity backstop, **not** teacher role authentication, verified two-party lobby presence, idempotent Start/End, or a deployed media room. Do not migrate remote D1 or expose a classroom mutation endpoint on this basis. Inspect exact-head Verify before merge.

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

## Classroom #120 — draft D1 lifecycle boundary
The unmerged `0003_teacher_schedule.sql` rejects direct creation of `live`/`completed` lessons, direct `scheduled -> completed`, and `cancelled -> live/completed`. A canceled reservation must reactivate as `scheduled` (eligibility and conflict rechecked) before a Start. Historical rows are preserved. **Do not expose raw SQL status changes to clients:** authenticated teacher-only Start/End, verified two-party lobby presence, durable idempotency, and end-time audit are not yet implemented. Tests: `python3 -m unittest discover -s workers/api/tests -p 'test_*.py'` plus exact-head GitHub Verify.


## Classroom lifecycle contract and audit (#120; pending PR)

`src/classroom/lifecycle.ts` defines **server-input-only**, strict teacher-only start/end authorization decisions. Start requires BOTH the verified teacher AND learner to be present in the same authorized lesson room. The teacher may choose to start after 15+ minutes of learner lateness. End is only possible by the acting teacher; the 30-minute teaching target and 40-minute reserved slot only cause display alerts, NEVER automatic media termination. The functions are **not wired to a public HTTP endpoint** and cannot be treated as live presence or authentication by themselves.

`migrations/0004_classroom_lifecycle.sql` adds an append-only, teacher-scoped D1 action ledger with unique per-lesson start/end events, immutable actor and timestamp history, and database constraints for ordering. See `tests/classroom-lifecycle.test.ts` and `tests/test_classroom_lifecycle_ledger.py`. Actual authenticated Worker/DO room presence and atomic D1 action+audit mutations will be wired as the next implementation phase; do not permit callers to supply `VerifiedRoomPresence` directly from request JSON. No deployed classroom or automatic timer end is introduced.


## Authenticated teacher and student calendar reads (#120)

The actual same-origin Better Auth session now supports `GET /v1/teacher/lessons` for a **qualified, active teacher** whose D1 teacher identity matches the verified auth subject. It reads no user-asserted teacher ID; the query requires a valid current primary teacher assignment or explicitly accepted, unrevoked lesson-specific grant. Returns only bounded lesson metadata and learner display names needed by the teacher's schedule; no private notes/child contacts or media URLs.

`GET /v1/me/learners/:learnerId/lessons` uses the verified account owner and previously verified selected learner ID, enforces D1 learner/account ownership again and returns only that learner's lesson times/states (max 50). Both routes return honest empty lists when there are no booked lessons. The teacher route **does not** create a synthetic owner account as a side effect. These are read-only HTTP APIs; there is no booking/create, teacher Start/End, room or streaming implementation in this slice. Real teacher provisioning and integrated native staging session/role testing are still needed.


## Classroom access-only first server slice (#50)

Two *read-only*, session-verified authorization probes are implemented without LiveKit secrets, room creation, peer presence or D1 writes:
- `GET /v1/teacher/lessons/:lessonId/access`: derives the qualified acting teacher from the actual Better Auth session `user.id`, checks active teacher/learner/account, lesson scheduled/live, current unrevoked primary assignment or explicit guardian-accepted substitute grant scoped to that exact lesson. Unknown/forbidden/terminal lesson => 404, no disclosure of another learner's data.
- `GET /v1/me/learners/:learnerId/lessons/:lessonId/access`: derives the owner's account through the trusted session and validates exact learner AND lesson ownership within the same account, active learner/account and scheduled/live state. No client role or arbitrary owner ID accepted.

`200` returns only benign appointment fields and explicit `roomConnected:false, code:'CLASSROOM_NOT_CONNECTED'`. **This is not a join token, media access, actual waiting-room presence or Start permission.** Connect LessonDO and real two-user join/ack then issue authorized short-lived LiveKit media tokens in a later PR. SQL regression tests (`tests/test_classroom_access.py`) execute the exact TypeScript SQL on additive real migration lineage and cover other teachers, sibling/resource IDs, substitute consent, revocation, qualification, disabled accounts and canceled lessons. Requires existing Better Auth and D1 to be configured; still no staging migration/deployment in this PR.
