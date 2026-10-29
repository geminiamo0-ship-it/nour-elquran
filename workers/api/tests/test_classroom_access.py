"""Execute the production classroom access SQL on SQLite/D1 migration lineage."""
import re
import sqlite3
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = (ROOT / "src" / "classroom-access.ts").read_text(encoding="utf-8")
START = 1_800_000_000_000
END = START + 40 * 60_000


def sql(name):
    match = re.search(r"export const " + name + r" = `([^`]+)`;", SRC, re.S)
    if not match:
        raise AssertionError("Production query missing: " + name)
    return match.group(1)


class ClassroomAccessTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.addCleanup(self.db.close)
        self.db.execute("PRAGMA foreign_keys=ON")
        for migration in sorted((ROOT / "migrations").glob("*.sql")):
            self.db.executescript(migration.read_text(encoding="utf-8"))
        for account in ("owner-a", "owner-b"):
            self.db.execute("INSERT INTO accounts(id,auth_subject,created_at_ms) VALUES(?,?,0)",
                            (account, account + "-subject"))
        for learner, owner in (("child-a", "owner-a"), ("sibling-a", "owner-a"), ("child-b", "owner-b")):
            self.db.execute("INSERT INTO learners(id,account_id,display_name,learner_type,created_at_ms) "
                            "VALUES(?,?,?,'child',0)", (learner, owner, "Learner " + learner))
        for teacher in ("teacher-a", "teacher-b", "teacher-c"):
            self.db.execute("INSERT INTO teachers(id,auth_subject,qualified) VALUES(?,?,1)",
                            (teacher, teacher + "-auth"))

    def lesson(self, key="lesson-a", learner="child-a", teacher="teacher-a", status="scheduled"):
        self.db.execute("INSERT INTO lessons(id,learner_id,actual_teacher_id,kind,status,"
                        "starts_at_ms,ends_at_ms) VALUES(?,?,?,'standard',?,?,?)",
                        (key, learner, teacher, status, START, END))

    def assign(self, teacher="teacher-a", learner="child-a", revoked=None):
        self.db.execute("INSERT INTO teacher_assignments(id,learner_id,teacher_id,starts_at_ms,ends_at_ms,"
                        "revoked_at_ms) VALUES(?,?,?,0,?,?)",
                        ("assign-" + teacher + "-" + learner, learner, teacher, END + 1000, revoked))

    def substitute(self, teacher="teacher-a", accepted=None, revoked=None, deadline=START):
        self.db.execute("INSERT INTO lesson_access_grants(id,lesson_id,learner_id,teacher_id,kind,"
                        "accepted_at_ms,consent_deadline_ms,starts_at_ms,ends_at_ms,revoked_at_ms)"
                        " VALUES('sub-1','lesson-a','child-a',?,'substitute',?,?,0,?,?)",
                        (teacher, accepted, deadline, END, revoked))

    def read_teacher(self, subject="teacher-a-auth", now=START):
        return self.db.execute(sql("TEACHER_CLASSROOM_ACCESS_SQL"),
                               ("lesson-a", subject, now)).fetchone()

    def read_student(self, child="child-a", owner="owner-a"):
        return self.db.execute(sql("LEARNER_CLASSROOM_ACCESS_SQL"),
                               ("lesson-a", child, owner)).fetchone()

    def test_primary_teacher_only_current_qualified_actor(self):
        self.lesson()
        self.assertIsNone(self.read_teacher())
        self.assign()
        row = self.read_teacher()
        self.assertIsNotNone(row)
        self.assertEqual(row[-1], "primary")
        self.assertIsNone(self.read_teacher("teacher-b-auth"))
        self.db.execute("UPDATE teachers SET qualified=0 WHERE id='teacher-a'")
        self.assertIsNone(self.read_teacher())
        self.db.execute("UPDATE teachers SET qualified=1, status='disabled' WHERE id='teacher-a'")
        self.assertIsNone(self.read_teacher())

    def test_revoked_primary_and_foreign_teacher_deny(self):
        self.lesson()
        self.assign(revoked=START - 10)
        self.assertIsNone(self.read_teacher())
        self.assertIsNone(self.read_teacher("teacher-b-auth"))

    def test_positive_substitute_consent_is_required_and_not_future(self):
        self.lesson()
        self.substitute()
        self.assertIsNone(self.read_teacher())
        self.db.execute("UPDATE lesson_access_grants SET accepted_at_ms=?",
                        (START - 50,))
        self.assertEqual(self.read_teacher()[-1], "substitute")
        self.assertIsNone(self.read_teacher(now=START - 51))
        self.db.execute("UPDATE lesson_access_grants SET revoked_at_ms=?", (START,))
        self.assertIsNone(self.read_teacher())

    def test_substitute_cannot_bypass_deadline_or_other_lesson_scope(self):
        self.lesson()
        self.substitute(accepted=START - 100, deadline=START - 200)
        self.assertIsNone(self.read_teacher())
        self.db.execute("UPDATE lesson_access_grants SET consent_deadline_ms=?", (START,))
        self.assertEqual(self.read_teacher()[-1], "substitute")

    def test_owner_child_scope_excludes_other_family_and_sibling(self):
        self.lesson()
        self.assertIsNotNone(self.read_student())
        self.assertIsNone(self.read_student("sibling-a"))
        self.assertIsNone(self.read_student("child-b"))
        self.assertIsNone(self.read_student(owner="owner-b"))
        self.assertIsNone(self.read_student(child="child-b", owner="owner-b"))

    def test_disabled_owner_archived_child_and_terminal_lesson_deny(self):
        self.lesson()
        self.assign()
        self.db.execute("UPDATE learners SET status='archived' WHERE id='child-a'")
        self.assertIsNone(self.read_teacher())
        self.assertIsNone(self.read_student())
        self.db.execute("UPDATE learners SET status='active' WHERE id='child-a'")
        self.db.execute("UPDATE accounts SET status='disabled' WHERE id='owner-a'")
        self.assertIsNone(self.read_teacher())
        self.assertIsNone(self.read_student())
        self.db.execute("UPDATE accounts SET status='active' WHERE id='owner-a'")
        self.db.execute("UPDATE lessons SET status='cancelled' WHERE id='lesson-a'")
        self.assertIsNone(self.read_teacher())
        self.assertIsNone(self.read_student())

    def test_results_have_no_private_data_or_media_urls(self):
        for name in ("TEACHER_CLASSROOM_ACCESS_SQL", "LEARNER_CLASSROOM_ACCESS_SQL"):
            query = sql(name).lower()
            for forbidden in ("personal_annotations", "auth_sessions", "payload_json",
                              "audio_url", "phone_number", "api_secret", "livekit"):
                self.assertNotIn(forbidden, query)
            self.assertIn("limit 1", query)
            self.assertIn("l.status in ('scheduled','live')", query)


if __name__ == "__main__":
    unittest.main()
