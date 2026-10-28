import importlib.util
from pathlib import Path
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[2] / ".github/scripts/check_boundaries.py"
spec = importlib.util.spec_from_file_location("check_boundaries", SCRIPT)
checker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checker)


class ImportBoundaryTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)

    def write(self, path: str, content: str) -> None:
        dest = self.root / path
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(content, encoding="utf-8")

    def test_valid_feature_and_public_api(self):
        self.write("apps/web/src/app/page.tsx", 'import { Panel } from "@/features/alpha";')
        self.write("apps/web/src/features/alpha/index.ts", 'export { Panel } from "./components/Panel";')
        self.write("apps/web/src/features/alpha/components/Panel.tsx", 'import { format } from "@/features/beta";')
        self.write("apps/web/src/features/beta/index.ts", 'export const format = () => "ok";')
        self.assertEqual([], checker.check(self.root))

    def test_rejects_feature_deep_import(self):
        self.write("apps/web/src/features/alpha/index.ts", 'import { X } from "@/features/beta/components/X";')
        self.write("apps/web/src/features/beta/components/X.ts", "export const X = 1;")
        self.assertTrue(any("cross-feature" in e for e in checker.check(self.root)))

    def test_rejects_shared_to_feature(self):
        self.write("apps/web/src/shared/ui/Badge.tsx", 'import "@/features/alpha";')
        self.write("apps/web/src/features/alpha/index.ts", "export const x = 1;")
        self.assertTrue(any("shared cannot" in e for e in checker.check(self.root)))

    def test_rejects_domain_react(self):
        self.write("packages/domain/src/model.ts", 'import { useState } from "react";')
        self.assertTrue(any("domain cannot" in e for e in checker.check(self.root)))

    def test_detects_cycles(self):
        self.write("apps/web/src/features/alpha/a.ts", 'import { b } from "./b"; export const a = 1;')
        self.write("apps/web/src/features/alpha/b.ts", 'import { a } from "./a"; export const b = 1;')
        self.assertTrue(any("Import cycle:" in e for e in checker.check(self.root)))

    def test_empty_repo_is_safe(self):
        self.assertEqual([], checker.check(self.root))


if __name__ == "__main__":
    unittest.main()
