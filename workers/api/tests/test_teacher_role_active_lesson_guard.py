"""#309: The NEW D1 trigger rejects teacher suspension with an active lesson.
Runs all production migrations in order; no mock-only trigger semantics.
"""
import sqlite3
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
T=1_800_000_000_000
HOUR=3_600_000
ROLE_SQL=("INSERT INTO teacher_role_events(id,operation_id,teacher_id,"
          "actor_auth_subject,target_auth_subject,action,reason,at_ms)"
          " VALUES(?,?,?,?,?,?,?,?)")

class TeacherActiveLessonGuard(unittest.TestCase):
    def setUp(self):
        self.db=sqlite3.connect(":memory:")
        self.addCleanup(self.db.close)
        self.db.execute("PRAGMA foreign_keys=ON")
        for file in sorted((ROOT/"migrations").glob("*.sql")):
            self.db.executescript(file.read_text())
        for who in ("staff","sheikh"):
            self.db.execute(
                "INSERT INTO auth_users(id,name,email,created_at,updated_at,phone_number_verified)"
                " VALUES(?,?,?,?,?,1)",(who,who,who+"@noor.invalid",0,0))
            self.db.execute(
                "INSERT INTO accounts(id,auth_subject,created_at_ms) VALUES(?,?,0)",
                ("acct-"+who,who))
        self.db.execute(
            "INSERT INTO staff_grants(auth_subject,permission) VALUES('staff','roles.manage')")
        self.db.execute(
            "INSERT INTO teachers(id,auth_subject,qualified,status)"
            " VALUES('teacher-id','sheikh',1,'active')")
        self.db.execute(
            "INSERT INTO learners(id,account_id,display_name,learner_type,created_at_ms)"
            " VALUES('learner-id','acct-staff','Synthetic Learner','child',0)")
        self.db.execute(
            "INSERT INTO teacher_assignments(id,learner_id,teacher_id,starts_at_ms,ends_at_ms)"
            " VALUES('assignment','learner-id','teacher-id',?,?)",
            (T,T+24*HOUR))
        self.db.execute(
            "INSERT INTO lessons(id,learner_id,actual_teacher_id,kind,status,"
            "starts_at_ms,ends_at_ms) VALUES"
            "('lesson-id','learner-id','teacher-id','trial','scheduled',?,?)",
            (T+8*HOUR,T+8*HOUR+40*60_000))

    def suspend(self, ident, now=T):
        return self.db.execute(ROLE_SQL,(ident,ident,'teacher-id','staff','sheikh',
                          'suspend','Validated operations action',now))

    def test_active_lesson_rejects_role_event_atomically(self):
        before=self.db.execute(
            "SELECT COUNT(*) FROM teacher_role_events").fetchone()[0]
        with self.assertRaisesRegex(sqlite3.IntegrityError,
                                    "active classes block teacher transition"):
            self.suspend("blocked-op")
        self.assertEqual(self.db.execute(
            "SELECT COUNT(*) FROM teacher_role_events").fetchone()[0],before)
        self.assertEqual(self.db.execute(
            "SELECT status FROM teachers WHERE id='teacher-id'").fetchone(),('active',))

    def test_live_past_reservation_end_still_blocks_suspension(self):
        self.db.execute("UPDATE lessons SET status='live' WHERE id='lesson-id'")
        with self.assertRaisesRegex(sqlite3.IntegrityError,
                                    "active classes block teacher transition"):
            self.suspend("live-overdue", now=T+10*HOUR)
        self.assertEqual(self.db.execute(
            "SELECT status FROM teachers WHERE id='teacher-id'").fetchone(),('active',))

    def test_cancellation_then_suspension_retains_history(self):
        self.db.execute("UPDATE lessons SET status='cancelled' WHERE id='lesson-id'")
        self.suspend("allowed-op")
        self.assertEqual(self.db.execute(
            "SELECT status FROM teachers WHERE id='teacher-id'").fetchone(),('disabled',))
        self.assertEqual(self.db.execute(
            "SELECT COUNT(*) FROM teacher_role_events WHERE action='suspend'").fetchone()[0],1)

if __name__=="__main__":
    unittest.main()
