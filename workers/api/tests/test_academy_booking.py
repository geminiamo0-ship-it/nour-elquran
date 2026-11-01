"""#315: actual D1 transactions for Admin trial review and prepaid 40-minute lessons."""
import sqlite3
import unittest
from uuid import uuid4
from test_staff_schedule import TeacherSchedulingTests,T,SLOT
DAY=86400000

class AcademyBookingD1(unittest.TestCase):
 def setUp(self):
  self.fixture=TeacherSchedulingTests();self.fixture.setUp()
  self.db=self.fixture.db
  self.package=str(uuid4());self.version=str(uuid4())
  self.db.execute("""INSERT INTO academy_package_events
  (id,operation_id,package_id,actor_subject,title,price_egp,sessions,active,at_ms)
  VALUES(?,?,?,?,?,?,?,?,?)""",(self.version,str(uuid4()),self.package,'staff',
   'Eight lessons',1800,8,1,T-1000))
  self.cycle=str(uuid4())
  self.db.execute("""INSERT INTO academy_subscription_activation_events
  (id,operation_id,actor_subject,learner_id,package_version_id,cycle_id,
  previous_cycle_id,rollover_sessions,starts_at_ms,ends_at_ms,note,manually_confirmed,at_ms)
  VALUES(?,?,?,?,?,?,NULL,0,?,?,?,1,?)""",
  (str(uuid4()),str(uuid4()),'staff','child-a',self.version,self.cycle,
   T,T+30*DAY,'Manual receipt checked in test academy',T))
 def paid(self,start=T+3*SLOT,actor='staff',child='child-a'):
  lesson=str(uuid4())
  self.db.execute("""INSERT INTO academy_paid_booking_events
  (id,operation_id,lesson_id,learner_id,teacher_id,cycle_id,actor_subject,
  starts_at_ms,ends_at_ms,reason,at_ms) VALUES(?,?,?,?,?,?,?,?,?,?,?)""",
  (str(uuid4()),str(uuid4()),lesson,child,'id-teacher-a',self.cycle,
   actor,start,start+SLOT,'Booked by authorized academy operator',T))
  return lesson
 def test_one_insert_books_and_spends_exactly_one_real_unit(self):
  self.fixture.action('assign')
  lesson=self.paid()
  self.assertEqual(self.db.execute('SELECT status,kind FROM lessons WHERE id=?',
   (lesson,)).fetchone(),('scheduled','standard'))
  self.assertEqual(self.db.execute("""SELECT source_kind,source_id FROM
   subscription_spend_events WHERE lesson_id=?""",(lesson,)).fetchone(),('cycle',self.cycle))
  self.assertEqual(self.db.execute('PRAGMA foreign_key_check').fetchall(),[])
 def test_wrong_teacher_overlap_or_revoked_staff_cannot_spend(self):
  with self.assertRaisesRegex(sqlite3.IntegrityError,'ACADEMY_PAID_ASSIGNMENT_MISSING'):
   self.paid()
  self.fixture.action('assign')
  with self.assertRaisesRegex(sqlite3.IntegrityError,'ACADEMY_STAFF_DENIED'):
   self.paid(actor='other')
  self.paid()
  with self.assertRaises(sqlite3.IntegrityError):self.paid(start=T+3*SLOT)
  self.assertEqual(self.db.execute('SELECT COUNT(*) FROM subscription_spend_events').fetchone(),(1,))
 def test_signed_trial_request_review_books_exactly_once(self):
  slot=str(uuid4());now=T
  self.db.execute("""INSERT INTO trial_open_slot_events
   (id,operation_id,actor_subject,teacher_id,starts_at_ms,ends_at_ms,published_at_ms)
   VALUES(?,?,?,?,?,?,?)""",(slot,str(uuid4()),'staff','id-teacher-a',
    T+7*DAY,T+7*DAY+SLOT,T))
  request=str(uuid4())
  self.db.execute("""INSERT INTO academy_trial_request_events
   (id,operation_id,learner_id,slot_id,actor_subject,requested_at_ms)
   VALUES(?,?,?,?,?,?)""",(request,str(uuid4()),'child-a',slot,'staff',T))
  lesson=str(uuid4())
  self.db.execute("""INSERT INTO academy_trial_decision_events
  (id,operation_id,request_id,actor_subject,decision,lesson_id,reason,at_ms)
  VALUES(?,?,?,?,?,?,?,?)""",(str(uuid4()),str(uuid4()),request,'staff',
    'approved',lesson,'Staff approved the requested trial slot',T+1))
  self.assertEqual(self.db.execute('SELECT kind,status FROM lessons WHERE id=?',
    (lesson,)).fetchone(),('trial','scheduled'))
  self.assertEqual(self.db.execute('SELECT COUNT(*) FROM trial_booking_events').fetchone(),(1,))
  with self.assertRaises(sqlite3.IntegrityError):
   self.db.execute("""INSERT INTO academy_trial_decision_events
   (id,operation_id,request_id,actor_subject,decision,lesson_id,reason,at_ms)
   VALUES(?,?,?,?,?,?,?,?)""",(str(uuid4()),str(uuid4()),request,'staff',
   'approved',str(uuid4()),'Replay under a different operation ID',T+1))
 def test_denied_owner_request_and_staff_review_are_atomic(self):
  slot=str(uuid4())
  self.db.execute("""INSERT INTO trial_open_slot_events
   (id,operation_id,actor_subject,teacher_id,starts_at_ms,ends_at_ms,published_at_ms)
   VALUES(?,?,?,?,?,?,?)""",(slot,str(uuid4()),'staff','id-teacher-a',
    T+DAY,T+DAY+SLOT,T))
  with self.assertRaisesRegex(sqlite3.IntegrityError,'ACADEMY_OWNER_DENIED'):
   self.db.execute("""INSERT INTO academy_trial_request_events
   (id,operation_id,learner_id,slot_id,actor_subject,requested_at_ms)
   VALUES(?,?,?,?,?,?)""",(str(uuid4()),str(uuid4()),'child-a',slot,'other',T))
  req=str(uuid4())
  self.db.execute("""INSERT INTO academy_trial_request_events
   (id,operation_id,learner_id,slot_id,actor_subject,requested_at_ms)
   VALUES(?,?,?,?,?,?)""",(req,str(uuid4()),'child-a',slot,'staff',T))
  with self.assertRaisesRegex(sqlite3.IntegrityError,'ACADEMY_STAFF_DENIED'):
   self.db.execute("""INSERT INTO academy_trial_decision_events
   (id,operation_id,request_id,actor_subject,decision,lesson_id,reason,at_ms)
   VALUES(?,?,?,?,?,?,?,?)""",(str(uuid4()),str(uuid4()),req,'other',
    'approved',str(uuid4()),'Not an authorized staff actor',T+1))
  self.assertEqual(self.db.execute('SELECT COUNT(*) FROM lessons').fetchone(),(0,))
if __name__=='__main__':unittest.main()
