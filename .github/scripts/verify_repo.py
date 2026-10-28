#!/usr/bin/env python3
"""Repository governance verification: standard-library only; no secrets printed."""
import json
import os
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
REQUIRED = [
    "README.md", "AGENTS.md", "CONTRIBUTING.md",
    "PROJECT_STATUS.md", "NOOR_MASTER_PLAN.md",
    "docs/ARCHITECTURE.md", "docs/ENGINEERING_GUARDRAILS.md",
    "docs/REPOSITORY_MAP.md", "docs/TEST_STRATEGY.md",
    "docs/SECURITY_PRIVACY.md", "docs/AI_HANDOFF.md",
    "docs/CI_BRANCH_PROTECTION.md", "docs/adr/TEMPLATE.md",
    ".github/PULL_REQUEST_TEMPLATE.md",
    ".github/workflows/verify.yml", ".github/CODEOWNERS",
    ".github/dependabot.yml",
]

def check_required(root=ROOT):
    problems = []
    for name in REQUIRED:
        target = root / name
        if not target.is_file() or target.is_symlink():
            problems.append(f"Missing or symlinked required file: {name}")
    return problems

def check_links(root=ROOT):
    """Check relative .md links; ignore http, mailto and heading-only targets."""
    problems = []
    for document in root.rglob("*.md"):
        if ".git" in document.parts or "node_modules" in document.parts:
            continue
        text = document.read_text(encoding="utf-8")
        for target in re.findall(r"(?<!!)\[[^\]]+\]\(([^)]+)\)", text):
            destination = target.split("#", 1)[0].split("?", 1)[0]
            if not destination or "://" in destination or destination.startswith(("mailto:", "/")):
                continue
            if not (document.parent / destination).exists():
                problems.append(f"{document.relative_to(root)}: broken link {target}")
    return problems

def check_git_safety(root=ROOT):
    problems = []
    tracked = subprocess.check_output(
        ["git", "ls-files", "-z"], cwd=root
    ).decode().split("\0")
    forbidden = re.compile(r"(^|/)(\.env(?:\.(?!example$)[^/]*)?|id_rsa|id_ed25519)$|\.(pem|p12|pfx|key)$", re.I)
    for item in filter(None, tracked):
        if forbidden.search(item):
            problems.append(f"Forbidden tracked secret-like filename: {item}")
        path = root / item
        if path.is_file() and not path.is_symlink():
            try:
                content = path.read_text(encoding="utf-8")
            except UnicodeError:
                continue
            if re.search(r"^(<<<<<<< |>>>>>>> |=======$)", content, re.M):
                problems.append(f"Unresolved conflict marker: {item}")
    return problems

def check_issue_reference(event_file=None):
    """On PR only, require an Issue reference in body."""
    if not event_file or not Path(event_file).exists():
        return []
    event = json.loads(Path(event_file).read_text(encoding="utf-8"))
    if "pull_request" not in event:
        return []
    body = event["pull_request"].get("body") or ""
    if not re.search(r"(?i)\b(?:closes|fixes|refs)\s+#\d+\b", body):
        return ["Pull request body must reference an issue: Closes #N or Refs #N"]
    return []

def main():
    problems = (check_required() + check_links() + check_git_safety()
                + check_issue_reference(os.getenv("GITHUB_EVENT_PATH")))
    if problems:
        for issue in problems:
            print("FAIL:", issue, file=sys.stderr)
        return 1
    print("PASS: governance required files, markdown links, git safety, PR issue linkage.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
