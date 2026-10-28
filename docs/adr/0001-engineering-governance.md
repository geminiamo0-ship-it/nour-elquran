# ADR 0001: Issue-first and AI-continuable repository governance

Date: 2026-10-28
Status: accepted for documentation/process; external GitHub protection settings pending
Issue: #1
PR: #2

## Context
The repository was empty. The owner requires Santoreno-level documentation, clear GitHub issue traceability, detailed commits, and GitHub Actions verification so independent AIs can continue safely.

## Alternatives
Ad hoc chat-based implementation is fast initially but loses context. Overly elaborate enterprise project tooling delays shipping. Lightweight docs plus strict issue/PR/CI gates balances clarity and cost.

## Decision
Create AGENTS.md first-read contract; PROJECT_STATUS and NOOR_MASTER_PLAN; guardrails, map, ADRs, Issue/PR templates; conditional CI. One tiny direct-main bootstrap commit only because empty repository cannot host initial feature branch; all further work through Issues/PRs.

## Consequences
Every change requires documentation and evidence; decisions remain reviewable. Branch rules still need explicit GitHub settings outside code. Product work waits for owner roadmap discussion. Public visibility is an explicit risk.

## Verification
PR #2 merged as 24f57aa8c9024eb1cbd246a57ae5dff758a07e28.
Exact-head [Verify 40611500146](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/40611500146) and post-merge [Verify 40611612261](https://github.com/geminiamo0-ship-it/nour-elquran/actions/runs/40611612261) succeeded for governance-only checks. Code quality skipped because no app exists.
[Ruleset enforcement](../CI_BRANCH_PROTECTION.md) remains pending.
