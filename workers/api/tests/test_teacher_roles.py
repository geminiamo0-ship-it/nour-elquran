"""Apply production migrations and test atomic, server-staff-only teacher role commands."""
import sqlite3
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
OP="INSERT INTO teacher_role_events(id,operation_id,teacher_id,actor_auth_subject,target_auth_subject,action,reason,at_ms) VALUES(?,?,?,?,?,?,?,?)"

class TeacherRoleProvisioningTests(unittest.TestCase):
    def setUp(self):
        self.db=sqlite3.connect(":memory:")
        self.addCleanup(self.db.close)
        self.db.execute("PRAGMA foreign_keys=ON")
        for path in sorted((ROOT/"migrations").glob("*.sql")):
            self.db.executescript(path.read_text())
        for ident,verified in (("staff",1),("teacher",1),("unverified",0),("outsider",1)):
            self.db.execute("INSERT INTO auth_users(id,name,email,created_at,updated_at,phone_number_verified) VALUES(?,?,?,?,?,?)",
                (ident,ident,ident+"@noor.invalid",0,0,verified))
            self.db.execute("INSERT INTO accounts(id,auth_subject,created_at_ms) VALUES(?,?,0)",
                ("account-"+ident,ident))
        self.db.execute("INSERT INTO staff_grants(auth_subject,permission) VALUES('staff','roles.manage')")
        self.serial=0

    def action(self, kind, actor="staff", target="teacher", tid="teacher-id", operation=None):
        self.serial+=1
        op=operation or "operation-"+str(self.serial)
        return self.db.execute(OP,("event-"+str(self.serial),op,tid,actor,target,kind,
            "Verified staff decision",1000+self.serial))

    def teacher(self):
        return self.db.execute("SELECT qualified,status FROM teachers WHERE id='teacher-id'").fetchone()

    def test_full_explicit_lifecycle_and_immutable_audit(self):
        self.action("provision")
        self.assertEqual(self.teacher(),(0,"disabled"))
        self.action("qualify")
        self.assertEqual(self.teacher(),(1,"disabled"))
        self.action("activate")
        self.assertEqual(self.teacher(),(1,"active"))
        self.action("suspend")
        self.assertEqual(self.teacher(),(1,"disabled"))
        self.action("activate")
        self.action("revoke_qualification")
        self.assertEqual(self.teacher(),(0,"disabled"))
        self.assertEqual(self.db.execute("SELECT count(*) FROM teacher_role_events").fetchone()[0],6)
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("UPDATE teacher_role_events SET reason='changed'")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("DELETE FROM teacher_role_events")
        self.assertEqual(self.teacher(),(0,"disabled"))

    def test_only_verified_qualified_staff_may_write_roles(self):
        for actor in ("outsider","unverified","teacher"):
            with self.assertRaises(sqlite3.IntegrityError):
                self.action("provision",actor=actor)
        with self.assertRaises(sqlite3.IntegrityError):
            self.action("provision",actor="teacher",target="teacher")
        self.db.execute("UPDATE auth_users SET phone_number_verified=0 WHERE id='staff'")
        with self.assertRaises(sqlite3.IntegrityError): self.action("provision")
        self.db.execute("UPDATE auth_users SET phone_number_verified=1 WHERE id='staff'")
        self.db.execute("UPDATE staff_grants SET revoked_at_ms=1 WHERE auth_subject='staff'")
        with self.assertRaises(sqlite3.IntegrityError): self.action("provision")
        self.assertEqual(self.db.execute("SELECT count(*) FROM teacher_role_events").fetchone()[0],0)

    def test_unverified_target_and_self_promotion_denied(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.action("provision",target="unverified")
        with self.assertRaises(sqlite3.IntegrityError):
            self.action("provision",target="staff",tid="staff-as-teacher")
        self.db.execute("UPDATE accounts SET status='disabled' WHERE auth_subject='teacher'")
        with self.assertRaises(sqlite3.IntegrityError):self.action("provision")
        self.assertIsNone(self.teacher())

    def test_invalid_transitions_and_replay_leave_no_audit_or_state(self):
        with self.assertRaises(sqlite3.IntegrityError):self.action("activate")
        with self.assertRaises(sqlite3.IntegrityError):self.action("qualify")
        self.action("provision",operation="fixed-operation")
        with self.assertRaises(sqlite3.IntegrityError):self.action("provision",operation="fixed-operation")
        with self.assertRaises(sqlite3.IntegrityError):self.action("provision")
        with self.assertRaises(sqlite3.IntegrityError):self.action("activate")
        with self.assertRaises(sqlite3.IntegrityError):self.action("suspend")
        self.assertEqual(self.db.execute("SELECT count(*) FROM teacher_role_events").fetchone()[0],1)
        self.assertEqual(self.teacher(),(0,"disabled"))

    def test_revocation_disables_teacher_without_deleting_history(self):
        self.action("provision");self.action("qualify");self.action("activate")
        self.action("revoke_qualification")
        self.assertEqual(self.teacher(),(0,"disabled"))
        with self.assertRaises(sqlite3.IntegrityError):self.action("activate")
        self.assertEqual(self.db.execute("SELECT count(*) FROM teacher_role_events").fetchone()[0],4)

    def test_actor_account_disabled_cannot_mutate_even_with_grant(self):
        self.db.execute("UPDATE accounts SET status='disabled' WHERE auth_subject='staff'")
        with self.assertRaises(sqlite3.IntegrityError):self.action("provision")
        self.assertIsNone(self.teacher())

if __name__=="__main__":
    unittest.main()
