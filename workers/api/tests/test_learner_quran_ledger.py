"""#251: real SQLite/D1 triggers for cumulative per-learner Quran academic marks."""
from pathlib import Path
import json
import sqlite3
import unittest

ROOT=Path(__file__).resolve().parents[1]/'migrations'
ED='hafs-kfqc:v1.1.1'
INSERT='''INSERT INTO learner_quran_events(
 id,learner_id,operation_id,item_id,actor_subject,actor_role,
 origin_type,origin_id,audience,action,edition_id,page,surah,ayah,word_index,
 kind,expected_revision,payload_json,at_ms)
 VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'''
PEN=json.dumps({'points':[{'x':12,'y':45},{'x':90,'y':150}],'color':'#abc123','width':3})
NOTE=json.dumps({'color':'#abc123','text':'Check this verse'})
TASK='10000000-0000-4000-8000-000000000001'
PUBLISH='00000000-0000-4000-8000-000000000001'

class CumulativeQuranLedgerD1(unittest.TestCase):
 def setUp(self):
  self.db=sqlite3.connect(':memory:')
  self.addCleanup(self.db.close)
  self.db.execute('PRAGMA foreign_keys=ON')
  for p in sorted(ROOT.glob('*.sql')):
   self.db.executescript(p.read_text(encoding='utf-8'))
  for name in ('owner-a','owner-b','teacher-a','teacher-b'):
   self.db.execute("INSERT INTO auth_users(id,name,email,created_at,updated_at) VALUES(?,?,?,?,?)",
                   (name,name,name+'@synthetic.invalid',0,0))
  for name in ('a','b'):
   self.db.execute("INSERT INTO accounts(id,auth_subject,created_at_ms) VALUES(?,?,0)",('account-'+name,'owner-'+name))
  for name,owner in [('one','a'),('sibling','a'),('foreign','b')]:
   self.db.execute("INSERT INTO learners(id,account_id,display_name,learner_type,created_at_ms) VALUES(?,?,?,'child',0)",
                   (name,'account-'+owner,name))
  for name in ('a','b'):
   self.db.execute("INSERT INTO teachers(id,auth_subject,qualified,status) VALUES(?,?,1,'active')",
                   ('teacher-id-'+name,'teacher-'+name))
  self.db.execute("INSERT INTO teacher_assignments(id,learner_id,teacher_id,starts_at_ms,ends_at_ms) VALUES('grant','one','teacher-id-a',0,100000)")
  self.db.execute("INSERT INTO quran_editions(id,riwayah,page_count,manifest_sha256) VALUES(?,'hafs',604,?)",(ED,'0'*64))
  for ayah in (1,2,3,4,5):
   self.db.execute("INSERT INTO quran_ayah_anchors(edition_id,surah,ayah,page,word_count) VALUES(?,?,?,1,8)",(ED,1,ayah))
  self.db.execute("INSERT INTO lessons(id,learner_id,actual_teacher_id,kind,status,starts_at_ms,ends_at_ms) VALUES('l1','one','teacher-id-a','trial','scheduled',1000,2401000)")
  self.db.execute("UPDATE lessons SET status='live' WHERE id='l1'")
  self.counter=0

 def event(self,**overrides):
  self.counter+=1
  p=dict(id='e'+str(self.counter).zfill(8),learner_id='one',operation_id='op-'+str(self.counter).zfill(8),
         item_id='item-0001',actor_subject='owner-a',actor_role='learner',
         origin_type='self_study',origin_id=None,audience='private',action='put',
         edition_id=ED,page=1,surah=None,ayah=None,word_index=None,
         kind='pen',expected_revision=0,payload_json=PEN,at_ms=2000+self.counter)
  p.update(overrides)
  self.db.execute(INSERT,tuple(p.values()))
  return p

 def current(self,item='item-0001',learner='one'):
  return self.db.execute("SELECT visible,revision,author_subject,author_role,audience,origin_type,origin_id FROM learner_quran_current WHERE learner_id=? AND item_id=?",(learner,item)).fetchone()

 def count(self):
  return self.db.execute('SELECT COUNT(*) FROM learner_quran_events').fetchone()[0]

 def publish_assignment(self):
  self.db.execute("""INSERT INTO assignment_publish_events(operation_id,assignment_id,learner_id,actor_auth_subject,kind,edition_id,surah,from_ayah,to_ayah,due_at_ms,instructions,published_at_ms)
    VALUES(?,?,?,'teacher-a','memorization',?,1,1,2,5000,'Synthetic Al-Mulk memory',2000)""",(PUBLISH,TASK,'one',ED))

 def test_schema_append_only_and_versioned_private_marks(self):
  self.event()
  self.assertEqual(self.current()[:2],(1,1))
  self.event(item_id='item-0001',expected_revision=1,kind='pen')
  self.assertEqual(self.current()[:2],(1,2))
  self.event(item_id='item-0001',expected_revision=2,action='hide',payload_json='{}')
  self.assertEqual(self.current()[:2],(0,3))
  self.assertEqual(self.count(),3)
  with self.assertRaisesRegex(sqlite3.IntegrityError,'IMMUTABLE'):
   self.db.execute("DELETE FROM learner_quran_events")
  with self.assertRaisesRegex(sqlite3.IntegrityError,'IMMUTABLE'):
   self.db.execute("UPDATE learner_quran_events SET at_ms=0")
  with self.assertRaisesRegex(sqlite3.IntegrityError,'IMMUTABLE'):
   self.db.execute("DELETE FROM learner_quran_current")

 def test_owner_sibling_foreign_disabled_denied(self):
  self.event()
  self.event(item_id='sibling-01',learner_id='sibling')
  self.event(item_id='foreign-01',learner_id='foreign',actor_subject='owner-b')
  with self.assertRaisesRegex(sqlite3.IntegrityError,'ACTOR_DENIED'):
   self.event(item_id='forged-own',learner_id='foreign',actor_subject='owner-a')
  self.assertIsNone(self.current('item-0001','sibling'))
  self.assertEqual(self.count(),3)
  self.db.execute("UPDATE learners SET status='archived' WHERE id='one'")
  with self.assertRaisesRegex(sqlite3.IntegrityError,'ACTOR_DENIED'):
   self.event(item_id='new-after-archive')
  self.assertEqual(self.count(),3)

 def test_teacher_live_and_student_shared_marks_and_moderation(self):
  self.event(item_id='teacher-01',actor_subject='teacher-a',actor_role='teacher',
             origin_type='lesson',origin_id='l1',audience='shared')
  self.event(item_id='learner-01',origin_type='lesson',origin_id='l1',audience='shared')
  self.assertEqual(self.current('teacher-01')[2:5],('teacher-a','teacher','shared'))
  # Teacher moderates a learner's shared mark from the same live lesson.
  self.event(item_id='learner-01',actor_subject='teacher-a',actor_role='teacher',
             origin_type='lesson',origin_id='l1',audience='shared',
             action='hide',payload_json='{}',expected_revision=1)
  self.assertEqual(self.current('learner-01')[:2],(0,2))
  with self.assertRaisesRegex(sqlite3.IntegrityError,'REVISION_CONFLICT'):
   self.event(item_id='teacher-01',origin_type='lesson',origin_id='l1',audience='shared',
              action='hide',payload_json='{}',expected_revision=1)
  with self.assertRaisesRegex(sqlite3.IntegrityError,'LESSON_DENIED'):
   self.event(item_id='wrong-teacher',actor_subject='teacher-b',actor_role='teacher',
              origin_type='lesson',origin_id='l1',audience='shared')
  self.db.execute("UPDATE lessons SET status='completed',ended_at_ms=5000 WHERE id='l1'")
  with self.assertRaisesRegex(sqlite3.IntegrityError,'LESSON_DENIED'):
   self.event(item_id='after-end',actor_subject='teacher-a',actor_role='teacher',
              origin_type='lesson',origin_id='l1',audience='shared')

 def test_assignment_marks_only_after_publish_and_within_range(self):
  with self.assertRaisesRegex(sqlite3.IntegrityError,'ASSIGNMENT_DENIED'):
   self.event(item_id='draftmark',actor_subject='teacher-a',actor_role='teacher',
              origin_type='assignment',origin_id=TASK,audience='shared',
              surah=1,ayah=1,kind='note',payload_json=NOTE)
  self.publish_assignment()
  self.event(item_id='published',actor_subject='teacher-a',actor_role='teacher',
             origin_type='assignment',origin_id=TASK,audience='shared',
             surah=1,ayah=1,kind='note',payload_json=NOTE)
  with self.assertRaisesRegex(sqlite3.IntegrityError,'ASSIGNMENT_DENIED'):
   self.event(item_id='out-of-range',actor_subject='teacher-a',actor_role='teacher',
              origin_type='assignment',origin_id=TASK,audience='shared',
              surah=1,ayah=5,kind='note',payload_json=NOTE)
  self.db.execute("UPDATE teacher_assignments SET revoked_at_ms=4000 WHERE id='grant'")
  with self.assertRaisesRegex(sqlite3.IntegrityError,'ASSIGNMENT_DENIED'):
   self.event(item_id='after-revoke',actor_subject='teacher-a',actor_role='teacher',
              origin_type='assignment',origin_id=TASK,audience='shared',at_ms=4000,
              surah=1,ayah=2,kind='highlight',payload_json=json.dumps({'color':'#abc123'}))
  self.assertEqual(self.count(),1)

 def test_private_notes_do_not_become_teacher_marks_and_visibility_cannot_change(self):
  self.event(item_id='private-01',surah=1,ayah=1,kind='note',payload_json=NOTE)
  with self.assertRaises(sqlite3.IntegrityError):
   self.event(item_id='private-01',expected_revision=1,origin_type='lesson',
              origin_id='l1',audience='shared',surah=1,ayah=1,kind='note',payload_json=NOTE)
  with self.assertRaises(sqlite3.IntegrityError):
   self.event(item_id='private-01',expected_revision=1,actor_subject='teacher-a',
              actor_role='teacher',origin_type='lesson',origin_id='l1',audience='shared',
              surah=1,ayah=1,kind='note',payload_json=NOTE)
  self.assertEqual(self.current('private-01')[4],'private')

 def test_wrong_anchors_malformed_payload_and_operation_replay(self):
  self.event()
  for override in [
   {'item_id':'unknown-01','surah':1,'ayah':10,'kind':'note','payload_json':NOTE},
   {'item_id':'wrong-page','surah':1,'ayah':1,'page':2,'kind':'note','payload_json':NOTE},
   {'item_id':'wrong-word','surah':1,'ayah':1,'word_index':9,'kind':'note','payload_json':NOTE},
   {'item_id':'bad-color','payload_json':json.dumps({'color':'red','width':3,'points':[{'x':1,'y':2},{'x':3,'y':4}]})},
   {'item_id':'missing-points','payload_json':json.dumps({'color':'#000000','width':3})},
   {'item_id':'bad-point','payload_json':json.dumps({'color':'#000000','width':3,'points':[{'x':-1,'y':2},{'x':3,'y':4}]})},
   {'item_id':'bad-text','surah':1,'ayah':1,'kind':'note','payload_json':json.dumps({'color':'#abc123'})},
   {'item_id':'bad-private-role','actor_subject':'teacher-a','actor_role':'teacher'},
   {'item_id':'bad-edition','edition_id':'unverified'}
  ]:
   with self.subTest(override=override),self.assertRaises(sqlite3.IntegrityError):
    self.event(**override)
  self.assertEqual(self.count(),1)
  with self.assertRaises(sqlite3.IntegrityError):
   self.event(item_id='another-id',operation_id='op-00000001')
  self.assertEqual(self.count(),1)
  with self.assertRaisesRegex(sqlite3.IntegrityError,'REVISION_CONFLICT'):
   self.event(item_id='item-0001',expected_revision=0)

 def test_does_not_mutate_preexisting_private_store_or_create_faux_backfill(self):
  self.db.execute("""INSERT INTO private_mushaf_events(id,learner_id,actor_auth_subject,operation_id,
    action,item_id,kind,edition_id,page,expected_version,payload_json,at_ms)
    VALUES('old-e','one','owner-a','old-operation','put','old-mark','pen',?,1,0,?,1000)""",(ED,PEN))
  self.assertEqual(self.db.execute("SELECT count(*) FROM private_mushaf_items").fetchone(),(1,))
  self.assertEqual(self.db.execute("SELECT count(*) FROM learner_quran_current").fetchone(),(0,))
  self.assertEqual(self.db.execute("SELECT count(*) FROM private_mushaf_events").fetchone(),(1,))
  self.assertEqual(self.db.execute("PRAGMA foreign_key_check").fetchall(),[])

if __name__=='__main__':
 unittest.main()
