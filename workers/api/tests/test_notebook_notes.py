"""#190: SQLite/Cloudflare D1 notebook owner-private notes with END audit."""
import sqlite3
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]/"migrations"
def uid(i):return f"00000000-0000-4000-8000-{i:012d}"
class NotebookNotesTest(unittest.TestCase):
 def setUp(self):
  self.db=sqlite3.connect(":memory:")
  self.db.execute("PRAGMA foreign_keys=ON")
  for name in ("0001_core.sql","0003_teacher_schedule.sql",
               "0004_classroom_lifecycle.sql","0014_notebook_private_notes.sql"):
   self.db.executescript((ROOT/name).read_text())
  self.db.execute("INSERT INTO accounts(id,auth_subject,created_at_ms) VALUES('a','owner-a',0)")
  self.db.execute("INSERT INTO accounts(id,auth_subject,created_at_ms) VALUES('b','owner-b',0)")
  self.db.execute("INSERT INTO learners(id,account_id,display_name,learner_type,created_at_ms) VALUES('l1','a','Synthetic 1','child',0)")
  self.db.execute("INSERT INTO learners(id,account_id,display_name,learner_type,created_at_ms) VALUES('l2','a','Synthetic 2','child',0)")
  self.db.execute("INSERT INTO learners(id,account_id,display_name,learner_type,created_at_ms) VALUES('l3','b','Synthetic 3','adult',0)")
  self.db.execute("INSERT INTO teachers(id,auth_subject,qualified) VALUES('t','teacher',1)")
  self.db.execute("INSERT INTO lessons(id,learner_id,actual_teacher_id,kind,status,starts_at_ms,ends_at_ms)"
    " VALUES('lesson','l1','t','standard','scheduled',1000,2401000)")
  self.db.execute("UPDATE lessons SET status='live' WHERE id='lesson'")
  self.db.execute("INSERT INTO lesson_lifecycle_events(id,lesson_id,teacher_id,action,at_ms,operation_id)"
    " VALUES('event-start','lesson','t','start',1200,'op-start')")
  self.db.execute("UPDATE lessons SET status='completed',ended_at_ms=3000 WHERE id='lesson'")
  self.db.execute("INSERT INTO lesson_lifecycle_events(id,lesson_id,teacher_id,action,at_ms,operation_id)"
    " VALUES('event-end','lesson','t','end',3000,'op-end')")
 def tearDown(self):self.db.close()
 def event(self,n,action="put",actor="owner-a",learner="l1",lesson="lesson",
           note=None,version=0,body="Synthetic private student note",at=3100):
  return self.db.execute("INSERT INTO notebook_note_events(operation_id,id,learner_id,"
   "lesson_id,actor_auth_subject,action,expected_version,body,at_ms) VALUES(?,?,?,?,?,?,?,?,?)",
   (uid(n),note or uid(100),learner,lesson,actor,action,version,body,at))
 def test_save_edit_hide_and_immutable_event_log(self):
  self.event(1)
  self.assertEqual(self.db.execute("SELECT body,version,visible FROM notebook_private_notes").fetchone(),
                   ("Synthetic private student note",1,1))
  with self.assertRaises(sqlite3.IntegrityError):self.event(1)
  with self.assertRaisesRegex(sqlite3.IntegrityError,"NOTEBOOK_VERSION_CONFLICT"):
   self.event(2,version=0)
  self.event(3,version=1,body="Edited note",at=3400)
  self.event(4,action="hide",version=2,body="",at=3500)
  self.assertEqual(self.db.execute("SELECT body,version,visible FROM notebook_private_notes").fetchone(),
                   ("Edited note",3,0))
  self.assertEqual(self.db.execute("SELECT COUNT(*) FROM notebook_note_events").fetchone(),(3,))
  with self.assertRaisesRegex(sqlite3.IntegrityError,"NOTEBOOK_EVENT_IMMUTABLE"):
   self.db.execute("DELETE FROM notebook_note_events")
  with self.assertRaisesRegex(sqlite3.IntegrityError,"NOTEBOOK_EVENT_IMMUTABLE"):
   self.db.execute("UPDATE notebook_note_events SET body='forged'")
 def test_reject_foreign_actor_or_sibling_and_uncompleted_lesson(self):
  for i,kw in enumerate(({"actor":"owner-b"},{"actor":"teacher"},
      {"learner":"l2"},{"learner":"l3"}),10):
   with self.assertRaisesRegex(sqlite3.IntegrityError,"NOTEBOOK_ACCESS_DENIED"):
    self.event(i,**kw)
  self.db.execute("INSERT INTO lessons(id,learner_id,actual_teacher_id,kind,status,starts_at_ms,ends_at_ms)"
    " VALUES('scheduled','l1','t','standard','scheduled',3000000,5400000)")
  with self.assertRaisesRegex(sqlite3.IntegrityError,"NOTEBOOK_ACCESS_DENIED"):
   self.event(20,lesson="scheduled")
  self.db.execute("UPDATE accounts SET status='disabled' WHERE id='a'")
  with self.assertRaisesRegex(sqlite3.IntegrityError,"NOTEBOOK_ACCESS_DENIED"):
   self.event(21)
 def test_note_identity_scope_and_body_rules(self):
  self.event(1)
  with self.assertRaisesRegex(sqlite3.IntegrityError,"NOTEBOOK_ACCESS_DENIED"):
   self.event(2,version=1,learner="l2")
  with self.assertRaisesRegex(sqlite3.IntegrityError,"NOTEBOOK_BAD_BODY"):
   self.event(3,version=1,body=" ")
  with self.assertRaisesRegex(sqlite3.IntegrityError,"NOTEBOOK_BAD_BODY"):
   self.event(4,action="hide",version=1,body="not empty")
  with self.assertRaisesRegex(sqlite3.IntegrityError,"NOTEBOOK_VERSION_CONFLICT"):
   self.event(5,action="hide",version=0,body="")
if __name__=="__main__":unittest.main()
