"""#244: real 30-minute free trial, 40m resource reservation, SQL race guards."""
import sqlite3
import unittest
from uuid import uuid4
from test_staff_schedule import TeacherSchedulingTests,T,SLOT

OPEN="""INSERT INTO trial_open_slot_events(id,operation_id,actor_subject,teacher_id,
 starts_at_ms,ends_at_ms,published_at_ms) VALUES(?,?,?,?,?,?,?)"""
BOOK="""INSERT INTO trial_booking_events(id,operation_id,lesson_id,slot_id,
 learner_id,actor_subject,booked_at_ms) VALUES(?,?,?,?,?,?,?)"""
class FreeTrialD1(unittest.TestCase):
 def setUp(self):
  self.fixture=TeacherSchedulingTests();self.fixture.setUp()
  self.db=self.fixture.db
  self.db.commit()
 def tearDown(self):self.db.close()
 def open(self,teacher='id-teacher-a',starts=T+SLOT,actor='staff'):
  slot=str(uuid4())
  self.db.execute(OPEN,(slot,str(uuid4()),actor,teacher,starts,starts+SLOT,T))
  return slot
 def book(self,slot,learner='child-a',owner='staff',at=T):
  lesson=str(uuid4())
  self.db.execute(BOOK,(str(uuid4()),str(uuid4()),lesson,slot,learner,owner,at))
  return lesson
 def test_staff_publishes_available_teacher_and_owner_books_one_real_trial(self):
  slot=self.open()
  self.assertEqual(self.db.execute('SELECT count(*) FROM lessons').fetchone(),(0,))
  lesson=self.book(slot)
  self.assertEqual(self.db.execute("""SELECT learner_id,actual_teacher_id,kind,status,
    ends_at_ms-starts_at_ms FROM lessons WHERE id=?""",(lesson,)).fetchone(),
    ('child-a','id-teacher-a','trial','scheduled',SLOT))
  self.assertEqual(self.db.execute("""SELECT count(*) FROM teacher_assignments
     WHERE learner_id='child-a' AND teacher_id='id-teacher-a'""").fetchone(),(1,))
  self.assertEqual(self.db.execute("""SELECT count(*) FROM noor_inbox_items
    WHERE learner_id='child-a' AND kind='lesson_booked'""").fetchone(),(2,))
  self.assertEqual(self.db.execute('PRAGMA foreign_key_check').fetchall(),[])
 def test_trial_once_per_child_and_slot_race_safe(self):
  slot=self.open()
  self.book(slot)
  with self.assertRaisesRegex(sqlite3.IntegrityError,'TRIAL_ALREADY_CONSUMED'):
   self.book(slot)
  with self.assertRaisesRegex(sqlite3.IntegrityError,'TRIAL_SLOT_UNAVAILABLE'):
   self.book(slot,learner='child-b',owner='other')
  slot2=self.open(starts=T+2*SLOT)
  with self.assertRaisesRegex(sqlite3.IntegrityError,'TRIAL_ALREADY_CONSUMED'):
   self.book(slot2)
  self.assertEqual(self.db.execute('SELECT COUNT(*) FROM trial_booking_events').fetchone(),(1,))
 def test_other_sibling_teacher_without_approval_cannot_write(self):
  slot=self.open()
  with self.assertRaisesRegex(sqlite3.IntegrityError,'TRIAL_OWNER_DENIED'):
   self.book(slot,learner='child-b',owner='staff')
  with self.assertRaisesRegex(sqlite3.IntegrityError,'TRIAL_OWNER_DENIED'):
   self.book(slot,learner='child-a',owner='other')
  with self.assertRaisesRegex(sqlite3.IntegrityError,'TRIAL_STAFF_DENIED'):
   self.open(actor='other')
  self.db.execute("UPDATE teachers SET status='disabled' WHERE id='id-teacher-a'")
  with self.assertRaisesRegex(sqlite3.IntegrityError,'TRIAL_SLOT_UNAVAILABLE'):
   self.book(slot)
 def test_open_slots_cannot_overlap_or_conflict_with_real_schedule(self):
  self.open()
  with self.assertRaisesRegex(sqlite3.IntegrityError,'TRIAL_SLOT_OVERLAP'):
   self.open(starts=T+SLOT+1200000)
  self.fixture.action('assign',start=T,end=T+366*86400000)
  booked=self.fixture.action('book',start=T+3*SLOT,kind='standard')
  self.assertIsNotNone(booked)
  with self.assertRaisesRegex(sqlite3.IntegrityError,'TRIAL_SLOT_OCCUPIED'):
   self.open(starts=T+3*SLOT)
 def test_early_authorized_cancel_allows_rebook_not_second_attended_trial(self):
  firstSlot=self.open(starts=T+7*3600000)
  lesson=self.book(firstSlot)
  self.fixture.action('cancel',resource=lesson,now=T)
  self.assertEqual(self.db.execute('SELECT status FROM lessons WHERE id=?',(lesson,)).fetchone(),('cancelled',))
  newLesson=self.book(firstSlot)
  self.assertNotEqual(newLesson,lesson)
  self.assertEqual(self.db.execute('SELECT COUNT(*) FROM lessons WHERE kind=\'trial\'').fetchone(),(2,))
  self.db.execute("UPDATE lessons SET status='live' WHERE id=?",(newLesson,))
  with self.assertRaisesRegex(sqlite3.IntegrityError,'TRIAL_ALREADY_CONSUMED'):
   self.book(self.open(starts=T+8*3600000))
 def test_immutable_booking_cannot_hide_past_trial(self):
  slot=self.open()
  self.book(slot)
  with self.assertRaisesRegex(sqlite3.IntegrityError,'TRIAL_BOOKING_IMMUTABLE'):
   self.db.execute('DELETE FROM trial_booking_events')
  with self.assertRaisesRegex(sqlite3.IntegrityError,'TRIAL_SLOT_IMMUTABLE'):
   self.db.execute('UPDATE trial_open_slot_events SET starts_at_ms=0')
if __name__=='__main__':unittest.main()
