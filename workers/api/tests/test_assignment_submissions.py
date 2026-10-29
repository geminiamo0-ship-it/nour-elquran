"""Phase 05B append-only assignment submission/review D1 integrity and identity guards."""
import sqlite3
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]/'migrations'
def uuid(prefix,n):return f'{prefix}0000000-0000-4000-8000-{n:012d}'
class SubmissionLedger(unittest.TestCase):
 def setUp(self):
  self.db=sqlite3.connect(':memory:')
  self.db.execute('PRAGMA foreign_keys=ON')
  for file in ('0001_core.sql','0010_published_assignments.sql','0011_assignment_submissions.sql'):
   self.db.executescript((ROOT/file).read_text())
  self.db.execute("INSERT INTO accounts(id,auth_subject,created_at_ms) VALUES('owner','owner-a',0)")
  self.db.execute("INSERT INTO accounts(id,auth_subject,created_at_ms) VALUES('foreign','owner-b',0)")
  self.db.execute("INSERT INTO learners(id,account_id,display_name,learner_type,created_at_ms) VALUES('learner','owner','L','child',0)")
  self.db.execute("INSERT INTO teachers(id,auth_subject,qualified) VALUES('teacher','sheikh',1)")
  self.db.execute("INSERT INTO teacher_assignments(id,learner_id,teacher_id,starts_at_ms,ends_at_ms) VALUES('assign','learner','teacher',1,900000)")
  self.db.execute("INSERT INTO quran_editions(id,riwayah,page_count,manifest_sha256) VALUES('hafs','hafs',604,?)",('c'*64,))
  self.db.execute("INSERT INTO quran_ayah_anchors(edition_id,surah,ayah,page,word_count) VALUES('hafs',1,1,1,7)")
  self.db.execute("""INSERT INTO assignment_publish_events
    (operation_id,assignment_id,learner_id,actor_auth_subject,kind,edition_id,
    surah,from_ayah,to_ayah,due_at_ms,instructions,published_at_ms)
    VALUES(?,?,'learner','sheikh','memorization','hafs',1,1,1,800000,'review',100)""",
    (uuid('a',1),uuid('b',1)))
  self.assignment=uuid('b',1)
 def tearDown(self):self.db.close()
 def submit(self,n,actor='owner-a',attempt=1,at=200):
  self.db.execute("""INSERT INTO assignment_submission_events
    (operation_id,id,assignment_id,learner_id,actor_auth_subject,attempt,note,submitted_at_ms)
    VALUES(?, ?, ?, 'learner', ?, ?, 'readiness note', ?)""",
    (uuid('c',n),uuid('d',n),self.assignment,actor,attempt,at))
  return uuid('d',n)
 def review(self,n,sid,decision='retry_requested',actor='sheikh',at=300):
  self.db.execute("""INSERT INTO assignment_review_events
    (operation_id,id,submission_id,assignment_id,learner_id,actor_auth_subject,
      decision,feedback,reviewed_at_ms)
    VALUES(?,?,?,?,'learner',?,?,'Please review',?)""",
    (uuid('e',n),uuid('f',n),sid,self.assignment,actor,decision,at))
 def test_valid_submit_retry_accept_immutable(self):
  first=self.submit(1)
  with self.assertRaisesRegex(sqlite3.IntegrityError,'SUBMISSION_NOT_RETRYABLE'):
   self.submit(2,attempt=2)
  self.review(1,first)
  second=self.submit(3,attempt=2)
  self.review(3,second,'accepted')
  with self.assertRaisesRegex(sqlite3.IntegrityError,'SUBMISSION_NOT_RETRYABLE'):
   self.submit(4,attempt=3)
  self.assertEqual(self.db.execute('SELECT count(*) FROM assignment_submission_events').fetchone(),(2,))
  with self.assertRaisesRegex(sqlite3.IntegrityError,'SUBMISSION_IMMUTABLE'):
   self.db.execute("DELETE FROM assignment_submission_events")
  with self.assertRaisesRegex(sqlite3.IntegrityError,'REVIEW_IMMUTABLE'):
   self.db.execute("UPDATE assignment_review_events SET feedback='forged'")
 def test_owner_denials_and_attempt_cas(self):
  with self.assertRaisesRegex(sqlite3.IntegrityError,'SUBMISSION_OWNER_DENIED'):
   self.submit(1,actor='owner-b')
  with self.assertRaisesRegex(sqlite3.IntegrityError,'SUBMISSION_INVALID_ATTEMPT'):
   self.submit(1,attempt=2)
  first=self.submit(2)
  with self.assertRaises(sqlite3.IntegrityError):self.submit(2)
  self.review(1,first)
  with self.assertRaisesRegex(sqlite3.IntegrityError,'REVIEW_TEACHER_DENIED'):
   self.review(2,first,actor='foreign')
  with self.assertRaisesRegex(sqlite3.IntegrityError,'SUBMISSION_INVALID_ATTEMPT'):
   self.submit(3,attempt=4)
 def test_revoked_disabled_teacher_cannot_review(self):
  first=self.submit(1)
  self.db.execute("UPDATE teacher_assignments SET revoked_at_ms=250 WHERE id='assign'")
  with self.assertRaisesRegex(sqlite3.IntegrityError,'REVIEW_TEACHER_DENIED'):
   self.review(1,first,at=300)
  self.db.execute("UPDATE teacher_assignments SET revoked_at_ms=NULL WHERE id='assign'")
  self.db.execute("UPDATE teachers SET status='disabled' WHERE id='teacher'")
  with self.assertRaisesRegex(sqlite3.IntegrityError,'REVIEW_TEACHER_DENIED'):
   self.review(2,first,at=300)
if __name__=='__main__':unittest.main()
