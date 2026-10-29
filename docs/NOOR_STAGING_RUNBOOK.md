# Noor private Cloudflare staging runbook — #114

**State:** remote staging was deployed and verified 2026-10-29: [Santoreno run 40810303172](https://github.com/geminiamo0-ship-it/santoreno/actions/runs/40810303172) SUCCESS against Noor main SHA `dff83b382b3774a7476ae8dee64b7454fd09859c`. Remote synthetic account acceptance is complete; human QA and restore rehearsal remain separate. Source of truth: [status](../PROJECT_STATUS.md), [Cloudflare ADR](adr/0004-cloudflare-only-platform.md), [backup plan](CLOUDFLARE_BACKUP_AND_RESTORE.md).

## Isolation contract
- Dedicated D1: `noor-core-staging` with migrations 0001_core.sql and 0002_auth.sql from the Noor repository. No production UUID or databases (including Santo) may be used. Confirm real UUID by API; local sample all-zero UUID is prohibited.
- Dedicated Worker: `noor-site-staging` on a distinct HTTPS `workers.dev` origin. Static Next export + Workers API run under the **same origin**, with `assets.run_worker_first=true` for **all** routes. Without this setting static pages may bypass the Worker and bypass staging access.
- Deploy `NEXT_PUBLIC_ACCOUNT_UI=true` in build. Server-only `AUTH_ENABLED=true`, exact `AUTH_ORIGIN=https://noor-site-staging.<account-subdomain>.workers.dev`, `AUTH_SECRET` random >=32 characters, `NOOR_ENVIRONMENT=staging` and `STAGING_ACCESS_PASSWORD` random >=32 characters. Never commit secrets, place them in URLs, browser code or public GitHub artifacts.
- Access gate before static/API routing: HTTP Basic user `noor-preview`, secret password; staging hostname also forces the guard even if env flag is accidentally absent. No password -> 503; no/invalid credentials -> 401 for pages, static and APIs. Gate is **not** the user's Better Auth account login and must not be the only defense for actual child data. Cloudflare Access with individual access controls is preferred for later human QA.
- **Only synthetic QA identities**; no real phone numbers, guardians, child details, messages, payments or uploads. Phone remains unverified and OTP delivery intentionally absent.

## Execution gates and acceptance
1. Merge AUTH-02 #112 after exact-head Verify passes all four jobs; merge this #114 guard with unit/browser tests and review. Never bypass failing checks to enable remote registration.
2. Use a dedicated, narrowly scoped GitHub Actions workflow in `geminiamo0-ship-it/santoreno`, whose existing Cloudflare credentials are already stored as repository secrets; only read them in the job. The workflow must checkout a **verified Noor main SHA**, validate fail-closed guard and correct resource names, and halt before provisioning if unverified.
3. Create or reuse **only** `noor-core-staging`; check D1 UUID, apply migrations with `--remote`. Generate temporary Wrangler config in the Actions runner (not checked in); pin Wrangler version. Deploy `noor-site-staging` with single-origin Worker/assets, secrets and private gate; do not touch the existing `nour-elquran` production frontend Worker.
4. Remote smoke: without staging authorization, `/`, `/student/`, `/api/auth/session` and static assets must fail 401. With staging gate, `/health` must return 200 and `/ready` report configured D1/auth. With an isolated synthetic QA identity exercise registration, cookie session restore, two learner profiles, account separation, logout and replay denial. Verify `phoneVerified=false` and that no OTP is dispatched.
5. Preserve the exact deployed SHA, redacted logs and Actions URL as evidence. Do not report staging as ready until Cloudflare and browser HTTP checks truly pass. Keep credentials out of issue comments/screenshots.
6. For a user-visible staging link, set a **known** `STAGING_ACCESS_PASSWORD` through authorized Cloudflare secret management (or establish Cloudflare Access), not a password printed in GitHub logs. Rotate temporary credentials after testing.

## Rollback / limits
- Stop or disable only `noor-site-staging` while preserving the dedicated D1 for analysis. Production Workers/D1/R2 remain unchanged; no destructive rollback of shared resources.
- Phone verification, recovery, staff/minor login authorization, production secrets, paid services, message delivery and live learner data are out of scope.
- D1 Time Travel is not equivalent to tested restoration. Native remote backup/restore rehearsal and data retention are tracked separately under #56 before public use.
