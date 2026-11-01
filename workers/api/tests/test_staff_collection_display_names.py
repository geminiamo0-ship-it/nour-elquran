"""#307: execute the real staff collection SQL against valid padded D1 names.

The canonical learners CHECK constrains length(trim(display_name)), not the
stored value. Read-only Admin must normalize labels without changing source rows.
Synthetic academic records only; no personal data or remote D1 connection.
"""
import re
import sqlite3
import unittest
from pathlib import Path

SOURCE = (Path(__file__).resolve().parents[1] / "src" / "staff-collections.ts").read_text(
    encoding="utf-8"
)
NOW = 1793600000000


def collection_sql(view):
    match = re.search(r"(?m)^\s*" + re.escape(view) + r":`([\s\S]*?)`", SOURCE)
    if not match:
        raise AssertionError(f"Missing fixed SQL for {view}")
    return match.group(1)


class StaffAcademicNameNormalizationTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.executescript("""
            CREATE TABLE accounts(id TEXT PRIMARY KEY,status TEXT);
            CREATE TABLE learners(
                id TEXT PRIMARY KEY,account_id TEXT,display_name TEXT NOT NULL
                  CHECK(length(trim(display_name)) BETWEEN 1 AND 80),
                learner_type TEXT,status TEXT,created_at_ms INTEGER);
            CREATE TABLE teachers(id TEXT PRIMARY KEY,auth_subject TEXT);
            CREATE TABLE auth_users(id TEXT PRIMARY KEY,name TEXT);
            CREATE TABLE lessons(id TEXT PRIMARY KEY,learner_id TEXT,
                actual_teacher_id TEXT,starts_at_ms INTEGER,kind TEXT,status TEXT);
            CREATE TABLE subscription_cycles(id TEXT PRIMARY KEY,learner_id TEXT,
                starts_at_ms INTEGER,ends_at_ms INTEGER,base_sessions INTEGER,
                rollover_sessions INTEGER);
            CREATE TABLE subscription_spend_events(source_kind TEXT,source_id TEXT);
        """)
        self.db.execute("INSERT INTO accounts VALUES ('owner-a','active')")
        self.db.execute("""INSERT INTO learners VALUES
            ('learner-a','owner-a','  طالب  تجريبي  ','child','active',?)""", (NOW,))
        self.db.execute("INSERT INTO auth_users VALUES ('sheikh-a','  شيخ تجريبي  ')")
        self.db.execute("INSERT INTO teachers VALUES ('teacher-a','sheikh-a')")
        self.db.execute("""INSERT INTO lessons VALUES
            ('lesson-a','learner-a','teacher-a',?,'trial','scheduled')""",
            (NOW + 1000,))
        self.db.execute("""INSERT INTO subscription_cycles VALUES
            ('cycle-a','learner-a',?,?,8,0)""", (NOW, NOW + 30 * 86400000))

    def tearDown(self):
        self.db.close()

    def test_valid_padded_learner_is_visible_without_mutating_source(self):
        rows = self.db.execute(collection_sql("students")).fetchall()
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0][1], "طالب  تجريبي")
        self.assertEqual(self.db.execute(
            "SELECT display_name FROM learners").fetchone()[0],
            "  طالب  تجريبي  ")

    def test_schedule_normalizes_both_academic_names(self):
        rows = self.db.execute(collection_sql("schedule"),
                               (NOW - 7 * 86400000, NOW + 30 * 86400000)).fetchall()
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0][4:6], ("طالب  تجريبي", "شيخ تجريبي"))

    def test_subscription_units_use_trimmed_learner_label_not_money(self):
        rows = self.db.execute(collection_sql("subscriptions")).fetchall()
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0][1], "طالب  تجريبي")
        self.assertEqual(rows[0][-3:], (8, 0, 0))


if __name__ == "__main__":
    unittest.main()
