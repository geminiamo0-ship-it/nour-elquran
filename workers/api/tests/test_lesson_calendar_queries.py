"""Execute the exact TS calendar SQL against the real D1 SQLite schema."""
import re
import sqlite3
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = (ROOT / "src" / "lesson-calendar.ts").read_text(encoding="utf-8")
T = 1_800_000_000_000
SLOT = 40 * 60 * 1000


def sql(name):
    match = re.search(r"export const " + name + r" = `([^`]+)`;", SOURCE, re.S)
    if not match:
        raise AssertionError(name + " query missing")
    return match.group(1)


class LessonCalendarQueriesTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.addCleanup(self.db.close)
        self.db.execute("PRAGMA foreign_keys=ON")
        for path in sorted((ROOT / "migrations").glob("*.sql")):
            self.db.executescript(path.read_text(encoding="utf-8"))
        for account in ("account-a", "account-b"):
            self.db.execute("INSERT INTO accounts(id,auth_subject,created_at_ms) VALUES(?,?,0)",
                            (account, account + "-subject"))
        for learner, account in (("a", "account-a"), ("b", "account-a"), ("c", "account-b")):
            self.db.execute(
                "INSERT INTO learners(id,account_id,display_name,learner_type,created_at_ms) "
                "VALUES(?,?,?,'child',0)", (learner, account, "Name-" + learner))
        for teacher in ("t-a", "t-b"):
            self.db.execute("INSERT INTO teachers(id,auth_subject,qualified) VALUES(?,?,1)",
                            (teacher, teacher + "-subject"))

    def add_lesson(self, ident, learner, teacher, start=T):
        self.db.execute(
            "INSERT INTO lessons(id,learner_id,actual_teacher_id,kind,status,starts_at_ms,ends_at_ms) "
            "VALUES(?,?,?,'standard','scheduled',?,?)",
            (ident, learner, teacher, start, start + SLOT))

    def grant_primary(self, ident, learner, teacher, revoked=None):
        self.db.execute(
            "INSERT INTO teacher_assignments(id,learner_id,teacher_id,starts_at_ms,ends_at_ms,revoked_at_ms) "
            "VALUES(?,?,?,0,?,?)", (ident, learner, teacher, T + SLOT * 4, revoked))

    def teacher_rows(self, teacher):
        return self.db.execute(sql("TEACHER_LESSONS_SQL"), (teacher,)).fetchall()

    def learner_rows(self, learner, account):
        return self.db.execute(sql("LEARNER_LESSONS_SQL"), (learner, account)).fetchall()

    def test_primary_teacher_sees_only_authorized_lessons_not_other_teachers(self):
        self.add_lesson("l-a", "a", "t-a")
        self.add_lesson("l-c", "c", "t-b")
        self.grant_primary("grant-a", "a", "t-a")
        self.grant_primary("grant-c", "c", "t-b")
        self.assertEqual([r[0] for r in self.teacher_rows("t-a")], ["l-a"])
        self.assertEqual([r[0] for r in self.teacher_rows("t-b")], ["l-c"])

    def test_teacher_without_assignment_gets_no_student_even_if_recorded_as_acting(self):
        self.add_lesson("l-a", "a", "t-a")
        self.assertEqual(self.teacher_rows("t-a"), [])
        self.grant_primary("grant-a", "a", "t-a")
        self.assertEqual(len(self.teacher_rows("t-a")), 1)

    def test_revoked_primary_assignment_removes_teacher_list_access(self):
        self.add_lesson("l-a", "a", "t-a")
        self.grant_primary("grant-a", "a", "t-a", revoked=T - 100)
        self.assertEqual(self.teacher_rows("t-a"), [])

    def test_substitute_requires_explicit_accepted_consent_and_lesson_grant(self):
        self.add_lesson("sub-lesson", "a", "t-a")
        self.db.execute(
            "INSERT INTO lesson_access_grants("
            "id,lesson_id,learner_id,teacher_id,kind,accepted_at_ms,consent_deadline_ms,"
            "starts_at_ms,ends_at_ms) VALUES('sub-grant','sub-lesson','a','t-a','substitute',"
            "NULL,?,0,?)", (T, T + SLOT * 4))
        self.assertEqual(self.teacher_rows("t-a"), [])
        self.db.execute(
            "UPDATE lesson_access_grants SET accepted_at_ms=? WHERE id='sub-grant'", (T - 1,))
        self.assertEqual([r[0] for r in self.teacher_rows("t-a")], ["sub-lesson"])
        self.db.execute(
            "UPDATE lesson_access_grants SET revoked_at_ms=? WHERE id='sub-grant'", (T + 1,))
        self.assertEqual(self.teacher_rows("t-a"), [])

    def test_student_timetable_requires_matching_owned_account_and_profile(self):
        self.add_lesson("a-lesson", "a", "t-a")
        self.add_lesson("c-lesson", "c", "t-b")
        self.assertEqual([r[0] for r in self.learner_rows("a", "account-a")], ["a-lesson"])
        self.assertEqual(self.learner_rows("a", "account-b"), [])
        self.assertEqual(self.learner_rows("c", "account-a"), [])
        self.assertEqual([r[0] for r in self.learner_rows("c", "account-b")], ["c-lesson"])

    def test_archived_student_and_disabled_account_are_excluded(self):
        self.add_lesson("l-a", "a", "t-a")
        self.grant_primary("grant-a", "a", "t-a")
        self.db.execute("UPDATE learners SET status='archived' WHERE id='a'")
        self.assertEqual(self.teacher_rows("t-a"), [])
        self.assertEqual(self.learner_rows("a", "account-a"), [])
        self.db.execute("UPDATE learners SET status='active' WHERE id='a'")
        self.db.execute("UPDATE accounts SET status='disabled' WHERE id='account-a'")
        self.assertEqual(self.teacher_rows("t-a"), [])
        self.assertEqual(self.learner_rows("a", "account-a"), [])

    def test_response_query_is_limited_and_no_private_notes_are_returned(self):
        self.assertIn("LIMIT 50", sql("TEACHER_LESSONS_SQL"))
        self.assertIn("LIMIT 50", sql("LEARNER_LESSONS_SQL"))
        self.assertNotIn("personal_annotations", sql("TEACHER_LESSONS_SQL").lower())
        self.assertNotIn("personal_annotations", sql("LEARNER_LESSONS_SQL").lower())
        self.assertNotIn("auth_sessions", sql("TEACHER_LESSONS_SQL").lower())


if __name__ == "__main__":
    unittest.main()
