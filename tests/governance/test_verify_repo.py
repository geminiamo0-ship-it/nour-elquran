import importlib.util
from pathlib import Path
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[2] / ".github/scripts/verify_repo.py"
spec = importlib.util.spec_from_file_location("verify_repo", SCRIPT)
checker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checker)

class GovernanceChecksTest(unittest.TestCase):
    def test_required_missing(self):
        with tempfile.TemporaryDirectory() as tmp:
            failures = checker.check_required(Path(tmp))
            self.assertTrue(any("AGENTS.md" in item for item in failures))

    def test_relative_markdown_link_broken(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "README.md").write_text("[broken](missing.md)", encoding="utf-8")
            self.assertTrue(any("broken link" in item for item in checker.check_links(root)))

    def test_relative_link_valid(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "README.md").write_text("[ok](docs/a.md)", encoding="utf-8")
            (root / "docs").mkdir()
            (root / "docs/a.md").write_text("valid", encoding="utf-8")
            self.assertEqual([], checker.check_links(root))

    def test_issue_reference_on_pr(self):
        import json
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "event.json"
            path.write_text(json.dumps({"pull_request": {"body": "Refs #42"}}), encoding="utf-8")
            self.assertEqual([], checker.check_issue_reference(str(path)))
            path.write_text(json.dumps({"pull_request": {"body": "missing link"}}), encoding="utf-8")
            self.assertTrue(checker.check_issue_reference(str(path)))

if __name__ == "__main__":
    unittest.main()
