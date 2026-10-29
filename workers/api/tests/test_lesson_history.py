"""#120: immutable booked history and actual End audit in local SQLite/D1 SQL.

Only synthetic fixtures. These are database backstops, NOT authenticated
teacher Start/End or proof of simultaneous live classroom presence.
"""
from pathlib import Path
import sqlite3
import unittest

MIGRATIONS = Path(__file__).resolve().parents[1] / "migrations"
START = 1_800_000_000_000
FORTY_MIN = 2_400_000
THIRTY_MIN = 1_800_000


def apply_migrations(db, first=1, last=5):
    for number in range(first, last + 1):
        path = next(MIGRATIONS.glob(f"{number:04d}_*.sql"))
        db.executescript(path.read_text(encoding="utf-8"))


def fixture(db):
    db.execute("INSERT INTO accounts(id,auth_subject,created_at_ms) VALUES('owner','owner-auth',0)")
    db.execute(
        "INSERT INTO learners(id,account_id,display_name,learner_type,created_at_ms) "
        "VALUES('learner','owner','Synthetic Learner','child',0)"
    )
    db.execute(
        "INSERT INTO teachers(id,auth_subject,qualified) "
        "VALUES('teacher','teacher-auth',1)"
    )


def book(db, length=FORTY_MIN, status="scheduled"):
    db.execute(
        "INSERT INTO lessons(id,learner_id,actual_teacher_id,kind,status,starts_at_ms,ends_at_ms) "
        "VALUES('lesson','learner','teacher','trial',?,?,?)",
        (status, START, START + length),
    )


def state(db):
    return db.execute(
        "SELECT kind,status,starts_at_ms,ends_at_ms,ended_at_ms "
        "FROM lessons WHERE id='lesson'"
    ).fetchone()


class LessonHistoryIntegrityTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.addCleanup(self.db.close)
        self.db.execute("PRAGMA foreign_keys=ON")
        apply_migrations(self.db)
        fixture(self.db)
        book(self.db)

    def start(self):
        self.db.execute("UPDATE lessons SET status='live' WHERE id='lesson'")

    def end(self):
        self.db.execute(
            "UPDATE lessons SET status='completed',ended_at_ms=? WHERE id='lesson'",
            (START + 90_000,),
        )

    def assert_rejected_without_mutation(self, sql, args=()):
        before = state(self.db)
        with self.assertRaisesRegex(sqlite3.IntegrityError, "history immutable"):
            self.db.execute(sql, args)
        self.assertEqual(state(self.db), before)

    def test_scheduled_reschedule_and_kind_change_still_allowed(self):
        self.db.execute(
            "UPDATE lessons SET starts_at_ms=?,ends_at_ms=?,kind='standard' WHERE id='lesson'",
            (START + FORTY_MIN, START + 2 * FORTY_MIN),
        )
        self.assertEqual(state(self.db)[:4], (
            "standard", "scheduled", START + FORTY_MIN, START + 2 * FORTY_MIN
        ))

    def test_live_room_cannot_rewrite_booked_interval_or_entitlement_kind(self):
        self.start()
        self.assert_rejected_without_mutation(
            "UPDATE lessons SET starts_at_ms=?,ends_at_ms=? WHERE id='lesson'",
            (START + FORTY_MIN, START + 2 * FORTY_MIN),
        )
        self.assert_rejected_without_mutation(
            "UPDATE lessons SET kind='makeup' WHERE id='lesson'"
        )
        self.assert_rejected_without_mutation(
            "UPDATE lessons SET ended_at_ms=? WHERE id='lesson'", (START + 1000,)
        )
        self.assertEqual(state(self.db)[1], "live")

    def test_new_completion_requires_explicit_end_timestamp(self):
        self.start()
        before = state(self.db)
        with self.assertRaisesRegex(
            sqlite3.IntegrityError, "End requires recorded timestamp"
        ):
            self.db.execute(
                "UPDATE lessons SET status='completed' WHERE id='lesson'"
            )
        self.assertEqual(state(self.db), before)
        self.assertEqual(state(self.db)[1], "live")
        self.end()
        self.assertEqual(state(self.db)[1], "completed")
        self.assertEqual(state(self.db)[-1], START + 90_000)

    def test_completed_room_cannot_change_end_time_or_booked_history(self):
        self.start()
        self.end()
        self.assert_rejected_without_mutation(
            "UPDATE lessons SET ended_at_ms=? WHERE id='lesson'", (START + 120_000,)
        )
        self.assert_rejected_without_mutation(
            "UPDATE lessons SET ended_at_ms=NULL WHERE id='lesson'"
        )
        self.assert_rejected_without_mutation(
            "UPDATE lessons SET kind='standard',starts_at_ms=?,ends_at_ms=? WHERE id='lesson'",
            (START + FORTY_MIN, START + 2 * FORTY_MIN),
        )
        # Harmless retries do not corrupt the historical record.
        self.db.execute(
            "UPDATE lessons SET ended_at_ms=ended_at_ms,status='completed' WHERE id='lesson'"
        )
        self.assertEqual(state(self.db)[-1], START + 90_000)

    def test_legacy_completed_30_minute_record_is_preserved(self):
        old = sqlite3.connect(":memory:")
        self.addCleanup(old.close)
        old.execute("PRAGMA foreign_keys=ON")
        apply_migrations(old, last=2)
        fixture(old)
        book(old, length=THIRTY_MIN, status="completed")
        original = state(old)
        apply_migrations(old, first=3)
        self.assertEqual(state(old), original)
        self.assertEqual(
            old.execute(
                "SELECT version FROM noor_schema_meta WHERE component='lesson_history'"
            ).fetchone(), (1,)
        )
        with self.assertRaisesRegex(sqlite3.IntegrityError, "history immutable"):
            old.execute(
                "UPDATE lessons SET ended_at_ms=? WHERE id='lesson'", (START + 1000,)
            )
        self.assertEqual(state(old), original)
        # Historical completed rows with NULL End are not retroactively invalidated.
        old.execute("UPDATE lessons SET status='completed' WHERE id='lesson'")
        self.assertEqual(state(old), original)


if __name__ == "__main__":
    unittest.main()
