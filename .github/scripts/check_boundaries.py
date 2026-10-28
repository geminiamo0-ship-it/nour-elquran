#!/usr/bin/env python3
"""Noor import boundary and cycle gate; standard library only.

Only scans source files actually present. Tests use synthetic fixture trees before
an application exists. This is not a TypeScript compiler or a substitute for ESLint.
"""
from __future__ import annotations

import argparse
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
EXTENSIONS = (".ts", ".tsx", ".js", ".jsx", ".mts", ".cts")
IMPORT_FROM = re.compile(
    r"(?m)^\s*(?:import|export)\s+(?:type\s+)?[^;]*?\bfrom\s*['\"]([^'\"]+)['\"]"
)
IMPORT_SIDE_EFFECT = re.compile(r"(?m)^\s*import\s*['\"]([^'\"]+)['\"]")
IMPORT_CALL = re.compile(r"\b(?:import|require)\s*\(\s*['\"]([^'\"]+)['\"]\s*\)")


def sources(root: Path) -> list[Path]:
    locations = [root / "apps/web/src"]
    packages = root / "packages"
    if packages.exists():
        locations.extend(p / "src" for p in packages.iterdir() if p.is_dir())
    return sorted(
        p.resolve()
        for location in locations if location.is_dir()
        for p in location.rglob("*")
        if p.is_file() and p.suffix in EXTENSIONS
        and not any(part in {"node_modules", ".next", "dist", "generated"} for part in p.parts)
    )


def imports(text: str) -> set[str]:
    return set(IMPORT_FROM.findall(text)) | set(IMPORT_SIDE_EFFECT.findall(text)) | set(IMPORT_CALL.findall(text))


def resolve_import(root: Path, source: Path, spec: str) -> Path | None:
    if spec.startswith("@/"):
        base = root / "apps/web/src" / spec[2:]
    elif spec.startswith("@noor/"):
        parts = spec.split("/")
        if len(parts) < 2:
            return None
        base = root / "packages" / parts[1] / "src"
        if len(parts) > 2:
            base = base.joinpath(*parts[2:])
    elif spec.startswith("."):
        base = source.parent / spec
    else:
        return None
    base = base.resolve()
    candidates = [base] + [Path(str(base) + ext) for ext in EXTENSIONS]
    candidates.extend(base / ("index" + ext) for ext in EXTENSIONS)
    return next((p for p in candidates if p.is_file()), None)


def role(root: Path, path: Path) -> tuple[str, str | None]:
    try:
        relative = path.relative_to(root.resolve()).parts
    except ValueError:
        return "outside", None
    if relative[:3] == ("apps", "web", "src"):
        if len(relative) >= 4:
            if relative[3] == "features" and len(relative) >= 5:
                return "feature", relative[4]
            return relative[3], None
    if relative[:3] == ("packages", "domain", "src"):
        return "domain", None
    return "other", None


def check(root: Path) -> list[str]:
    root = root.resolve()
    files = sources(root)
    graph: dict[Path, set[Path]] = {p: set() for p in files}
    problems: set[str] = set()
    for source in files:
        source_role, source_feature = role(root, source)
        for spec in imports(source.read_text(encoding="utf-8")):
            target = resolve_import(root, source, spec)
            target_role, target_feature = role(root, target) if target else ("external", None)
            label = source.relative_to(root).as_posix()
            if target in graph:
                graph[source].add(target)
            if source_role == "shared" and target_role in {"feature", "app"}:
                problems.add(f"{label}: shared cannot import {spec}")
            if source_role == "feature" and target_role == "app":
                problems.add(f"{label}: feature cannot import app route {spec}")
            if source_role == "feature" and target_role == "feature" and source_feature != target_feature:
                if target is None or target.name not in {"index.ts", "index.tsx", "index.js", "index.jsx"} or target.parent.name != target_feature:
                    problems.add(f"{label}: cross-feature import must use public index: {spec}")
            if source_role == "domain":
                forbidden = ("react", "next", "@/", "@noor/ui", "@supabase", "livekit", "cloudflare:")
                if target_role in {"app", "feature", "shared"} or spec.startswith(forbidden):
                    problems.add(f"{label}: domain cannot depend on UI/runtime adapter: {spec}")
    # DFS detects cycles in source imports; graph is finite and no node is visited twice.
    visited: set[Path] = set()
    active: set[Path] = set()
    stack: list[Path] = []

    def visit(node: Path) -> None:
        if node in visited:
            return
        visited.add(node)
        active.add(node)
        stack.append(node)
        for next_node in sorted(graph[node]):
            if next_node in active:
                cycle = stack[stack.index(next_node):] + [next_node]
                names = " -> ".join(p.relative_to(root).as_posix() for p in cycle)
                problems.add(f"Import cycle: {names}")
            elif next_node not in visited:
                visit(next_node)
        stack.pop()
        active.remove(node)

    for node in sorted(graph):
        visit(node)
    return sorted(problems)


def main() -> int:
    parser = argparse.ArgumentParser(description="Noor feature import boundaries")
    parser.add_argument("--root", type=Path, default=ROOT)
    args = parser.parse_args()
    errors = check(args.root)
    for error in errors:
        print("FAIL:", error)
    if errors:
        return 1
    count = len(sources(args.root))
    print(f"PASS: module boundaries and cycles ({count} source files; 0 means no app exists yet).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
