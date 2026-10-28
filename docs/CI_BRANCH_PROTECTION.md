# GitHub verification and branch-protection operations

## Available in-repo automation
.github/workflows/verify.yml runs governance policy and governance test jobs on PR/main.
After package.json is added, Verify requires deterministic package manager install, lint, typecheck, tests, build, smoke. **App checks cannot be counted as run/passed before app exists.**

## Required manual GitHub ruleset configuration
Repository Settings → Rules → Rulesets or Branches → Add rule protecting main:
1. Require pull request before merging.
2. Require 1 reviewer approval (or suitable owner-approved alternative).
3. Require status checks from the actual workflow names after first PR has run, e.g. repository-policy, governance-tests, code-quality.
4. Prevent force pushes and deletion of main.
5. Require conversation resolution and dismiss stale approvals where supported.
6. Restrict bypass permissions; prevent direct pushes to main.
7. Review Actions default token permissions (read by default) and enable Dependabot alerts/updates.

**Important:** files and CODEOWNERS do not themselves enable ruleset enforcement. Managed GitHub connectors may lack permissions to set protected branch rules; record these settings as PENDING until actually observed in GitHub UI/API.

## Before marking green
Record exact PR head SHA, checks status and conclusion, merge SHA, post-merge main checks. Distinguish checks skipped/no code from checks passed.
