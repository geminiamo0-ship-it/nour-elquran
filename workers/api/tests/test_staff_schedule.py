"""B3: execute real immutable schedule command triggers on full D1 migrations."""
import sqlite3
import unittest
from pathlib import Path
from uuid import uuid4

ROOT=Path(__file__).resolve().parents[1]
SQL=("INSERT INTO staff_schedule_events(id,operation_id,actor_auth_subject,action,"
     "resource_id,learner_id,teacher_id,starts_at_ms,ends_at_ms,lesson_kind,"
     "reason,at_ms) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)")
T=1_800_000_000_000
SLOT=2_400_000
YEAR=366*24*60*60*1000
class TeacherSchedulingTests(unittest.TestCase):
 def setUp(self):
  self.db=sqlite3.connect(":memory:")
  self.addCleanup(self.db.close)
  self.db.execute("PRAGMA foreign_keys=ON")
  for migration in sorted((ROOT/"migrations").glob("*.sql")):
   self.db.executescript(migration.read_text())
  for name,verified in (("staff",1),("other",1),("teacher-a",1),("teacher-b",1)):
   self.db.execute("INSERT INTO auth_users(id,name,email,created_at,updated_at,phone_number_verified)"
                   " VALUES(?,?,?,?,?,?)",(name,name,name+"@noor.invalid",0,0,verified))
   self.db.execute("INSERT INTO accounts(id,auth_subject,created_at_ms) VALUES(?,?,0)",
                   ("acct-"+name,name))
  for child,owner in (("child-a","staff"),("child-b","other"),("child-c","other")):
   self.db.execute("INSERT INTO learners(id,account_id,display_name,learner_type,created_at_ms)"
                   " VALUES(?,?,?,'child',0)",(child,"acct-"+owner,child))
  for teacher in ("teacher-a","teacher-b"):
   self.db.execute("INSERT INTO teachers(id,auth_subject,qualified,status) VALUES(?,?,1,'active')",
                   ("id-"+teacher,teacher))
  self.db.execute("INSERT INTO staff_grants(auth_subject,permission) VALUES('staff','roles.manage')")
  self.counter=0

 def action(self,action,resource=None,child="child-a",teacher="id-teacher-a",
            start=T+SLOT,end=T+YEAR,kind=None,now=T,actor="staff",op=None):
  self.counter+=1
  if action=="book":end=start+SLOT
  if action in ("revoke","cancel"):child="";teacher="";start=None;end=None
  row=("event-"+str(self.counter),op or str(uuid4()),actor,action,resource or "resource-"+str(self.counter),
       child,teacher,start,end,kind if action=="book" else None,"Staff-reviewed educational schedule",now)
  self.db.execute(SQL,row)
  return row[4]

 def count(self,table):
  return self.db.execute("SELECT count(*) FROM "+table).fetchone()[0]

 def test_assignment_and_booking_show_in_existing_real_teacher_calendar_queries(self):
  assignment=self.action("assign")
  booked=self.action("book",kind="standard")
  assert self.db.execute("SELECT status,ends_at_ms-starts_at_ms FROM lessons WHERE id=?",(booked,)).fetchone()==("scheduled",SLOT)
  assert self.db.execute("SELECT teacher_id FROM teacher_assignments WHERE id=?",(assignment,)).fetchone()==("id-teacher-a",)
  self.assertEqual(self.count("staff_schedule_events"),2)
  self.assertEqual(self.count("lessons"),1)
  self.assertEqual(self.count("teacher_assignments"),1)

 def test_assignment_overlap_and_booking_collisions_are_atomic(self):
  self.action("assign")
  with self.assertRaises(sqlite3.IntegrityError):
   self.action("assign",teacher="id-teacher-b")
  self.action("book",kind="trial")
  with self.assertRaises(sqlite3.IntegrityError):
   self.action("book",kind="standard",child="child-b")
  with self.assertRaises(sqlite3.IntegrityError):
   self.action("book",kind="standard",teacher="id-teacher-b")
  self.assertEqual(self.count("staff_schedule_events"),2)
  self.assertEqual(self.count("lessons"),1)

 def test_rejects_booking_without_assignment_or_full_coverage(self):
  with self.assertRaisesRegex(sqlite3.IntegrityError,"primary assignment"):
   self.action("book",kind="standard")
  self.action("assign",end=T+SLOT+SLOT-1)
  with self.assertRaisesRegex(sqlite3.IntegrityError,"primary assignment"):
   self.action("book",kind="standard")
  self.assertEqual(self.count("lessons"),0)

 def test_cancel_six_hours_ahead_then_rebook_and_revoke(self):
  assign=self.action("assign")
  lesson=self.action("book",start=T+7*60*60*1000,kind="makeup")
  with self.assertRaisesRegex(sqlite3.IntegrityError,"cancel outstanding"):
   self.action("revoke",resource=assign)
  with self.assertRaisesRegex(sqlite3.IntegrityError,"six hours"):
   self.action("cancel",resource=lesson,now=T+2*60*60*1000)
  self.action("cancel",resource=lesson)
  self.assertEqual(self.db.execute("SELECT status FROM lessons WHERE id=?",(lesson,)).fetchone()[0],"cancelled")
  self.action("revoke",resource=assign)
  self.assertIsNotNone(self.db.execute("SELECT revoked_at_ms FROM teacher_assignments WHERE id=?",(assign,)).fetchone()[0])
  with self.assertRaises(sqlite3.IntegrityError):self.action("revoke",resource=assign)

 def test_unverified_or_revoked_staff_cannot_commit_or_view_private(self):
  with self.assertRaisesRegex(sqlite3.IntegrityError,"unverified staff"):
   self.action("assign",actor="other")
  self.db.execute("UPDATE staff_grants SET revoked_at_ms=? WHERE auth_subject='staff'",(T,))
  with self.assertRaisesRegex(sqlite3.IntegrityError,"unverified staff"):
   self.action("assign")
  self.assertEqual(self.count("staff_schedule_events"),0)

 def test_disabled_teacher_or_owner_and_archived_child_fail_closed(self):
  self.db.execute("UPDATE teachers SET qualified=0 WHERE id='id-teacher-a'")
  with self.assertRaises(sqlite3.IntegrityError):self.action("assign")
  self.db.execute("UPDATE teachers SET qualified=1")
  self.db.execute("UPDATE accounts SET status='disabled' WHERE id='acct-staff'")
  with self.assertRaises(sqlite3.IntegrityError):self.action("assign")
  self.db.execute("UPDATE accounts SET status='active' WHERE id='acct-staff'")
  self.db.execute("UPDATE learners SET status='archived' WHERE id='child-a'")
  with self.assertRaises(sqlite3.IntegrityError):self.action("assign")
  self.assertEqual(self.count("teacher_assignments"),0)

 def test_cancel_never_ends_live_or_completed_automatically(self):
  self.action("assign")
  lesson=self.action("book",kind="standard")
  self.db.execute("UPDATE lessons SET status='live' WHERE id=?",(lesson,))
  with self.assertRaises(sqlite3.IntegrityError):self.action("cancel",resource=lesson)
  self.assertEqual(self.db.execute("SELECT status FROM lessons WHERE id=?",(lesson,)).fetchone()[0],"live")

 def test_immutable_audit_replay_and_unbounded_booking_denial(self):
  self.action("assign",op="00000000-0000-4000-8000-000000000001")
  with self.assertRaises(sqlite3.IntegrityError):
   self.action("assign",op="00000000-0000-4000-8000-000000000001")
  with self.assertRaises(sqlite3.IntegrityError):self.db.execute("DELETE FROM staff_schedule_events")
  with self.assertRaises(sqlite3.IntegrityError):self.db.execute("UPDATE staff_schedule_events SET reason='changed'")
  with self.assertRaises(sqlite3.IntegrityError):self.action("book",start=T-SLOT,kind="trial")
  with self.assertRaises(sqlite3.IntegrityError):self.action("book",start=T+3*YEAR,kind="trial")
  self.assertEqual(self.count("staff_schedule_events"),1)

if __name__=="__main__":
 unittest.main()
