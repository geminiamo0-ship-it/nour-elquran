# ADR 0001: Issue-first and AI-continuable repository governance

Date: 2026-10-28
Status: proposed pending Issue #1 verification/merge
Issue: #1

## Context
The repository was empty. The owner requires Santoreno-level documentation, clear GitHub issue traceability, detailed commits, and GitHub Actions verification so independent AIs can continue safely.

## Alternatives
Ad hoc chat-based implementation is fast initially but loses context. Overly elaborate enterprise project tooling delays shipping. Lightweight docs plus strict issue/PR/CI gates balances clarity and cost.

## Decision
Create AGENTS.md first-read contract; PROJECT_STATUS and NOOR_MASTER_PLAN; guardrails, map, ADRs, Issue/PR templates; conditional CI. One tiny direct-main bootstrap commit only because empty repository cannot host initial feature branch; all further work through Issues/PRs.

## Consequences
Every change requires documentation and evidence; decisions remain reviewable. Branch rules still need explicit GitHub settings outside code. Product work waits for owner roadmap discussion.

## Verification
Issue #1; foundation PR and its CI run to be recorded after execution.
