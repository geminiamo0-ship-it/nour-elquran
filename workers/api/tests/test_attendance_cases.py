"""#246: preliminary no-show is auditable, appealable and never billed automatically."""
import sqlite3
import unittest
from uuid import uuid4
from test_staff_schedule import TeacherSchedulingTests,T,SLOT

REPORT="""INSERT INTO attendance_incident_events(id,operation_id,lesson_id,learner_id,
actor_subject,kind,reason,reported_at_ms) VALUES(?,?,?,?,?,?,?,?)"""
APPEAL="""INSERT INTO attendance_appeal_events(id,operation_id,incident_id,
learner_id,actor_subject,reason,submitted_at_ms) VALUES(?,?,?,?,?,?,?)"""
REVIEW="""INSERT INTO attendance_review_events(id,operation_id,appeal_id,
actor_subject,decision,reason,reviewed_at_ms) VALUES(?,?,?,?,?,?,?)"""

class AttendanceCaseD1(unittest.TestCase):
 def setUp(self):
  self.fixture=TeacherSchedulingTests()
  self.fixture.setUp()
  self.db=self.fixture.db
  self.assignment=self.fixture.action('assign')
  self.lesson=self.fixture.action('book',kind='standard')
  self.db.execute("INSERT INTO staff_grants(auth_subject,permission) VALUES('staff','attendance.review')")
  self.db.commit()
 def tearDown(self):self.db.close()
 def incident(self,kind='student_no_show',actor='teacher-a',learner='child-a',at=None,operation=None):
  event=str(uuid4())
  self.db.execute(REPORT,(event,operation or str(uuid4()),self.lesson,learner,
   actor,kind,'Verified signed teacher case with evidence',at or T+SLOT+900000))
  return event
 def appeal(self,incident,actor='staff',learner='child-a',when=None):
  appeal=str(uuid4())
  self.db.execute(APPEAL,(appeal,str(uuid4()),incident,learner,actor,
   'We were present and request an administrative review.',when or T+SLOT+1000000))
  return appeal
 def decision(self,appeal,actor='staff'):
  decision=str(uuid4())
  self.db.execute(REVIEW,(decision,str(uuid4()),appeal,actor,'accepted',
   'Reviewed the time evidence and accepted the appeal.',T+SLOT+1200000))
  return decision
 def test_after_15_min_only_preliminary_without_any_credit_or_charge(self):
  with self.assertRaisesRegex(sqlite3.IntegrityError,'ATTENDANCE_NO_SHOW_NOT_ELIGIBLE'):
   self.incident(at=T+SLOT+899999)
  first=self.incident()
  self.assertTrue(first)
  self.assertEqual(self.db.execute('SELECT COUNT(*) FROM attendance_incident_events').fetchone(),(1,))
  self.assertEqual(self.db.execute("SELECT status FROM lessons WHERE id=?",(self.lesson,)).fetchone(),('scheduled',))
  with self.assertRaises(sqlite3.IntegrityError):self.incident()
  self.assertEqual(self.db.execute('PRAGMA foreign_key_check').fetchall(),[])
 def test_spoofed_teacher_sibling_and_revocation_are_rejected(self):
  with self.assertRaisesRegex(sqlite3.IntegrityError,'ATTENDANCE_TEACHER_DENIED'):
   self.incident(actor='teacher-b')
  with self.assertRaisesRegex(sqlite3.IntegrityError,'ATTENDANCE_TEACHER_DENIED'):
   self.incident(learner='child-b')
  self.db.execute("UPDATE teachers SET qualified=0 WHERE id='id-teacher-a'")
  with self.assertRaisesRegex(sqlite3.IntegrityError,'ATTENDANCE_TEACHER_DENIED'):
   self.incident()
  self.assertEqual(self.db.execute('SELECT COUNT(*) FROM attendance_incident_events').fetchone(),(0,))
 def test_started_lesson_cannot_be_falsely_reported_as_no_show(self):
  self.db.execute("UPDATE lessons SET status='live' WHERE id=?",(self.lesson,))
  with self.assertRaisesRegex(sqlite3.IntegrityError,'ATTENDANCE_NO_SHOW_NOT_ELIGIBLE'):
   self.incident()
  self.assertTrue(self.incident(kind='connection_interruption'))
 def test_owner_appeal_within_seven_days_and_one_case_only(self):
  event=self.incident()
  self.db.commit()
  with self.assertRaisesRegex(sqlite3.IntegrityError,'ATTENDANCE_APPEAL_DENIED'):
   self.appeal(event,actor='other')
  with self.assertRaisesRegex(sqlite3.IntegrityError,'ATTENDANCE_APPEAL_DENIED'):
   self.appeal(event,learner='child-b')
  with self.assertRaisesRegex(sqlite3.IntegrityError,'ATTENDANCE_APPEAL_DENIED'):
   self.appeal(event,when=T+SLOT+900000+604800001)
  appeal=self.appeal(event)
  self.assertTrue(appeal)
  with self.assertRaises(sqlite3.IntegrityError):self.appeal(event)
 def test_reviewer_grant_never_bypasses_identity_verification(self):
  event=self.incident();appeal=self.appeal(event);self.db.commit()
  # #309: same verified actor check in Worker and atomic D1 trigger.
  self.db.execute("UPDATE auth_users SET phone_number_verified=0 WHERE id='staff'")
  with self.assertRaisesRegex(sqlite3.IntegrityError,'ATTENDANCE_STAFF_UNVERIFIED'):
   self.decision(appeal)
  self.assertEqual(self.db.execute("SELECT COUNT(*) FROM attendance_review_events").fetchone(),(0,))
  self.db.execute("UPDATE auth_users SET phone_number_verified=1 WHERE id='staff'")
  self.decision(appeal)
  self.assertEqual(self.db.execute("SELECT COUNT(*) FROM attendance_review_events").fetchone(),(1,))
 def test_only_authorized_staff_can_issue_immutable_decision(self):
  event=self.incident();appeal=self.appeal(event);self.db.commit()
  with self.assertRaisesRegex(sqlite3.IntegrityError,'ATTENDANCE_STAFF_DENIED'):
   self.decision(appeal,actor='other')
  self.decision(appeal)
  self.assertEqual(self.db.execute('SELECT decision FROM attendance_review_events').fetchone(),('accepted',))
  with self.assertRaisesRegex(sqlite3.IntegrityError,'ATTENDANCE_REVIEW_IMMUTABLE'):
   self.db.execute("DELETE FROM attendance_review_events")
  with self.assertRaisesRegex(sqlite3.IntegrityError,'ATTENDANCE_APPEAL_IMMUTABLE'):
   self.db.execute("UPDATE attendance_appeal_events SET reason='edited'")
  with self.assertRaisesRegex(sqlite3.IntegrityError,'ATTENDANCE_IMMUTABLE'):
   self.db.execute("DELETE FROM attendance_incident_events")
if __name__=='__main__':unittest.main()
