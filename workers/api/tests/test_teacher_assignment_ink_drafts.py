"""#253: private teacher draft snapshots -> same-transaction canonical Quran ledger publish."""
import json
import sqlite3
import unittest
from test_learner_quran_ledger import CumulativeQuranLedgerD1, ED, PEN, NOTE, TASK, PUBLISH

PEN_MARK={'id':'sheikh-pen-001','kind':'pen','page':1,'surah':None,'ayah':None,
 'payload':json.loads(PEN)}
NOTE_MARK={'id':'sheikh-note-001','kind':'note','page':1,'surah':1,'ayah':2,
 'payload':json.loads(NOTE)}
DRAFT='7145a6fa-1d94-4994-91e7-5819692ba3b6'
COLUMNS="""(draft_id,revision,learner_id,teacher_subject,kind,edition_id,
 surah,from_ayah,to_ayah,due_at_ms,instructions,marks_json,at_ms)"""
PUBLISH_SQL="""INSERT INTO assignment_publish_events(operation_id,assignment_id,learner_id,
actor_auth_subject,kind,edition_id,surah,from_ayah,to_ayah,due_at_ms,instructions,published_at_ms)
VALUES(?,?,?,'teacher-a','memorization',?,1,1,2,5000,'Review these two verses',?)"""

class TeacherDraftD1(unittest.TestCase):
 def setUp(self):
  self.fixture=CumulativeQuranLedgerD1()
  self.fixture.setUp()
  self.db=self.fixture.db

 def tearDown(self):self.db.close()

 def draft(self,rev=1,marks=None,learner='one',actor='teacher-a',draft=DRAFT,
  from_ayah=1,to_ayah=2,at=2000):
  marks=marks if marks is not None else [PEN_MARK,NOTE_MARK]
  self.db.execute('INSERT INTO teacher_assignment_draft_versions '+COLUMNS+
    ' VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',
    (draft,rev,learner,actor,'memorization',ED,1,from_ayah,to_ayah,5000,
     'Review these two verses',json.dumps(marks),at))

 def publication(self,at=2500,operation=PUBLISH,task=TASK,draft=DRAFT,revision=1,
  learner='one',actor='teacher-a'):
  self.db.execute("""INSERT INTO teacher_assignment_draft_publications
   (draft_id,operation_id,revision,learner_id,teacher_subject,at_ms)
   VALUES(?,?,?,?,?,?)""",(draft,operation,revision,learner,actor,at))
  self.db.execute(PUBLISH_SQL,(operation,task,learner,ED,at))

 def test_private_before_publish_atomic_after_publish(self):
  self.draft()
  self.assertEqual(self.db.execute(
   "SELECT count(*) FROM learner_quran_events").fetchone(),(0,))
  self.assertEqual(self.db.execute(
   "SELECT count(*) FROM learner_quran_current").fetchone(),(0,))
  with self.db:self.publication()
  self.assertEqual(self.db.execute(
   "SELECT count(*) FROM learner_assignments").fetchone(),(1,))
  got=self.db.execute("""SELECT item_id,author_role,origin_type,origin_id,kind,
   audience,visible FROM learner_quran_current ORDER BY kind""").fetchall()
  self.assertEqual(len(got),2)
  self.assertEqual({v[4] for v in got},{'pen','note'})
  for row in got:
   self.assertEqual(row[1:4],('teacher','assignment',TASK))
   self.assertEqual(row[5:],('shared',1))
  self.assertEqual(self.db.execute('PRAGMA foreign_key_check').fetchall(),[])

 def test_mismatch_rolls_back_binding_and_task_without_marks(self):
  self.draft()
  with self.assertRaisesRegex(sqlite3.IntegrityError,'DRAFT_PUBLICATION_MISMATCH'):
   with self.db:
    self.db.execute("""INSERT INTO teacher_assignment_draft_publications
      (draft_id,operation_id,revision,learner_id,teacher_subject,at_ms)
      VALUES(?,?,?,?,?,?)""",(DRAFT,PUBLISH,1,'one','teacher-a',2500))
    self.db.execute(PUBLISH_SQL.replace("'Review these two verses'","'Wrong instructions'"),
      (PUBLISH,TASK,'one',ED,2500))
  for table in ('teacher_assignment_draft_publications','learner_assignments',
                'learner_quran_current','learner_quran_events','assignment_publish_events'):
   self.assertEqual(self.db.execute('SELECT count(*) FROM '+table).fetchone(),(0,),table)

 def test_revoked_other_teacher_and_sibling_are_denied(self):
  for n,learner,actor in [(1,'sibling','teacher-a'),(2,'one','teacher-b')]:
   with self.assertRaisesRegex(sqlite3.IntegrityError,'DRAFT_ACCESS_DENIED'):
    self.draft(draft=str(n)+'145a6fa-1d94-4994-91e7-5819692ba3b6',
     learner=learner,actor=actor)
  self.draft()
  self.db.execute("UPDATE teacher_assignments SET revoked_at_ms=2400 WHERE id='grant'")
  with self.assertRaisesRegex(sqlite3.IntegrityError,'DRAFT_ACCESS_DENIED'):
   with self.db:self.publication(at=2500)
  self.assertEqual(self.db.execute('SELECT count(*) FROM learner_quran_events').fetchone(),(0,))

 def test_versioning_publishes_latest_only_and_freezes_draft(self):
  self.draft()
  self.draft(rev=2,marks=[NOTE_MARK],at=2100)
  # Keep accepted revisions outside the negative-case transaction: sqlite3
  # rolls back all uncommitted setup writes if that expected insert aborts.
  self.db.commit()
  with self.assertRaisesRegex(sqlite3.IntegrityError,'DRAFT_REVISION_CONFLICT'):
   self.draft(rev=4,marks=[],at=2200)
  with self.assertRaisesRegex(sqlite3.IntegrityError,'DRAFT_REVISION_CONFLICT'):
   with self.db:self.publication(revision=1)
  with self.db:self.publication(revision=2)
  self.assertEqual(self.db.execute('SELECT count(*) FROM learner_quran_current').fetchone(),(1,))
  with self.assertRaisesRegex(sqlite3.IntegrityError,'DRAFT_ALREADY_PUBLISHED'):
   self.draft(rev=3,at=2700)
  with self.assertRaisesRegex(sqlite3.IntegrityError,'DRAFT_IMMUTABLE'):
   self.db.execute("UPDATE teacher_assignment_draft_versions SET marks_json='[]'")
  with self.assertRaisesRegex(sqlite3.IntegrityError,'DRAFT_PUBLICATION_IMMUTABLE'):
   self.db.execute("DELETE FROM teacher_assignment_draft_publications")

 def test_marks_outside_assigned_range_and_duplicate_ids_fail_before_publish(self):
  for n,marks in enumerate([
   [{**NOTE_MARK,'ayah':5}],
   [{**PEN_MARK,'page':604}],
   [PEN_MARK,PEN_MARK],
   [{**PEN_MARK,'payload':{**PEN_MARK['payload'],'points':[
     {'x':-1,'y':8},{'x':9,'y':12}]}}],
  ],1):
   with self.subTest(n=n),self.assertRaisesRegex(sqlite3.IntegrityError,'DRAFT_MARKS_INVALID'):
    self.draft(marks=marks,draft=str(n)+'145a6fa-1d94-4994-91e7-5819692ba3b6')
  self.assertEqual(self.db.execute('SELECT count(*) FROM teacher_assignment_draft_versions').fetchone(),(0,))

 def test_hex_color_guard_rejects_bad_length_prefix_and_nonhex(self):
  # D1's SQLite GLOB complexity cap requires a short negated-character test.
  # The migration must still enforce the exact #RRGGBB contract.
  for n,color in enumerate(('#fff','#0000000','0000000','#gg0000','#00000!'),1):
   mark={**PEN_MARK,'payload':{**PEN_MARK['payload'],'color':color}}
   with self.subTest(color=color),self.assertRaisesRegex(
     sqlite3.IntegrityError,'DRAFT_MARKS_INVALID'):
    self.draft(marks=[mark],
     draft=str(n)+'145a6fa-1d94-4994-91e7-5819692ba3b6')
  self.assertEqual(self.db.execute(
   'SELECT count(*) FROM teacher_assignment_draft_versions').fetchone(),(0,))


 def test_missing_required_json_fields_fail_closed(self):
  # SQLite three-valued logic turns a missing json_type into NULL, not TRUE.
  # DB triggers must reject omitted fields even if the HTTP validator does.
  without=lambda obj,key:{k:v for k,v in obj.items() if k!=key}
  cases=[
   ('id',without(PEN_MARK,'id')),
   ('color',{**PEN_MARK,'payload':without(PEN_MARK['payload'],'color')}),
   ('points',{**PEN_MARK,'payload':without(PEN_MARK['payload'],'points')}),
   ('width',{**PEN_MARK,'payload':without(PEN_MARK['payload'],'width')}),
   ('surah',without(PEN_MARK,'surah')),
   ('ayah',without(PEN_MARK,'ayah')),
   ('point-x',{**PEN_MARK,'payload':{**PEN_MARK['payload'],
    'points':[{'y':220},{'x':140,'y':235}]}}),
   ('point-y',{**PEN_MARK,'payload':{**PEN_MARK['payload'],
    'points':[{'x':120},{'x':140,'y':235}]}}),
   ('note-text',{**NOTE_MARK,'payload':without(NOTE_MARK['payload'],'text')}),
  ]
  for n,(field,mark) in enumerate(cases,1):
   with self.subTest(field=field),self.assertRaisesRegex(
     sqlite3.IntegrityError,'DRAFT_MARKS_INVALID'):
    self.draft(marks=[mark],
     draft=str(n)+'145a6fa-1d94-4994-91e7-5819692ba3b6')
  self.assertEqual(self.db.execute(
   'SELECT count(*) FROM teacher_assignment_draft_versions').fetchone(),(0,))

if __name__=='__main__':unittest.main()
