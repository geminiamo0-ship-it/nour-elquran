"""#247: D1 event-sourced in-app inbox, authorization and read CAS with real SQLite triggers."""
import sqlite3
import unittest
from test_learner_quran_ledger import CumulativeQuranLedgerD1, ED, TASK, PUBLISH

class InboxD1(unittest.TestCase):
 def setUp(self):
  self.fixture=CumulativeQuranLedgerD1()
  self.fixture.setUp()
  self.db=self.fixture.db
  self.db.commit()
 def tearDown(self):self.db.close()
 def records(self,role=None):
  query="SELECT id,learner_id,recipient_subject,recipient_kind,kind,source_id,created_at_ms FROM noor_inbox_items"
  if role:
   return self.db.execute(query+" WHERE recipient_kind=? ORDER BY kind",(role,)).fetchall()
  return self.db.execute(query).fetchall()
 def read(self,notification,subject='owner-a',action='read',rev=0,operation='3145a6fa-1d94-4994-91e7-5819692ba3b6'):
  self.db.execute("""INSERT INTO noor_inbox_read_events(id,notification_id,operation_id,
   actor_subject,action,expected_revision,revision,at_ms)
   VALUES(?,?,?,?,?,?,?,?)""",
    ('5145a6fa-1d94-4994-91e7-5819692ba3b6',notification,operation,
     subject,action,rev,rev+1,5000))
 def test_only_real_source_creates_notices_and_owner_sibling_scoped(self):
  notices=self.records()
  self.assertEqual(len(notices),2)
  self.assertEqual({(r[3],r[4]) for r in notices},
   {('owner','lesson_booked'),('teacher','lesson_booked')})
  self.assertEqual({r[1] for r in notices},{'one'})
  self.db.execute("""INSERT INTO assignment_publish_events(operation_id,assignment_id,learner_id,
   actor_auth_subject,kind,edition_id,surah,from_ayah,to_ayah,due_at_ms,instructions,published_at_ms)
   VALUES(?,?,?,'teacher-a','memorization',?,1,1,2,5000,'Real assignment',2000)""",
   (PUBLISH,TASK,'one',ED))
  owner=self.records('owner')
  self.assertEqual(len(owner),2)
  self.assertEqual({x[4] for x in owner},{'lesson_booked','assignment_published'})
  self.assertEqual(len(self.records('teacher')),1)
  self.assertEqual(self.db.execute("SELECT COUNT(*) FROM noor_inbox_items WHERE learner_id='sibling'").fetchone(),(0,))
  self.assertEqual(self.db.execute('PRAGMA foreign_key_check').fetchall(),[])
 def test_immutable_versioned_read_and_cross_identity(self):
  own=self.db.execute("""SELECT id FROM noor_inbox_items
    WHERE recipient_kind='owner' LIMIT 1""").fetchone()[0]
  with self.assertRaisesRegex(sqlite3.IntegrityError,'INBOX_ACCESS_DENIED'):
   self.read(own,'teacher-a')
  with self.assertRaisesRegex(sqlite3.IntegrityError,'INBOX_ACCESS_DENIED'):
   self.read(own,'owner-b')
  self.db.commit()
  self.read(own)
  self.db.commit()
  self.assertEqual(self.db.execute(
   'SELECT action,revision FROM noor_inbox_read_events').fetchone(),('read',1))
  with self.assertRaisesRegex(sqlite3.IntegrityError,'INBOX_REVISION_CONFLICT'):
   self.read(own,rev=0,operation='4145a6fa-1d94-4994-91e7-5819692ba3b6')
  with self.assertRaisesRegex(sqlite3.IntegrityError,'INBOX_READ_IMMUTABLE'):
   self.db.execute("DELETE FROM noor_inbox_read_events")
  with self.assertRaisesRegex(sqlite3.IntegrityError,'INBOX_IMMUTABLE'):
   self.db.execute("DELETE FROM noor_inbox_items")
 def test_revoked_teacher_and_archived_owner_block_read_actions(self):
  teacher=self.db.execute("""SELECT id FROM noor_inbox_items
   WHERE recipient_kind='teacher' LIMIT 1""").fetchone()[0]
  self.db.execute("UPDATE teachers SET qualified=0 WHERE id='teacher-id-a'")
  with self.assertRaisesRegex(sqlite3.IntegrityError,'INBOX_ACCESS_DENIED'):
   self.read(teacher,'teacher-a')
  self.db.execute("UPDATE learners SET status='archived' WHERE id='one'")
  own=self.db.execute("""SELECT id FROM noor_inbox_items
   WHERE recipient_kind='owner' LIMIT 1""").fetchone()[0]
  with self.assertRaisesRegex(sqlite3.IntegrityError,'INBOX_ACCESS_DENIED'):
   self.read(own)
 def test_actual_completed_lesson_creates_notices_but_not_fake_other_sibling(self):
  # The shared ledger fixture has already started l1, so the truthful
  # source transition is live -> completed, not rescheduling a live lesson.
  self.db.execute("UPDATE lessons SET status='completed',ended_at_ms=5000 WHERE id='l1'")
  self.assertEqual(self.db.execute(
   "SELECT COUNT(*) FROM noor_inbox_items WHERE kind='lesson_completed'").fetchone(),(2,))
  self.assertEqual(self.db.execute(
   "SELECT COUNT(*) FROM noor_inbox_items WHERE learner_id='sibling'").fetchone(),(0,))
if __name__=='__main__':unittest.main()
