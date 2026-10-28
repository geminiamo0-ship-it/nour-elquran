# ADR 0003 — Cloudflare vinext compatibility spike (evidence pending)

- Date: 2026-10-28
- Issue: [CORE-02 #40](https://github.com/geminiamo0-ship-it/nour-elquran/issues/40)
- Status: **PROPOSED — NO STACK SELECTION / NO DEPLOYMENT**

## Decision under evaluation

Keep **Next.js 16 App Router + React 19 + strict TypeScript** as the existing
frontend baseline. Probe **vinext 1.3.1** as a Cloudflare Workers deployment
adapter, in an isolated CI checkout. Do not switch to TanStack Start or
OpenNext without reproducible compatibility evidence.

Cloudflare recommends vinext for new Workers-based Next.js applications:
https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/
The upstream project documents non-destructive `vinext init`, `vinext check`
and local builds: https://github.com/cloudflare/vinext

## Automated experiment (PR CI, not production)

`.github/workflows/vinext-spike.yml` installs the frozen existing pnpm
workspace, then `scripts/vinext-spike.sh`:

1. Creates a synthetic, non-committed route-handler fixture for cookie reads.
2. Runs `vinext@1.3.1 check` and retains its diagnostic log, even if it
   identifies compatibility concerns.
3. Runs `vinext init --platform=cloudflare --skip-check` **only in CI**,
   installs generated dependencies, and attempts a Cloudflare-targeted build.
4. Boots the generated **local production server**, asserts landing/student
   SSR HTML and Arabic RTL, and verifies that the cookie handler distinguishes
   a synthetic cookie from its absence.
5. Uploads only diagnostic logs. Does not upload HTML, cookies, credentials,
   personal data, or generated config.

The compatibility scanner is diagnostic; a successful local server is not
proof that the same app works on the actual Workers runtime.

## Remaining gates before selecting adapter

- Exact-head CI results and actual compatibility warnings reviewed.
- Real local Workers runtime or authorized isolated staging: bindings, SSR,
  middleware, cookies, RSC/streaming, assets, Arabic fonts, mobile/RTL and
  error paths, with version and latency evidence.
- Document cache/storage implications, rollback and cost; confirm review.
- Do not provision paid services or publish production without owner approval.

## Risk and rollback

The probe changes no application runtime or production config on `main`.
To remove it, revert the linked PR. CI job uses only synthetic test input.

## Observations from first CI attempts (2026-10-28)

- [Verify 40723261830](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/40723261830): **success** (policy, governance, Next.js code-quality).
- [Probe 40723261961](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/40723261961): `vinext check` exit 0; **93% compatibility** (3/3 imports supported; one partial `reactStrictMode` App Router semantic). Cloudflare-targeted Vite build **succeeded**, with source-map and dynamic-import warnings. Harness failed because `vite preview` defaulted to port 4173 instead of expected 3137.
- [Probe 40724348902](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/40724348902): explicit preview port worked; **GET /** and **GET /student** both returned HTTP 200 with RTL HTML. The synthetic cookie route 404 was caused by our test fixture using an underscore-prefixed **private App Router folder**, not proof of a vinext limitation. Renamed the fixture to a public route segment in follow-up commit `1d8305a5`.
- **Still pending:** full cookie test on corrected exact HEAD, Workers bindings/real staging, React strict mode parity, fonts and streaming. The vinext initializer upgraded React dependency versions **in the disposable checkout**; therefore this build is not a like-for-like production dependency lockfile validation. No deploy occurred.
