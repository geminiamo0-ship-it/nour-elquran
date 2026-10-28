# Noor API — CF-01 isolated foundation (#104)

This is **not deployed**, does not contain real authentication and exposes no student endpoints. `src/index.ts` exports a Workers-compatible fetch handler; `/healthz` is a liveness probe, `/readyz` probes the optional D1 `DB` binding and fails closed. Every `/v1` request returns 401 even when the caller supplies identity headers or an unverified token.

The SQL migration is a **new empty D1 schema proposal**, not a production change. Apply only to an isolated test D1 after approved environment provisioning; never point it at an existing database. SQLite foreign keys and composite learner/lesson references prevent mismatched records; they do **not** replace server authorization. A future authenticated use case must verify account/role and scope every query, including write paths, before protected endpoints are enabled.

Local validation from repository root (Node 22 + pnpm installed):
- `pnpm backend:typecheck`
- `pnpm backend:test` (Node 22 experimental type stripping and SQLite; real in-memory migration, no external network)

No Wrangler deployment config, database IDs, secrets, production routes, R2 objects, Durable Objects or paid services are created here. See `docs/adr/0004-cloudflare-only-backend.md` for ownership, Time Travel limitations and staged rollout.
