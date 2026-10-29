"""#110: exercise the exact TypeScript owner-read SQL against the core D1 migration in SQLite.

Only synthetic account/profile identifiers are used. HTTP remains auth-closed.
"""
import re
import sqlite3
import unittest
from pathlib import Path

API = Path(__file__).resolve().parents[1]
SOURCE = (API / "src" / "owner-learners.ts").read_text(encoding="utf-8")
BASE_MATCH = re.search(r"const BASE_QUERY = `(.*?)`;", SOURCE, re.DOTALL)
if BASE_MATCH is None:
    raise RuntimeError("Cannot find the D1 owner query in owner-learners.ts")
BASE_QUERY = BASE_MATCH.group(1)


class OwnerQueryTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.execute("PRAGMA foreign_keys=ON")
        self.db.executescript((API / "migrations" / "0001_core.sql").read_text())
        self.db.executemany(
            "INSERT INTO accounts(id,auth_subject,status,created_at_ms) VALUES(?,?,?,?)",
            [("account-a", "subject-a", "active", 1),
             ("account-b", "subject-b", "active", 2),
             ("account-disabled", "subject-disabled", "disabled", 3)],
        )
        self.db.executemany(
            "INSERT INTO learners(id,account_id,display_name,learner_type,status,created_at_ms) "
            "VALUES(?,?,?,?,?,?)",
            [("a-child", "account-a", "Fixture Child", "child", "active", 1),
             ("a-adult", "account-a", "Fixture Adult", "adult", "active", 2),
             ("a-archived", "account-a", "Fixture Archived", "child", "archived", 3),
             ("b-child", "account-b", "Fixture B", "child", "active", 4),
             ("disabled-child", "account-disabled", "Fixture Disabled", "child", "active", 5)],
        )

    def tearDown(self):
        self.db.close()

    def ids(self, query, params):
        return [row[0] for row in self.db.execute(query, params).fetchall()]

    def test_only_active_owner_profiles_visible(self):
        query = BASE_QUERY + " ORDER BY l.created_at_ms ASC, l.id ASC LIMIT 100"
        self.assertEqual(self.ids(query, ("subject-a",)), ["a-child", "a-adult"])
        self.assertEqual(self.ids(query, ("subject-b",)), ["b-child"])
        self.assertEqual(self.ids(query, ("subject-disabled",)), [])
        self.assertEqual(self.ids(query, ("missing",)), [])

    def test_child_scope_and_url_id_cannot_access_sibling_or_other_account(self):
        query = BASE_QUERY + " AND l.id = ?2 LIMIT 1"
        self.assertEqual(self.ids(query, ("subject-a", "a-child")), ["a-child"])
        self.assertEqual(self.ids(query, ("subject-a", "a-adult")), ["a-adult"])
        self.assertEqual(self.ids(query, ("subject-a", "b-child")), [])
        self.assertEqual(self.ids(query, ("subject-b", "a-child")), [])
        self.assertEqual(self.ids(query, ("subject-a", "a-archived")), [])

    def test_url_id_sql_injection_is_bound_not_interpolated(self):
        query = BASE_QUERY + " AND l.id = ?2 LIMIT 1"
        self.assertEqual(self.ids(query, ("subject-a", "a-child' OR 1=1 --")), [])


if __name__ == "__main__":
    unittest.main()
