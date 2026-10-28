# AGENTS.md — Mandatory first read for every AI / developer

You are working on **نور القرآن (Noor Al-Quran)**, repository geminiamo0-ship-it/nour-elquran.

**READ THIS FILE FIRST**, before proposing an implementation, running commands or modifying any file.

## Required ordered reading
1. AGENTS.md (this file)
2. PROJECT_STATUS.md (source of truth for what is actually done)
3. NOOR_MASTER_PLAN.md (approved vs pending decisions)
4. docs/ENGINEERING_GUARDRAILS.md
5. docs/REPOSITORY_MAP.md
6. docs/TEST_STRATEGY.md and docs/SECURITY_PRIVACY.md
7. CONTRIBUTING.md
8. The active GitHub Issue, relevant PRs / Actions results / ADRs

If any of these cannot be read, STOP writing code until the missing context is reconciled. Do not invent project progress from conversation summaries.

## Hard operating rules
- GitHub is the durable record. **Every change needs an Issue before work starts**, including UI details, refactors, infrastructure, fixes and documentation.
- Use a dedicated branch and linked PR; never push feature work directly to main. The one-time empty-repo bootstrap exception is explained in Issue #1.
- Commit messages must describe what and why, and reference Issue number. Prefer scoped conventional commits.
- In the PR report exact changed paths, tests, observed outcomes, commit SHA, risks and rollback.
- Run/inspect GitHub Actions; do not say passed, deployed, verified, production-ready or fixed without evidence from the corresponding environment and commit.
- Update PROJECT_STATUS.md after meaningful changes and active Issue checklists/comments with supporting evidence.
- If direction or design changes, record an ADR and mark the old plan superseded rather than silently changing course.
- Never close an Issue until acceptance criteria and tests pass, and record the test run.
- End every handoff with a clear next exact action and any blockers; details in docs/AI_HANDOFF.md.
- Never commit secrets, tokens, real children’s names/voices, student information, production database dumps or unlicensed Quran media.
- Respect role/profile authorization and minors' safety. Audio correction by AI is advisory until validated by qualified teachers.
- If unapproved architecture/feature details are ambiguous, write questions/proposals, not code.

## Confirmed product direction (not evidence of implementation)
- Arabic RTL, polished restrained Azhar-inspired visual language, dark ochre/gold, ivory, deep green; mobile-first and accessible.
- For all ages, with emphasis on children; **no separate parent dashboard**.
- One Supabase Auth account may manage several independently scoped student profiles (siblings). The selected student profile drives UI, lessons, tutors and training; switching cannot leak cross-profile data.
- Teacher-led one-to-one lessons; reports after class lead to structured, interactive practice before the next class.
- Frontend-first mock workflows; backend and LiveKit integration later, with early technical spike permitted when agreed.
- Proposed technology: Next.js/Cloudflare UI; Cloudflare Worker/DO/Queues; Supabase Auth/PostgreSQL; LiveKit self-hosted on Hetzner; optional LLM planner. Hosting adapter and detailed topology still require verification.

## Agent quick checklist
1. Read status and current Issue.
2. Inspect real files and workflow history.
3. State scope, owners, contracts, tests and out-of-scope before editing.
4. Implement smallest cohesive slice on branch.
5. Test with actual commands and record output and CI run URLs.
6. Document map/decision/status in same PR.
7. Wait for checks and review; never falsely claim completion.

**Current priority:** Finish Issue #1 governance foundation; then discuss and approve the full product roadmap with the owner. Do NOT start designing/building feature pages without an approved Issue.
