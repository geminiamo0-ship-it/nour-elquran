"""#317: native SQLite/D1 paid slot requests; no spend until staff approval."""
import sqlite3
import unittest
from uuid import uuid4
from test_academy_booking import AcademyBookingD1
from test_staff_schedule import T, SLOT
DAY=86400000

REQUEST = """INSERT INTO academy_paid_slot_request_events
 (id,operation_id,learner_id,teacher_id,cycle_id,actor_subject,
 starts_at_ms,ends_at_ms,requested_at_ms) VALUES(?,?,?,?,?,?,?,?,?)"""
DECIDE = """INSERT INTO academy_paid_slot_decision_events
 (id,operation_id,request_id,actor_subject,decision,lesson_id,reason,at_ms)
 VALUES(?,?,?,?,?,?,?,?)"""

class PaidSlotRequestD1(unittest.TestCase):
 def setUp(self):
  self.fixture=AcademyBookingD1()
  self.fixture.setUp()
  self.db=self.fixture.db
  self.fixture.fixture.action('assign')
  self.start=T+3*SLOT

 def request(self, actor='staff', child='child-a', teacher='id-teacher-a',
             cycle=None, start=None, op=None, at=T):
  request_id=str(uuid4())
  start=self.start if start is None else start
  self.db.execute(REQUEST,(request_id,op or str(uuid4()),child,teacher,
   cycle or self.fixture.cycle,actor,start,start+SLOT,at))
  return request_id

 def decide(self, request_id, decision='approved', actor='staff', at=T+1):
  lesson_id=str(uuid4()) if decision=='approved' else None
  self.db.execute(DECIDE,(str(uuid4()),str(uuid4()),request_id,actor,
   decision,lesson_id,'Academy reviewed guardian requested slot',at))
  return lesson_id

 def test_request_does_not_book_or_spend_until_staff_approval(self):
  req=self.request()
  self.assertEqual(self.db.execute('SELECT count(*) FROM lessons').fetchone(),(0,))
  self.assertEqual(self.db.execute('SELECT count(*) FROM subscription_spend_events').fetchone(),(0,))
  lesson=self.decide(req)
  self.assertEqual(self.db.execute(
   'SELECT kind,status,ends_at_ms-starts_at_ms FROM lessons WHERE id=?',
   (lesson,)).fetchone(),('standard','scheduled',SLOT))
  self.assertEqual(self.db.execute(
   'SELECT source_kind,source_id FROM subscription_spend_events WHERE lesson_id=?',
   (lesson,)).fetchone(),('cycle',self.fixture.cycle))
  self.assertEqual(self.db.execute('PRAGMA foreign_key_check').fetchall(),[])
  with self.assertRaises(sqlite3.IntegrityError):
   self.decide(req)
  self.assertEqual(self.db.execute('SELECT count(*) FROM subscription_spend_events').fetchone(),(1,))

 def test_foreign_household_wrong_cycle_and_assignment_denied_before_request(self):
  for kwargs in ({'actor':'other'}, {'child':'child-b'},
                 {'teacher':'id-teacher-b'}, {'cycle':str(uuid4())}):
   with self.subTest(kwargs=kwargs),self.assertRaises(sqlite3.IntegrityError):
    self.request(**kwargs)
  self.assertEqual(self.db.execute(
   'SELECT count(*) FROM academy_paid_slot_request_events').fetchone(),(0,))

 def test_duplicate_pending_and_replayed_operation_are_not_second_requests(self):
  op=str(uuid4())
  req=self.request(op=op)
  with self.assertRaisesRegex(sqlite3.IntegrityError,'ACADEMY_SLOT_REQUEST_PENDING'):
   self.request()
  with self.assertRaises(sqlite3.IntegrityError):
   self.request(op=op)
  self.decide(req,decision='rejected')
  self.assertEqual(self.db.execute('SELECT count(*) FROM lessons').fetchone(),(0,))
  self.assertEqual(self.db.execute('SELECT count(*) FROM subscription_spend_events').fetchone(),(0,))
  self.assertIsNotNone(self.request(start=self.start+SLOT))

 def test_expired_pending_proposal_does_not_lock_learner_out(self):
  old=self.request()
  with self.assertRaisesRegex(sqlite3.IntegrityError,'ACADEMY_SLOT_REQUEST_PENDING'):
   self.request(start=self.start+3*SLOT)
  now=self.start+60000
  fresh=self.request(start=self.start+3*SLOT,at=now)
  self.assertNotEqual(old,fresh)
  self.assertEqual(self.db.execute('SELECT count(*) FROM academy_paid_slot_request_events').fetchone(),(2,))
  self.assertEqual(self.db.execute('SELECT count(*) FROM subscription_spend_events').fetchone(),(0,))
  with self.assertRaisesRegex(sqlite3.IntegrityError,'ACADEMY_SLOT_REQUEST_EXPIRED'):
   self.decide(old,at=now)
  lesson=self.decide(fresh,at=now)
  self.assertEqual(self.db.execute('SELECT count(*) FROM subscription_spend_events WHERE lesson_id=?',(lesson,)).fetchone(),(1,))
  self.assertEqual(self.db.execute('SELECT count(*) FROM academy_paid_slot_decision_events').fetchone(),(1,))
  self.assertEqual(self.db.execute('PRAGMA foreign_key_check').fetchall(),[])

 def test_reject_revoked_staff_and_expired_request_never_spend(self):
  req=self.request()
  with self.assertRaisesRegex(sqlite3.IntegrityError,'ACADEMY_STAFF_DENIED'):
   self.decide(req,actor='other')
  with self.assertRaisesRegex(sqlite3.IntegrityError,'ACADEMY_SLOT_REQUEST_EXPIRED'):
   self.decide(req,at=self.start)
  self.assertEqual(self.db.execute(
   'SELECT count(*) FROM academy_paid_slot_decision_events').fetchone(),(0,))
  self.assertEqual(self.db.execute('SELECT count(*) FROM lessons').fetchone(),(0,))

 def test_credit_exhausted_after_request_rolls_back_approval(self):
  req=self.request(start=T+20*SLOT)
  for i in range(8):
   self.fixture.paid(start=T+(3+i)*SLOT)
  self.assertEqual(self.db.execute('SELECT count(*) FROM subscription_spend_events').fetchone(),(8,))
  with self.assertRaises(sqlite3.IntegrityError):
   self.decide(req)
  self.assertEqual(self.db.execute(
   'SELECT count(*) FROM academy_paid_slot_decision_events').fetchone(),(0,))
  self.assertEqual(self.db.execute('SELECT count(*) FROM lessons').fetchone(),(8,))
  with self.assertRaisesRegex(sqlite3.IntegrityError,'ACADEMY_SLOT_CYCLE_DENIED'):
   self.request(start=T+21*SLOT)

 def test_overlapping_lesson_after_request_aborts_approval_without_debit(self):
  req=self.request()
  self.fixture.paid(start=self.start)
  with self.assertRaises(sqlite3.IntegrityError):
   self.decide(req)
  self.assertEqual(self.db.execute('SELECT count(*) FROM academy_paid_slot_decision_events').fetchone(),(0,))
  self.assertEqual(self.db.execute('SELECT count(*) FROM subscription_spend_events').fetchone(),(1,))

 def test_immutable_events_and_window_bounds(self):
  req=self.request()
  for sql in ('UPDATE academy_paid_slot_request_events SET starts_at_ms=0',
              'DELETE FROM academy_paid_slot_request_events'):
   with self.assertRaisesRegex(sqlite3.IntegrityError,'ACADEMY_IMMUTABLE'):
    self.db.execute(sql)
  for at,start in ((T,T+SLOT//100),(T,T+31*DAY)):
   with self.assertRaises(sqlite3.IntegrityError):
    self.request(at=at,start=start)
  self.decide(req,decision='rejected')
  for sql in ('UPDATE academy_paid_slot_decision_events SET reason=\'changed\'',
              'DELETE FROM academy_paid_slot_decision_events'):
   with self.assertRaisesRegex(sqlite3.IntegrityError,'ACADEMY_IMMUTABLE'):
    self.db.execute(sql)

if __name__=='__main__':
 unittest.main()
