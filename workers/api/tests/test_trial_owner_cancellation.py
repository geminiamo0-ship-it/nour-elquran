"""#244: owner trial early cancellation frees booked slot without revoking other grants."""
import sqlite3
import unittest
from uuid import uuid4
from test_free_trial_booking import FreeTrialD1,T,SLOT

SQL="""INSERT INTO trial_owner_cancellation_events(id,operation_id,lesson_id,
 learner_id,actor_subject,at_ms) VALUES(?,?,?,?,?,?)"""
class OwnerTrialCancellationD1(FreeTrialD1):
 def cancel(self,lesson,learner='child-a',actor='staff',at=T,operation=None):
  self.db.execute(SQL,(str(uuid4()),operation or str(uuid4()),lesson,learner,actor,at))
 def test_early_cancel_releases_only_trial_grant_and_allows_rebook(self):
  slot=self.open(starts=T+7*3600000)
  lesson=self.book(slot)
  grant=self.db.execute("""SELECT g.assignment_id FROM trial_booking_auto_grants g
  JOIN trial_booking_events b ON b.id=g.booking_id
  WHERE b.lesson_id=?""",(lesson,)).fetchone()[0]
  self.cancel(lesson)
  self.assertEqual(self.db.execute('SELECT status FROM lessons WHERE id=?',(lesson,)).fetchone(),('cancelled',))
  self.assertEqual(self.db.execute('SELECT revoked_at_ms FROM teacher_assignments WHERE id=?',(grant,)).fetchone(),(T,))
  self.assertEqual(self.db.execute(
   "SELECT COUNT(*) FROM noor_inbox_items WHERE kind='lesson_cancelled'").fetchone(),(2,))
  next_lesson=self.book(slot)
  self.assertNotEqual(next_lesson,lesson)
  self.assertEqual(self.db.execute("SELECT COUNT(*) FROM lessons WHERE kind='trial'").fetchone(),(2,))
  self.assertEqual(self.db.execute('PRAGMA foreign_key_check').fetchall(),[])
 def test_late_started_or_wrong_child_cannot_cancel(self):
  slot=self.open(starts=T+7*3600000)
  lesson=self.book(slot)
  with self.assertRaisesRegex(sqlite3.IntegrityError,'TRIAL_OWNER_DENIED'):
   self.cancel(lesson,actor='other')
  with self.assertRaisesRegex(sqlite3.IntegrityError,'TRIAL_OWNER_DENIED'):
   self.cancel(lesson,learner='child-b')
  with self.assertRaisesRegex(sqlite3.IntegrityError,'TRIAL_CANCEL_TOO_LATE'):
   self.cancel(lesson,at=T+2*3600000)
  self.db.execute("UPDATE lessons SET status='live' WHERE id=?",(lesson,))
  with self.assertRaisesRegex(sqlite3.IntegrityError,'TRIAL_OWNER_DENIED'):
   self.cancel(lesson)
  self.assertEqual(self.db.execute('SELECT COUNT(*) FROM trial_owner_cancellation_events').fetchone(),(0,))
 def test_preexisting_primary_sheikh_grant_is_never_revoked(self):
  permanent=self.fixture.action('assign',start=T,end=T+366*86400000)
  slot=self.open(starts=T+7*3600000)
  lesson=self.book(slot)
  self.assertEqual(self.db.execute('SELECT COUNT(*) FROM trial_booking_auto_grants').fetchone(),(0,))
  self.cancel(lesson)
  self.assertEqual(self.db.execute(
   'SELECT revoked_at_ms FROM teacher_assignments WHERE id=?',(permanent,)).fetchone(),(None,))
 def test_cancel_event_is_immutable_and_one_per_lesson(self):
  slot=self.open(starts=T+7*3600000)
  lesson=self.book(slot);self.cancel(lesson)
  with self.assertRaises(sqlite3.IntegrityError):
   self.cancel(lesson)
  with self.assertRaisesRegex(sqlite3.IntegrityError,'TRIAL_CANCELLATION_IMMUTABLE'):
   self.db.execute('DELETE FROM trial_owner_cancellation_events')
  with self.assertRaisesRegex(sqlite3.IntegrityError,'TRIAL_GRANT_MAPPING_IMMUTABLE'):
   self.db.execute('DELETE FROM trial_booking_auto_grants')
if __name__=='__main__':unittest.main()
