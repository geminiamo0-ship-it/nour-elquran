"""Phase 07A: completed-lesson-only, immutable D1 draft and publication security."""
import sqlite3
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]/'migrations'
def uid(n):return f'00000000-0000-4000-8000-{n:012d}'

class ReportJournal(unittest.TestCase):
 def setUp(self):
  self.db=sqlite3.connect(':memory:')
  self.db.execute('PRAGMA foreign_keys=ON')
  for file in ('0001_core.sql','0003_teacher_schedule.sql',
               '0004_classroom_lifecycle.sql','0013_lesson_reports.sql'):
   self.db.executescript((ROOT/file).read_text())
  self.db.execute("INSERT INTO accounts(id,auth_subject,created_at_ms) VALUES('home','owner',0)")
  self.db.execute("INSERT INTO accounts(id,auth_subject,created_at_ms) VALUES('foreign','other-owner',0)")
  self.db.execute("INSERT INTO learners(id,account_id,display_name,learner_type,created_at_ms) VALUES('a','home','Synthetic A','child',0)")
  self.db.execute("INSERT INTO learners(id,account_id,display_name,learner_type,created_at_ms) VALUES('b','foreign','Synthetic B','adult',0)")
  self.db.execute("INSERT INTO teachers(id,auth_subject,qualified) VALUES('t','sheikh',1)")
  self.db.execute("INSERT INTO teachers(id,auth_subject,qualified) VALUES('other','other-teacher',1)")
  self.db.execute("INSERT INTO lessons(id,learner_id,actual_teacher_id,kind,status,starts_at_ms,ends_at_ms)"
                  " VALUES('done','a','t','standard','scheduled',1000,2401000)")
  self.db.execute("UPDATE lessons SET status='live' WHERE id='done'")
  self.db.execute("INSERT INTO lesson_lifecycle_events(id,lesson_id,teacher_id,action,at_ms,operation_id)"
                  " VALUES('start','done','t','start',1200,'op-start')")
  self.db.execute("UPDATE lessons SET status='completed',ended_at_ms=3000 WHERE id='done'")
  self.db.execute("INSERT INTO lesson_lifecycle_events(id,lesson_id,teacher_id,action,at_ms,operation_id)"
                  " VALUES('end','done','t','end',3000,'op-end')")
 def tearDown(self):self.db.close()
 def event(self,n,kind='save',expected=0,actor='sheikh',scope='الفاتحة',at=3100,
           hifz=None,tajweed=10,recitation=0):
  return self.db.execute(
   'INSERT INTO lesson_report_events (operation_id,lesson_id,learner_id,actor_auth_subject,'
   'kind,expected_revision,scope,strengths,corrections,next_plan,memorization,recitation,tajweed,at_ms)'
   ' VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
   (uid(n),'done','a',actor,kind,expected,scope,'قوة','تصحيح','مراجعة',
    hifz,recitation,tajweed,at))
 def published(self):
  return self.db.execute(
   'SELECT revision,scope,memorization,recitation,tajweed FROM lesson_report_publications'
   ' ORDER BY revision').fetchall()
 def test_draft_hidden_until_publish_and_old_snapshot_stays_during_new_draft(self):
  self.event(1)
  self.assertEqual(self.published(),[])
  self.assertEqual(self.db.execute('SELECT revision,status FROM lesson_report_state').fetchone(),(1,'draft'))
  with self.assertRaisesRegex(sqlite3.IntegrityError,'REPORT_REVISION_CONFLICT'):
   self.event(2,expected=0)
  self.event(3,kind='publish',expected=1,at=3200)
  self.assertEqual(self.published(),[(1,'الفاتحة',None,0,10)])
  self.event(4,expected=1,scope='البقرة',at=3300,hifz=8)
  self.assertEqual(self.published(),[(1,'الفاتحة',None,0,10)])
  self.assertEqual(self.db.execute('SELECT status,latest_published_revision FROM lesson_report_state').fetchone(),('draft',1))
  self.event(5,kind='publish',expected=2,scope='البقرة',hifz=8,at=3400)
  self.assertEqual(self.published(),[(1,'الفاتحة',None,0,10),(2,'البقرة',8,0,10)])
  self.assertEqual(self.db.execute('SELECT latest_published_revision FROM lesson_report_state').fetchone(),(2,))
  with self.assertRaisesRegex(sqlite3.IntegrityError,'REPORT_PUBLICATION_IMMUTABLE'):
   self.db.execute("UPDATE lesson_report_publications SET scope='forged'")
  with self.assertRaisesRegex(sqlite3.IntegrityError,'REPORT_AUDIT_IMMUTABLE'):
   self.db.execute("DELETE FROM lesson_report_events")
 def test_no_fake_completion_and_no_unrelated_teacher(self):
  with self.assertRaisesRegex(sqlite3.IntegrityError,'REPORT_ACCESS_DENIED'):
   self.event(1,actor='other-teacher')
  self.db.execute("INSERT INTO lessons(id,learner_id,actual_teacher_id,kind,status,starts_at_ms,ends_at_ms)"
                  " VALUES('pending','a','t','standard','scheduled',3000000,5400000)")
  with self.assertRaisesRegex(sqlite3.IntegrityError,'REPORT_ACCESS_DENIED'):
   self.db.execute(
    'INSERT INTO lesson_report_events(operation_id,lesson_id,learner_id,actor_auth_subject,kind,'
    'expected_revision,scope,strengths,corrections,next_plan,at_ms)'
    " VALUES(?,'pending','a','sheikh','save',0,'','','','',4000000)",(uid(6),))
  self.db.execute("UPDATE teachers SET qualified=0 WHERE id='t'")
  with self.assertRaisesRegex(sqlite3.IntegrityError,'REPORT_ACCESS_DENIED'):
   self.event(7)
  self.assertEqual(self.published(),[])
 def test_publish_cannot_overwrite_draft_or_invent_grade(self):
  with self.assertRaisesRegex(sqlite3.IntegrityError,'REPORT_NOT_READY_TO_PUBLISH'):
   self.event(1,kind='publish')
  self.event(2)
  with self.assertRaisesRegex(sqlite3.IntegrityError,'REPORT_NOT_READY_TO_PUBLISH'):
   self.event(3,kind='publish',expected=1,scope='other',at=3200)
  self.event(4,kind='publish',expected=1,at=3300)
  with self.assertRaisesRegex(sqlite3.IntegrityError,'REPORT_REVISION_CONFLICT'):
   self.event(5,kind='save',expected=0,at=3500)
  with self.assertRaises(sqlite3.IntegrityError):
   self.event(6,kind='save',expected=1,hifz=11,at=3700)
 def test_substitute_lesson_only_and_24h_limit(self):
  self.db.execute("INSERT INTO lesson_access_grants("
                  "id,lesson_id,learner_id,teacher_id,kind,accepted_at_ms,consent_deadline_ms,"
                  "starts_at_ms,ends_at_ms) VALUES('grant','done','a','t','substitute',1100,1300,1000,2401000)")
  self.event(1)
  self.event(2,kind='publish',expected=1,at=3200)
  with self.assertRaisesRegex(sqlite3.IntegrityError,'REPORT_SUBSTITUTE_DENIED'):
   self.event(3,expected=1,at=3200+86400001)
  self.event(4,expected=1,at=3200+86399999)
  self.db.execute("UPDATE lesson_access_grants SET revoked_at_ms=90000000 WHERE id='grant'")
  with self.assertRaisesRegex(sqlite3.IntegrityError,'REPORT_SUBSTITUTE_DENIED'):
   self.event(5,expected=2,at=3500)
if __name__=='__main__':unittest.main()
