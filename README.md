# نور القرآن | Noor Al-Quran

**Platform adopted:** Cloudflare-only, [ADR 0004](docs/adr/0004-cloudflare-only-platform.md), #104. Worker/D1 foundation is implemented on the current PR with targeted tests; real authentication, remote deployment and frontend/media cutover remain pending. Supabase/Postgres/RLS and historical LiveKit topology are superseded. [Backup and restore](docs/CLOUDFLARE_BACKUP_AND_RESTORE.md).


An Arabic-first, mobile-first Quran memorization and online tutoring platform for learners of all ages, with particular care for children and families.

**Current baseline (2026-10-29 Cairo): native Next.js frontend, student Quran reader and Training prototype exist on main at `906a993d` (PR #100 merged). Learner state is local/demo; no backend/auth database, operational classroom, payments or WhatsApp integration is claimed.**

Next: [lesson-notebook and backend-readiness plan](docs/LESSON_NOTEBOOK_AND_BACKEND_READINESS_PLAN.md), planning [#101](https://github.com/geminiamo0-ship-it/nour-elquran/issues/101), notebook execution [#102](https://github.com/geminiamo0-ship-it/nour-elquran/issues/102), then Workers/D1 identity and application authorization #46. Read current PROJECT_STATUS before older foundation descriptions.

## Before any work
Read in this order:
1. [AGENTS.md](AGENTS.md) — binding agent instructions. **Start here.**
2. [PROJECT_STATUS.md](PROJECT_STATUS.md) — verified current state, blockers and next action.
3. [NOOR_MASTER_PLAN.md](NOOR_MASTER_PLAN.md) — decisions vs proposals, current roadmap.
4. [docs/ENGINEERING_GUARDRAILS.md](docs/ENGINEERING_GUARDRAILS.md) — mandatory boundaries.
5. [CONTRIBUTING.md](CONTRIBUTING.md) — GitHub process, tests and evidence.
6. The active GitHub issue / PR.

## Repository governance
All planned work has a GitHub Issue **before coding**; make focused branches, descriptive commits, traceable PRs, run verification, document exact SHA/evidence and update status. Never mistake code written for feature verified or deployed.

- [Architecture](docs/ARCHITECTURE.md)
- [Repository map](docs/REPOSITORY_MAP.md)
- [Testing strategy](docs/TEST_STRATEGY.md)
- [Security and children’s privacy](docs/SECURITY_PRIVACY.md)
- [Handoff checklist](docs/AI_HANDOFF.md)
- [CI / branch protection](docs/CI_BRANCH_PROTECTION.md)
- [ADR records](docs/adr/TEMPLATE.md)

Original foundation discussion is retained in the master plan. Current owner decisions and execution order are in PROJECT_STATUS and the linked plan/Issues; proposed provider and operational choices remain explicitly marked.

Foundation: [Issue #1](https://github.com/geminiamo0-ship-it/nour-elquran/issues/1).

