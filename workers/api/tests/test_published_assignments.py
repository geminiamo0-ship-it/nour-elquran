"""#173: immutable teacher Quran assignments with server-enforced scope, verses and due."""
import sqlite3
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]/'migrations'
def event(n,learner='l-a1',actor='teacher-a',edition='hafs-v1',
          from_ayah=1,to_ayah=2,at=1500,due=2500):
    return (f'00000000-0000-4000-8000-{n:012d}',
            f'10000000-0000-4000-8000-{n:012d}',learner,actor,
            'memorization',edition,1,from_ayah,to_ayah,due,'Memorize these verses',at)
class PublishedAssignmentsD1(unittest.TestCase):
 def setUp(self):
    self.db=sqlite3.connect(':memory:')
    self.db.execute('PRAGMA foreign_keys=ON')
    for name in ('0001_core.sql','0010_published_assignments.sql'):
        self.db.executescript((ROOT/name).read_text())
    self.db.executemany('INSERT INTO accounts(id,auth_subject,status,created_at_ms) VALUES(?,?,?,0)',
                        [('a','owner-a','active'),('b','owner-b','active')])
    self.db.executemany(
       "INSERT INTO learners(id,account_id,display_name,learner_type,status,created_at_ms) VALUES(?,?,?,'child','active',0)",
       [('l-a1','a','A1'),('l-a2','a','A2'),('l-b1','b','B1')])
    self.db.execute("INSERT INTO teachers(id,auth_subject,qualified,status) VALUES('t-a','teacher-a',1,'active')")
    self.db.execute("INSERT INTO teachers(id,auth_subject,qualified,status) VALUES('t-b','teacher-b',1,'active')")
    self.db.execute("INSERT INTO teacher_assignments(id,learner_id,teacher_id,starts_at_ms,ends_at_ms) "
                    "VALUES('a1','l-a1','t-a',1000,5000)")
    self.db.execute("INSERT INTO quran_editions(id,riwayah,page_count,manifest_sha256) "
                    "VALUES('hafs-v1','hafs',604,?)",('c'*64,))
    self.db.executemany("INSERT INTO quran_ayah_anchors(edition_id,surah,ayah,page,word_count) "
                        "VALUES('hafs-v1',1,?,1,7)",[(1,),(2,),(3,)])
 def tearDown(self):self.db.close()
 def put(self,params):
    self.db.execute("INSERT INTO assignment_publish_events(operation_id,assignment_id,learner_id,"
      "actor_auth_subject,kind,edition_id,surah,from_ayah,to_ayah,due_at_ms,instructions,published_at_ms)"
      " VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",params)
 def test_atomic_projection_replay_and_immutable(self):
    self.put(event(1))
    self.assertEqual(self.db.execute(
      "SELECT learner_id,edition_id,from_ayah,to_ayah,revision,status FROM learner_assignments"
      ).fetchone(),('l-a1','hafs-v1',1,2,1,'assigned'))
    with self.assertRaises(sqlite3.IntegrityError):self.put(event(1))
    self.assertEqual(self.db.execute('SELECT count(*) FROM learner_assignments').fetchone(),(1,))
    with self.assertRaisesRegex(sqlite3.IntegrityError,'IMMUTABLE'):
      self.db.execute("DELETE FROM assignment_publish_events")
    with self.assertRaisesRegex(sqlite3.IntegrityError,'IMMUTABLE'):
      self.db.execute("UPDATE learner_assignments SET instructions='forged'")
 def test_sibling_other_owner_and_unassigned_teacher_denied(self):
    for n,params in enumerate([{'learner':'l-a2'},{'learner':'l-b1'},
                                {'actor':'teacher-b'},{'actor':'owner-a'}],2):
      with self.assertRaisesRegex(sqlite3.IntegrityError,'ASSIGNMENT_ACCESS_DENIED'):
        self.put(event(n,**params))
    self.assertEqual(self.db.execute('SELECT count(*) FROM learner_assignments').fetchone(),(0,))
 def test_revoke_disable_archived_account_and_timing_fail_closed(self):
    for n,sql in enumerate([
      "UPDATE teacher_assignments SET revoked_at_ms=1000 WHERE id='a1'",
      "UPDATE teachers SET qualified=0 WHERE id='t-a'",
      "UPDATE teachers SET status='disabled' WHERE id='t-a'",
      "UPDATE accounts SET status='disabled' WHERE id='a'",
      "UPDATE learners SET status='archived' WHERE id='l-a1'",
    ],10):
      self.db.execute('SAVEPOINT temporary')
      self.db.execute(sql)
      with self.assertRaisesRegex(sqlite3.IntegrityError,'ASSIGNMENT_ACCESS_DENIED'):
        self.put(event(n))
      self.db.execute('ROLLBACK TO temporary')
      self.db.execute('RELEASE temporary')
    for n,at in enumerate((999,5000),20):
      with self.assertRaisesRegex(sqlite3.IntegrityError,'ASSIGNMENT_ACCESS_DENIED'):
        self.put(event(n,at=at,due=at+1000))
 def test_real_verses_dates_and_limit_enforced(self):
    for n,params,code in [
      (31,{'from_ayah':2,'to_ayah':1},'CHECK constraint'),
      (32,{'to_ayah':5},'ASSIGNMENT_INVALID_RANGE'),
      (33,{'edition':'fake'},'ASSIGNMENT_INVALID_RANGE'),
      (34,{'due':1500},'ASSIGNMENT_BAD_DUE_DATE'),
      (35,{'due':1500+15552000001},'ASSIGNMENT_BAD_DUE_DATE'),
    ]:
      with self.assertRaisesRegex(sqlite3.IntegrityError,code):
        self.put(event(n,**params))
    self.assertEqual(self.db.execute('SELECT count(*) FROM learner_assignments').fetchone(),(0,))
if __name__=='__main__':unittest.main()
