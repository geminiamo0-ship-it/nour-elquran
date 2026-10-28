# Module boundaries — Noor Al-Quran

**Status:** Enforced in PR governance by [#57](https://github.com/geminiamo0-ship-it/nour-elquran/issues/57) once this change merges. This is a **pre-application guardrail**, not proof that the web application exists.

## Direction and ownership
- **app/routes**: thin URL entrypoints, layout, route-level access checks and composition. Keep application mutations outside route JSX.
- **features/<name>**: private UI components, view models/hooks and adapters for one cohesive feature. A feature may import another feature **only through that feature's root index**. No deep imports.
- **shared/**: design-system primitives, generic hooks and utilities only. It cannot import application routes or domain features.
- **packages/domain/src/**: framework-independent business logic. It must not import React, Next, browser-specific UI, Supabase clients, LiveKit or Cloudflare runtime adapters.
- **packages/contracts/**: runtime-validated schemas, transport DTOs and typed errors. API adapters implement contracts; components never contain authoritative booking, billing or attendance rules.

Do not add empty packages or split trivial functions into hundreds of files. The design standard in #57 uses **review targets**: route entrypoint 30–80 lines (review above 120), component 50–150 (review above 250), general source files around 300 (review), with justified exceptions.

## Automated baseline
- \`.github/scripts/check_boundaries.py\` scans \`apps/web/src\` and existing \`packages/*/src\` TS/JS sources.
- It rejects shared-to-feature/app imports, feature-to-app imports, deep cross-feature imports, domain-to-UI/runtime imports and import cycles.
- \`tests/governance/test_boundaries.py\` supplies synthetic positive/negative fixtures. This is important **before** any app files exist: a zero-file scan is explicitly reported and does not count as app validation.
- Run locally: \`python3 .github/scripts/check_boundaries.py\` and \`python3 -m unittest discover -s tests/governance -p 'test_*.py' -v\`.
- The existing \`repository-policy\` GitHub Actions job runs the checker; the \`governance-tests\` job exercises the fixtures.

## Limits and follow-up for #39
This Python checker recognizes standard static imports, re-exports, relative imports, the \`@/\` web alias and \`@noor/<package>\` package aliases. It is **not** a TypeScript AST parser. It does not verify all TS path aliases, barrel export semantics, dynamic nonliteral imports or every bundler resolution rule. During workspace bootstrap (#39), add type-aware ESLint and/or dependency-cruiser with the real TS config to enforce equivalent boundaries, then test against deliberately illegal imports and CI failures. Do not remove the simple baseline until its replacement demonstrably covers all current cases.

**Not covered here:** actual frontend routes, app lint/build, RLS, user data, deployment or production readiness.
