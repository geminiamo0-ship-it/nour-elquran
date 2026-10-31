"""#286: forward-only D1 0023 upgrade must preserve already-stored drafts.

The native Wrangler smoke proves Cloudflare's post-migration GLOB behavior.
This SQLite test separately protects the production-shaped migration path:
existing 0017/0018/0022 schema and rows -> 0023 -> new marked revision.
All identities are synthetic and the database is in-memory.
"""
import json
import sqlite3
import unittest

from test_learner_quran_ledger import ROOT, ED


class InkColorForwardUpgrade(unittest.TestCase):
 def test_existing_unpublished_draft_survives_0023_and_can_publish_marked_revision(self):
  db=sqlite3.connect(':memory:')
  self.addCleanup(db.close)
  db.execute('PRAGMA foreign_keys=ON')
  upgrade=ROOT/'0023_quran_ink_color_d1_compat.sql'
  self.assertTrue(upgrade.is_file())
  for migration in sorted(ROOT.glob('*.sql')):
   if migration.name >= upgrade.name:
    break
   db.executescript(migration.read_text(encoding='utf-8'))

  db.executescript("""
   INSERT INTO auth_users(id,name,email,created_at,updated_at)
    VALUES('upgrade-owner','Synthetic Owner','upgrade-owner@synthetic.invalid',0,0),
          ('upgrade-teacher','Synthetic Teacher','upgrade-teacher@synthetic.invalid',0,0);
   INSERT INTO accounts(id,auth_subject,created_at_ms)
    VALUES('upgrade-account','upgrade-owner',0);
   INSERT INTO learners(id,account_id,display_name,learner_type,created_at_ms)
    VALUES('upgrade-learner','upgrade-account','Synthetic Learner','child',0),
          ('upgrade-sibling','upgrade-account','Synthetic Sibling','child',0);
   INSERT INTO teachers(id,auth_subject,qualified,status)
    VALUES('upgrade-teacher-id','upgrade-teacher',1,'active');
   INSERT INTO teacher_assignments(id,learner_id,teacher_id,starts_at_ms,ends_at_ms)
    VALUES('upgrade-grant','upgrade-learner','upgrade-teacher-id',0,100000);
   INSERT INTO quran_editions(id,riwayah,page_count,manifest_sha256)
    VALUES('hafs-kfqc:v1.1.1','hafs',604,
           '0000000000000000000000000000000000000000000000000000000000000000');
   INSERT INTO quran_ayah_anchors(edition_id,surah,ayah,page,word_count)
    VALUES('hafs-kfqc:v1.1.1',1,1,1,8),
          ('hafs-kfqc:v1.1.1',1,2,1,8);
  """)
  draft='7145a6fa-1d94-4994-91e7-5819692ba3b6'
  db.execute("""INSERT INTO teacher_assignment_draft_versions(
    draft_id,revision,learner_id,teacher_subject,kind,edition_id,surah,
    from_ayah,to_ayah,due_at_ms,instructions,marks_json,at_ms)
    VALUES(?,1,'upgrade-learner','upgrade-teacher','revision',?,1,
           1,2,5000,'Synthetic review','[]',2000)""",(draft,ED))
  db.commit()
  before=db.execute("""SELECT revision,marks_json,instructions
    FROM teacher_assignment_draft_versions WHERE draft_id=?""",(draft,)).fetchall()
  self.assertEqual(before,[(1,'[]','Synthetic review')])
  old_guard=db.execute("""SELECT sql FROM sqlite_master
    WHERE type='trigger' AND name='teacher_assignment_draft_guard'""").fetchone()[0]

  # Apply the additive migration on the populated *old* schema, not a fresh DB.
  db.executescript(upgrade.read_text(encoding='utf-8'))
  new_guard=db.execute("""SELECT sql FROM sqlite_master
    WHERE type='trigger' AND name='teacher_assignment_draft_guard'""").fetchone()[0]
  self.assertNotEqual(old_guard,new_guard)
  self.assertEqual(db.execute("""SELECT revision,marks_json,instructions
    FROM teacher_assignment_draft_versions WHERE draft_id=?""",(draft,)).fetchall(),before)
  self.assertEqual(db.execute("""SELECT version FROM noor_schema_meta
    WHERE component='quran_ink_color_d1_compat'""").fetchone(),(1,))

  marks=[
   {'id':'upgrade-highlight-0001','kind':'highlight','page':1,'surah':1,'ayah':1,
    'payload':{'color':'#d0a94c'}},
   {'id':'upgrade-pen-0001','kind':'pen','page':1,'surah':None,'ayah':None,
    'payload':{'color':'#d0a94c','width':3,'points':[{'x':120,'y':220},{'x':140,'y':235}]}}
  ]
  db.execute("""INSERT INTO teacher_assignment_draft_versions(
    draft_id,revision,learner_id,teacher_subject,kind,edition_id,surah,
    from_ayah,to_ayah,due_at_ms,instructions,marks_json,at_ms)
    VALUES(?,2,'upgrade-learner','upgrade-teacher','revision',?,1,
           1,2,5000,'Synthetic review',?,2100)""",(draft,ED,json.dumps(marks)))
  operation='00000000-0000-4000-8000-000000000001'
  assignment='10000000-0000-4000-8000-000000000001'
  with db:
   db.execute("""INSERT INTO teacher_assignment_draft_publications(
    draft_id,operation_id,revision,learner_id,teacher_subject,at_ms)
    VALUES(?,?,2,'upgrade-learner','upgrade-teacher',2500)""",(draft,operation))
   db.execute("""INSERT INTO assignment_publish_events(
    operation_id,assignment_id,learner_id,actor_auth_subject,kind,edition_id,
    surah,from_ayah,to_ayah,due_at_ms,instructions,published_at_ms)
    VALUES(?,?,'upgrade-learner','upgrade-teacher','revision',?,
           1,1,2,5000,'Synthetic review',2500)""",(operation,assignment,ED))

  self.assertEqual(db.execute("""SELECT count(*) FROM learner_quran_current
    WHERE learner_id='upgrade-learner' AND origin_type='assignment'
    AND origin_id=? AND author_role='teacher' AND audience='shared' AND visible=1""",
    (assignment,)).fetchone(),(2,))
  self.assertEqual(db.execute("""SELECT count(*) FROM learner_quran_events
    WHERE learner_id='upgrade-sibling'""").fetchone(),(0,))
  self.assertEqual(db.execute('PRAGMA foreign_key_check').fetchall(),[])


if __name__=='__main__':
 unittest.main()
