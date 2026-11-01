"""#244: SQL transaction must never drop original trial on replacement failure."""
import sqlite3
import unittest
from uuid import uuid4
from test_free_trial_booking import FreeTrialD1,T,SLOT

REPLACE="""INSERT INTO trial_owner_reschedule_events
 (id,operation_id,old_lesson_id,new_lesson_id,new_slot_id,
 learner_id,actor_subject,at_ms) VALUES(?,?,?,?,?,?,?,?)"""

class AtomicTrialReplacementTests(FreeTrialD1):
 def replace(self,old,slot,learner='child-a',actor='staff',at=T,op=None):
  fresh=str(uuid4())
  self.db.execute(REPLACE,(str(uuid4()),op or str(uuid4()),old,fresh,
                            slot,learner,actor,at))
  return fresh

 def test_success_updates_both_lessons_and_only_exact_auto_grant(self):
  old_slot=self.open(starts=T+7*3600000)
  new_slot=self.open(starts=T+9*3600000)
  old=self.book(old_slot)
  old_grant=self.db.execute("""SELECT g.assignment_id
    FROM trial_booking_auto_grants g JOIN trial_booking_events b
      ON b.id=g.booking_id WHERE b.lesson_id=?""",(old,)).fetchone()[0]
  new=self.replace(old,new_slot)
  self.assertEqual(self.db.execute(
   "SELECT status FROM lessons WHERE id=?",(old,)).fetchone(),('cancelled',))
  self.assertEqual(self.db.execute(
   "SELECT status,kind,ends_at_ms-starts_at_ms FROM lessons WHERE id=?",
   (new,)).fetchone(),('scheduled','trial',SLOT))
  self.assertEqual(self.db.execute(
   "SELECT revoked_at_ms FROM teacher_assignments WHERE id=?",
   (old_grant,)).fetchone(),(T,))
  self.assertEqual(self.db.execute(
   "SELECT count(*) FROM trial_booking_events").fetchone(),(2,))
  self.assertEqual(self.db.execute('PRAGMA foreign_key_check').fetchall(),[])

 def test_unavailable_new_slot_rolls_back_original_cancellation_and_grant(self):
  old_slot=self.open(starts=T+7*3600000)
  new_slot=self.open(starts=T+9*3600000)
  old=self.book(old_slot)
  other=self.book(new_slot,learner='child-b',owner='other')
  before=self.db.execute("SELECT count(*) FROM trial_booking_events").fetchone()[0]
  with self.assertRaisesRegex(sqlite3.IntegrityError,
                              'TRIAL_RESCHEDULE_SLOT_OCCUPIED'):
   self.replace(old,new_slot)
  self.assertEqual(self.db.execute(
   "SELECT status FROM lessons WHERE id=?",(old,)).fetchone(),('scheduled',))
  self.assertEqual(self.db.execute(
   "SELECT status FROM lessons WHERE id=?",(other,)).fetchone(),('scheduled',))
  self.assertEqual(self.db.execute("SELECT count(*) FROM trial_booking_events").fetchone()[0],before)
  self.assertEqual(self.db.execute("SELECT count(*) FROM trial_owner_reschedule_events").fetchone()[0],0)
  self.assertEqual(self.db.execute("""SELECT COUNT(*) FROM teacher_assignments
     WHERE learner_id='child-a' AND revoked_at_ms IS NULL""").fetchone(),(1,))

 def test_reject_late_cross_sibling_wrong_owner_and_same_slot(self):
  old_slot=self.open(starts=T+7*3600000)
  next_slot=self.open(starts=T+9*3600000)
  old=self.book(old_slot)
  with self.assertRaisesRegex(sqlite3.IntegrityError,'TRIAL_RESCHEDULE_TOO_LATE'):
   self.replace(old,next_slot,at=T+2*3600000)
  with self.assertRaisesRegex(sqlite3.IntegrityError,'TRIAL_RESCHEDULE_OWNER_DENIED'):
   self.replace(old,next_slot,learner='child-b',actor='other')
  with self.assertRaisesRegex(sqlite3.IntegrityError,'TRIAL_RESCHEDULE_OWNER_DENIED'):
   self.replace(old,next_slot,actor='other')
  with self.assertRaisesRegex(sqlite3.IntegrityError,'TRIAL_RESCHEDULE_SLOT_UNAVAILABLE'):
   self.replace(old,old_slot)
  self.assertEqual(self.db.execute(
   "SELECT status FROM lessons WHERE id=?",(old,)).fetchone(),('scheduled',))

 def test_no_unauthorized_replay_or_mutation_and_early_cancel_still_works(self):
  old_slot=self.open(starts=T+7*3600000)
  new_slot=self.open(starts=T+9*3600000)
  old=self.book(old_slot)
  op=str(uuid4())
  new=self.replace(old,new_slot,op=op)
  with self.assertRaises(sqlite3.IntegrityError):
   self.replace(old,new_slot,op=op)
  with self.assertRaisesRegex(sqlite3.IntegrityError,'TRIAL_RESCHEDULE_IMMUTABLE'):
   self.db.execute('DELETE FROM trial_owner_reschedule_events')
  self.db.execute("""INSERT INTO trial_owner_cancellation_events
    (id,operation_id,lesson_id,learner_id,actor_subject,at_ms)
    VALUES(?,?,?,?,?,?)""",(str(uuid4()),str(uuid4()),new,'child-a','staff',T))
  self.assertEqual(self.db.execute(
    "SELECT status FROM lessons WHERE id=?",(new,)).fetchone(),('cancelled',))
if __name__=='__main__':unittest.main()
