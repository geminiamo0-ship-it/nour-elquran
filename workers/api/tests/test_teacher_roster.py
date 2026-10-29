"""Execute the exact server roster SQL against real D1 migration SQL.

Teacher role verification is separately checked by the TypeScript query unit test.
Never create a substitute roster, family contact leak, or alternate child query.
"""
import re
import sqlite3
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = (ROOT / "src" / "teacher-roster.ts").read_text(encoding="utf-8")
START = 1_800_000_000_000
END = START + 40 * 60_000


def roster_sql():
    match = re.search(r"export const TEACHER_PRIMARY_ROSTER_SQL = `([^`]+)`;", SOURCE, re.S)
    if not match:
        raise AssertionError("Production roster SQL not found")
    return match.group(1)


class TeacherRosterTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.addCleanup(self.db.close)
        self.db.execute("PRAGMA foreign_keys=ON")
        for migration in sorted((ROOT / "migrations").glob("*.sql")):
            self.db.executescript(migration.read_text(encoding="utf-8"))
        for account in ("owner-a", "owner-b"):
            self.db.execute("INSERT INTO accounts(id,auth_subject,created_at_ms) VALUES(?,?,0)",
                            (account, account + "-auth"))
        for learner, owner in (("a", "owner-a"), ("sibling", "owner-a"), ("foreign", "owner-b")):
            self.db.execute(
                "INSERT INTO learners(id,account_id,display_name,learner_type,created_at_ms) "
                "VALUES(?,?,?,'child',0)", (learner, owner, "Student-" + learner))
        for teacher in ("t-a", "t-b"):
            self.db.execute("INSERT INTO teachers(id,auth_subject,qualified) VALUES(?,?,1)",
                            (teacher, teacher + "-auth"))

    def assign(self, key, learner="a", teacher="t-a", start=0, end=END+1000, revoked=None):
        self.db.execute(
            "INSERT INTO teacher_assignments(id,learner_id,teacher_id,starts_at_ms,ends_at_ms,"
            "revoked_at_ms) VALUES(?,?,?,?,?,?)",
            (key, learner, teacher, start, end, revoked))

    def rows(self, teacher="t-a", now=START):
        return self.db.execute(roster_sql(), (teacher, now)).fetchall()

    def test_only_active_primary_assignments_are_visible(self):
        self.assign("a")
        self.assign("b", learner="foreign", teacher="t-b")
        self.assertEqual([row[0] for row in self.rows()], ["a"])
        self.assertEqual([row[0] for row in self.rows("t-b")], ["foreign"])
        self.assertEqual(self.rows("t-a", END+1001), [])

    def test_future_expired_revoked_and_unassigned_are_excluded(self):
        self.assign("future", learner="a", start=START+1)
        self.assign("expired", learner="sibling", end=START)
        self.assertEqual(self.rows(), [])
        self.db.execute("UPDATE teacher_assignments SET revoked_at_ms=? WHERE id='future'",
                        (START,))
        self.assertEqual(self.rows("t-a", START+2), [])

    def test_disabled_account_and_archived_child_disappear(self):
        self.assign("a")
        self.db.execute("UPDATE learners SET status='archived' WHERE id='a'")
        self.assertEqual(self.rows(), [])
        self.db.execute("UPDATE learners SET status='active' WHERE id='a'")
        self.db.execute("UPDATE accounts SET status='disabled' WHERE id='owner-a'")
        self.assertEqual(self.rows(), [])

    def test_substitute_never_promoted_to_general_roster(self):
        self.db.execute(
            "INSERT INTO lessons(id,learner_id,actual_teacher_id,kind,status,starts_at_ms,ends_at_ms)"
            " VALUES('lesson-a','a','t-a','standard','scheduled',?,?)", (START, END))
        self.db.execute(
            "INSERT INTO lesson_access_grants(id,lesson_id,learner_id,teacher_id,kind,"
            "accepted_at_ms,consent_deadline_ms,starts_at_ms,ends_at_ms)"
            " VALUES('sub','lesson-a','a','t-a','substitute',?,?,?,?)",
            (START-10, START, START, END))
        self.assertEqual(self.rows(), [])

    def test_roster_contract_cannot_select_private_data_or_cross_teacher(self):
        query = roster_sql().lower()
        self.assertIn("assignment.teacher_id = ?1", query)
        self.assertIn("assignment.revoked_at_ms is null", query)
        self.assertIn("assignment.ends_at_ms > ?2", query)
        self.assertIn("limit 50", query)
        for secret in ("auth_sessions", "personal_annotations", "teacher_reports",
                       "phone", "email", "audio", "lesson_access_grants"):
            self.assertNotIn(secret, query)


if __name__ == "__main__":
    unittest.main()
