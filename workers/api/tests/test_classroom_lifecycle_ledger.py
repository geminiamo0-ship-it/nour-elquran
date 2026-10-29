"""Audit durability for explicitly teacher-initiated live lesson actions.

D1 is the durable event projection; actual teacher session authorization and
two connected participants belong to Workers + the Lesson Durable Object.
"""
from pathlib import Path
import sqlite3
import unittest

MIGRATIONS = Path(__file__).resolve().parents[1] / "migrations"
START = 1_800_000_000_000
SLOT_MS = 2_400_000


def database():
    db = sqlite3.connect(":memory:")
    db.execute("PRAGMA foreign_keys=ON")
    for path in sorted(MIGRATIONS.glob("*.sql")):
        db.executescript(path.read_text(encoding="utf-8"))
    db.execute("INSERT INTO accounts(id,auth_subject,created_at_ms) VALUES('account-a','auth-a',0)")
    db.execute("INSERT INTO learners(id,account_id,display_name,learner_type,created_at_ms) "
               "VALUES('student-a','account-a','Synthetic Learner','child',0)")
    for teacher in ("teacher-a", "teacher-b"):
        db.execute("INSERT INTO teachers(id,auth_subject,qualified) VALUES(?,?,1)",
                   (teacher, teacher + '-subject'))
    db.execute(
        "INSERT INTO lessons(id,learner_id,actual_teacher_id,kind,status,starts_at_ms,ends_at_ms) "
        "VALUES('lesson-a','student-a','teacher-a','standard','scheduled',?,?)",
        (START, START + SLOT_MS))
    return db


def audit(db, event_id, action, at, teacher="teacher-a", op=None):
    db.execute(
        "INSERT INTO lesson_lifecycle_events(id,lesson_id,teacher_id,action,at_ms,operation_id) "
        "VALUES(?,'lesson-a',?,?,?,?)",
        (event_id, teacher, action, at, op or "operation-" + event_id))


class ClassroomLifecycleLedgerTests(unittest.TestCase):
    def setUp(self):
        self.db = database()
        self.addCleanup(self.db.close)

    def start(self):
        self.db.execute("UPDATE lessons SET status='live' WHERE id='lesson-a'")
        audit(self.db, "start-event", "start", START + 60_000)

    def end(self):
        self.db.execute(
            "UPDATE lessons SET status='completed', ended_at_ms=? WHERE id='lesson-a'",
            (START + 120_000,))
        audit(self.db, "end-event", "end", START + 120_000)

    def test_valid_start_and_end_have_an_auditable_actor_and_time(self):
        self.start()
        self.end()
        self.assertEqual(
            self.db.execute(
                "SELECT action,teacher_id,at_ms FROM lesson_lifecycle_events "
                "ORDER BY at_ms").fetchall(),
            [("start","teacher-a",START + 60_000),
             ("end","teacher-a",START + 120_000)]
        )

    def test_cannot_create_start_event_while_waiting(self):
        with self.assertRaisesRegex(sqlite3.IntegrityError, "start requires a live lesson"):
            audit(self.db, "start-event", "start", START)

    def test_end_requires_teacher_completed_state(self):
        self.start()
        with self.assertRaisesRegex(sqlite3.IntegrityError, "end requires completed lesson"):
            audit(self.db, "end-event", "end", START + 120_000)

    def test_end_rejects_missing_start_even_if_completed(self):
        self.db.execute("UPDATE lessons SET status='live' WHERE id='lesson-a'")
        self.db.execute(
            "UPDATE lessons SET status='completed',ended_at_ms=? WHERE id='lesson-a'",
            (START + 120_000,))
        with self.assertRaisesRegex(sqlite3.IntegrityError, "preceding start"):
            audit(self.db, "end-event", "end", START + 120_000)

    def test_wrong_teacher_cannot_author_classroom_event(self):
        self.db.execute("UPDATE lessons SET status='live' WHERE id='lesson-a'")
        with self.assertRaisesRegex(sqlite3.IntegrityError, "acting teacher"):
            audit(self.db, "forged-event", "start", START, teacher="teacher-b")

    def test_end_time_must_match_teacher_completed_timestamp(self):
        self.start()
        self.db.execute(
            "UPDATE lessons SET status='completed',ended_at_ms=? WHERE id='lesson-a'",
            (START + 120_000,))
        with self.assertRaisesRegex(sqlite3.IntegrityError, "recorded time"):
            audit(self.db, "end-event", "end", START + 120_001)

    def test_duplicate_start_end_and_operation_id_are_rejected(self):
        self.start()
        for event_id, action, op in [
            ("second-start", "start", "operation-second-start"),
            ("new-id", "start", "operation-start-event"),
        ]:
            with self.subTest(event_id=event_id), self.assertRaises(sqlite3.IntegrityError):
                audit(self.db, event_id, action, START + 60_000, op=op)
        self.end()
        with self.assertRaises(sqlite3.IntegrityError):
            audit(self.db, "again-end", "end", START + 120_000)

    def test_audit_history_cannot_be_edited_or_deleted(self):
        self.start()
        with self.assertRaisesRegex(sqlite3.IntegrityError, "audit is immutable"):
            self.db.execute(
                "UPDATE lesson_lifecycle_events SET teacher_id='teacher-b' "
                "WHERE id='start-event'")
        with self.assertRaisesRegex(sqlite3.IntegrityError, "audit is immutable"):
            self.db.execute("DELETE FROM lesson_lifecycle_events WHERE id='start-event'")

    def test_event_cannot_reference_unknown_lesson_or_teacher(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                "INSERT INTO lesson_lifecycle_events VALUES "
                "('unknown-lesson','missing','teacher-a','start',0,'op-unknown-lesson')")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                "INSERT INTO lesson_lifecycle_events VALUES "
                "('unknown-teacher','lesson-a','missing','start',0,'op-unknown-teacher')")

    def test_export_restore_preserves_event_audit(self):
        self.start()
        self.end()
        dump = "\n".join(self.db.iterdump())
        restored = sqlite3.connect(":memory:")
        self.addCleanup(restored.close)
        restored.executescript(dump)
        restored.execute("PRAGMA foreign_keys=ON")
        self.assertEqual(restored.execute("PRAGMA foreign_key_check").fetchall(), [])
        self.assertEqual(
            restored.execute("SELECT COUNT(*) FROM lesson_lifecycle_events").fetchone()[0], 2
        )
        with self.assertRaisesRegex(sqlite3.IntegrityError, "audit is immutable"):
            restored.execute("DELETE FROM lesson_lifecycle_events")

    def test_migration_does_not_change_core_or_auth_readiness(self):
        self.assertEqual(self.db.execute(
            "SELECT version FROM noor_schema_meta WHERE component='classroom_lifecycle'"
        ).fetchone(), (1,))
        self.assertEqual(self.db.execute(
            "SELECT version FROM noor_schema_meta WHERE component='core'"
        ).fetchone(), (1,))
        self.assertEqual(self.db.execute(
            "SELECT version FROM noor_schema_meta WHERE component='auth'"
        ).fetchone(), (1,))


if __name__ == "__main__":
    unittest.main()
