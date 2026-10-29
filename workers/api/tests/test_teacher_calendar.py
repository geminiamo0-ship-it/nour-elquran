"""SQLite/D1 regression tests for the approved 40-minute Noor lesson reservations.

These tests exercise the actual additive SQL migration (including trigger atomicity).
They do not imply the live classroom, presence, media or auth API is complete.
"""
import sqlite3
import unittest
from pathlib import Path


MIGRATIONS = Path(__file__).resolve().parents[1] / "migrations"
SLOT_MS = 40 * 60 * 1000
T = 1_800_000_000_000


def database(migrations=("0001_core.sql", "0002_auth.sql", "0003_teacher_schedule.sql")):
    connection = sqlite3.connect(":memory:")
    connection.execute("PRAGMA foreign_keys = ON")
    for migration in migrations:
        connection.executescript((MIGRATIONS / migration).read_text(encoding="utf-8"))
    connection.execute("INSERT INTO accounts(id,auth_subject,created_at_ms) VALUES('acct','subject',0)")
    for learner in ("learner-a", "learner-b"):
        connection.execute(
            "INSERT INTO learners(id,account_id,display_name,learner_type,created_at_ms) "
            "VALUES(?, 'acct', ?, 'child', 0)", (learner, learner)
        )
    for teacher in ("teacher-a", "teacher-b"):
        connection.execute(
            "INSERT INTO teachers(id,auth_subject,qualified) VALUES(?,?,1)",
            (teacher, "subject-" + teacher),
        )
    return connection


def lesson(connection, lesson_id, start=T, teacher="teacher-a", learner="learner-a",
           duration=SLOT_MS, status="scheduled"):
    connection.execute(
        "INSERT INTO lessons(id,learner_id,actual_teacher_id,kind,status,"
        "starts_at_ms,ends_at_ms) VALUES(?,?,?,'standard',?,?,?)",
        (lesson_id, learner, teacher, status, start, start + duration),
    )


class TeacherCalendarConstraints(unittest.TestCase):
    def setUp(self):
        self.db = database()
        self.addCleanup(self.db.close)

    def test_exactly_40_minutes_required_for_new_lessons(self):
        for duration in (30 * 60000, 39 * 60000, 41 * 60000):
            with self.subTest(duration=duration), self.assertRaisesRegex(
                sqlite3.IntegrityError, "reserve 40 minutes"
            ):
                lesson(self.db, "bad", duration=duration)
        lesson(self.db, "correct", duration=SLOT_MS)

    def test_consecutive_40_minute_slots_are_allowed(self):
        lesson(self.db, "first")
        lesson(self.db, "second", start=T + SLOT_MS, learner="learner-b")
        self.assertEqual(
            self.db.execute("SELECT COUNT(*) FROM lessons").fetchone()[0], 2
        )

    def test_same_teacher_cannot_book_overlapping_student(self):
        lesson(self.db, "first")
        with self.assertRaisesRegex(sqlite3.IntegrityError, "teacher has a conflicting lesson"):
            lesson(self.db, "collision", start=T + SLOT_MS - 1, learner="learner-b")
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM lessons").fetchone()[0], 1)

    def test_same_learner_cannot_book_overlapping_teacher(self):
        lesson(self.db, "first")
        with self.assertRaisesRegex(sqlite3.IntegrityError, "learner has a conflicting lesson"):
            lesson(self.db, "collision", teacher="teacher-b", start=T + 10_000)

    def test_independent_teachers_and_learners_can_book_same_time(self):
        lesson(self.db, "one")
        lesson(self.db, "two", teacher="teacher-b", learner="learner-b")
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM lessons").fetchone()[0], 2)

    def test_canceled_booking_frees_teacher_and_learner_slot(self):
        lesson(self.db, "original")
        self.db.execute("UPDATE lessons SET status='cancelled' WHERE id='original'")
        lesson(self.db, "replacement")
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM lessons").fetchone()[0], 2)

    def test_completed_bookings_continue_to_block_history(self):
        lesson(self.db, "original")
        self.db.execute("UPDATE lessons SET status='completed' WHERE id='original'")
        with self.assertRaisesRegex(sqlite3.IntegrityError, "conflicting lesson"):
            lesson(self.db, "overlap", learner="learner-b", start=T + 1000)

    def test_reactivation_from_cancelled_rechecks_conflict(self):
        lesson(self.db, "first")
        lesson(self.db, "canceled", learner="learner-b", status="cancelled")
        with self.assertRaisesRegex(sqlite3.IntegrityError, "teacher has a conflicting lesson"):
            self.db.execute("UPDATE lessons SET status='scheduled' WHERE id='canceled'")
        self.assertEqual(
            self.db.execute("SELECT status FROM lessons WHERE id='canceled'").fetchone()[0],
            "cancelled",
        )

    def test_reschedule_update_rechecks_both_conflicts(self):
        lesson(self.db, "first")
        lesson(self.db, "second", start=T + SLOT_MS, learner="learner-b")
        with self.assertRaisesRegex(sqlite3.IntegrityError, "teacher has a conflicting lesson"):
            self.db.execute(
                "UPDATE lessons SET starts_at_ms=?, ends_at_ms=? WHERE id='second'",
                (T + 1000, T + 1000 + SLOT_MS),
            )
        self.assertEqual(
            self.db.execute("SELECT starts_at_ms FROM lessons WHERE id='second'").fetchone()[0],
            T + SLOT_MS,
        )

    def test_change_duration_rejected_without_changing_persisted_booking(self):
        lesson(self.db, "first")
        with self.assertRaisesRegex(sqlite3.IntegrityError, "reserve 40 minutes"):
            self.db.execute(
                "UPDATE lessons SET ends_at_ms=ends_at_ms-60000 WHERE id='first'"
            )
        self.assertEqual(
            self.db.execute("SELECT ends_at_ms-starts_at_ms FROM lessons").fetchone()[0],
            SLOT_MS,
        )

    def test_migration_preserves_existing_30_minute_record(self):
        old = database(("0001_core.sql", "0002_auth.sql"))
        self.addCleanup(old.close)
        lesson(old, "legacy", duration=30 * 60_000)
        old.executescript((MIGRATIONS / "0003_teacher_schedule.sql").read_text())
        self.assertEqual(
            old.execute("SELECT ends_at_ms-starts_at_ms FROM lessons WHERE id='legacy'")
            .fetchone()[0], 30 * 60_000,
        )
        # Old records can still transition in status; only actual date edits
        # have to meet the new reservation policy.
        old.execute("UPDATE lessons SET status='completed' WHERE id='legacy'")
        with self.assertRaisesRegex(sqlite3.IntegrityError, "reserve 40 minutes"):
            lesson(old, "invalid-new", learner="learner-b", start=T + SLOT_MS,
                   duration=30 * 60_000)

    def test_new_booking_requires_active_qualified_teacher(self):
        self.db.execute("UPDATE teachers SET qualified=0 WHERE id='teacher-b'")
        with self.assertRaisesRegex(sqlite3.IntegrityError, "active qualified teacher"):
            lesson(self.db, "unqualified", teacher="teacher-b", learner="learner-b")
        self.db.execute("UPDATE teachers SET qualified=1, status='disabled' WHERE id='teacher-b'")
        with self.assertRaisesRegex(sqlite3.IntegrityError, "active qualified teacher"):
            lesson(self.db, "disabled", teacher="teacher-b", learner="learner-b")
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM lessons").fetchone()[0], 0)
        self.db.execute("UPDATE teachers SET status='active' WHERE id='teacher-b'")
        lesson(self.db, "eligible", teacher="teacher-b", learner="learner-b")

    def test_cancelled_slot_cannot_reactivate_under_ineligible_teacher(self):
        lesson(self.db, "cancelled", teacher="teacher-b", learner="learner-b",
               status="cancelled")
        self.db.execute("UPDATE teachers SET qualified=0 WHERE id='teacher-b'")
        with self.assertRaisesRegex(sqlite3.IntegrityError, "active qualified teacher"):
            self.db.execute("UPDATE lessons SET status='scheduled' WHERE id='cancelled'")
        self.assertEqual(
            self.db.execute("SELECT status FROM lessons WHERE id='cancelled'").fetchone()[0],
            "cancelled",
        )
        self.db.execute("UPDATE teachers SET qualified=1 WHERE id='teacher-b'")
        self.db.execute("UPDATE lessons SET status='scheduled' WHERE id='cancelled'")

    def test_teacher_reassignment_is_atomic_and_completed_history_is_preserved(self):
        lesson(self.db, "booked")
        self.db.execute("UPDATE teachers SET status='disabled' WHERE id='teacher-b'")
        with self.assertRaisesRegex(sqlite3.IntegrityError, "active qualified teacher"):
            self.db.execute(
                "UPDATE lessons SET actual_teacher_id='teacher-b' WHERE id='booked'"
            )
        self.assertEqual(
            self.db.execute("SELECT actual_teacher_id FROM lessons WHERE id='booked'")
            .fetchone()[0], "teacher-a",
        )
        # Disabling a teacher after a valid reservation does not erase history
        # or prevent a separate authorized lifecycle from recording completion.
        self.db.execute("UPDATE teachers SET status='disabled' WHERE id='teacher-a'")
        self.db.execute("UPDATE lessons SET status='completed' WHERE id='booked'")
        self.assertEqual(
            self.db.execute("SELECT status FROM lessons WHERE id='booked'").fetchone()[0],
            "completed",
        )

    def test_new_booking_requires_active_learner_and_owner(self):
        self.db.execute("UPDATE learners SET status='archived' WHERE id='learner-b'")
        with self.assertRaisesRegex(sqlite3.IntegrityError, "active learner and account"):
            lesson(self.db, "archived", teacher="teacher-b", learner="learner-b")
        self.db.execute("UPDATE learners SET status='active' WHERE id='learner-b'")
        self.db.execute("UPDATE accounts SET status='disabled' WHERE id='acct'")
        with self.assertRaisesRegex(sqlite3.IntegrityError, "active learner and account"):
            lesson(self.db, "owner-disabled", teacher="teacher-b", learner="learner-b")
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM lessons").fetchone()[0], 0)
        self.db.execute("UPDATE accounts SET status='active' WHERE id='acct'")
        lesson(self.db, "eligible", teacher="teacher-b", learner="learner-b")

    def test_cancelled_slot_reactivation_rechecks_learner_and_owner(self):
        lesson(self.db, "cancelled", status="cancelled")
        self.db.execute("UPDATE learners SET status='archived' WHERE id='learner-a'")
        with self.assertRaisesRegex(sqlite3.IntegrityError, "active learner and account"):
            self.db.execute("UPDATE lessons SET status='scheduled' WHERE id='cancelled'")
        self.db.execute("UPDATE learners SET status='active' WHERE id='learner-a'")
        self.db.execute("UPDATE accounts SET status='disabled' WHERE id='acct'")
        with self.assertRaisesRegex(sqlite3.IntegrityError, "active learner and account"):
            self.db.execute("UPDATE lessons SET status='scheduled' WHERE id='cancelled'")
        self.assertEqual(
            self.db.execute("SELECT status FROM lessons WHERE id='cancelled'").fetchone()[0],
            "cancelled",
        )
        self.db.execute("UPDATE accounts SET status='active' WHERE id='acct'")
        self.db.execute("UPDATE lessons SET status='scheduled' WHERE id='cancelled'")

    def test_reschedule_rechecks_teacher_learner_and_owner(self):
        lesson(self.db, "booked")
        self.db.execute("UPDATE teachers SET status='disabled' WHERE id='teacher-a'")
        with self.assertRaisesRegex(sqlite3.IntegrityError, "active qualified teacher"):
            self.db.execute(
                "UPDATE lessons SET starts_at_ms=?, ends_at_ms=? WHERE id='booked'",
                (T + SLOT_MS, T + 2 * SLOT_MS),
            )
        self.db.execute("UPDATE teachers SET status='active' WHERE id='teacher-a'")
        self.db.execute("UPDATE learners SET status='archived' WHERE id='learner-a'")
        with self.assertRaisesRegex(sqlite3.IntegrityError, "active learner and account"):
            self.db.execute(
                "UPDATE lessons SET starts_at_ms=?, ends_at_ms=? WHERE id='booked'",
                (T + SLOT_MS, T + 2 * SLOT_MS),
            )
        self.db.execute("UPDATE learners SET status='active' WHERE id='learner-a'")
        self.db.execute("UPDATE accounts SET status='disabled' WHERE id='acct'")
        with self.assertRaisesRegex(sqlite3.IntegrityError, "active learner and account"):
            self.db.execute(
                "UPDATE lessons SET starts_at_ms=?, ends_at_ms=? WHERE id='booked'",
                (T + SLOT_MS, T + 2 * SLOT_MS),
            )
        self.assertEqual(
            self.db.execute("SELECT starts_at_ms FROM lessons WHERE id='booked'").fetchone()[0],
            T,
        )
        self.db.execute("UPDATE accounts SET status='active' WHERE id='acct'")
        self.db.execute(
            "UPDATE lessons SET starts_at_ms=?, ends_at_ms=? WHERE id='booked'",
            (T + SLOT_MS, T + 2 * SLOT_MS),
        )

    def test_archived_learner_history_can_complete_without_rebooking(self):
        lesson(self.db, "booked")
        self.db.execute("UPDATE learners SET status='archived' WHERE id='learner-a'")
        self.db.execute("UPDATE accounts SET status='disabled' WHERE id='acct'")
        self.db.execute("UPDATE lessons SET status='completed' WHERE id='booked'")
        self.assertEqual(
            self.db.execute("SELECT status FROM lessons WHERE id='booked'").fetchone()[0],
            "completed",
        )

    def test_core_readiness_version_unchanged_and_schedule_migration_recorded(self):
        self.assertEqual(
            self.db.execute("SELECT version FROM noor_schema_meta WHERE component='core'")
            .fetchone()[0], 1,
        )
        self.assertEqual(
            self.db.execute(
                "SELECT version FROM noor_schema_meta WHERE component='teacher_schedule'"
            ).fetchone()[0], 1,
        )


if __name__ == "__main__":
    unittest.main()
