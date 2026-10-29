"""Execute real D1 private Quran migrations and check atomic events and isolation."""
import sqlite3
import unittest
from pathlib import Path
from uuid import uuid4

ROOT=Path(__file__).resolve().parents[1]
ED="hafs-kfqc:v1.1.1"
SQL=("INSERT INTO private_mushaf_events(id,learner_id,actor_auth_subject,operation_id,"
"action,item_id,kind,edition_id,page,expected_version,payload_json,at_ms)"
" VALUES(?,?,?,?,?,?,?,?,?,?,?,?)")
PEN='{"color":"#f6cd46","points":[{"x":1,"y":2},{"x":3,"y":4}],"width":3}'
NOTE='{"target":{"surah":1,"ayah":1,"wordIndex":null},"text":"ملاحظة خاصة","color":"#f6cd46"}'

class PrivateMushafTests(unittest.TestCase):
 def setUp(self):
  self.db=sqlite3.connect(":memory:")
  self.addCleanup(self.db.close)
  self.db.execute("PRAGMA foreign_keys=ON")
  for p in sorted((ROOT/"migrations").glob("*.sql")):
   self.db.executescript(p.read_text())
  for owner in ("a","b"):
   self.db.execute("INSERT INTO auth_users(id,name,email,created_at,updated_at) VALUES(?,?,?,?,?)",
                   ("user-"+owner,owner,owner+"@noor.invalid",0,0))
   self.db.execute("INSERT INTO accounts(id,auth_subject,created_at_ms) VALUES(?,?,0)",
                   ("account-"+owner,"user-"+owner))
  for learner,owner in (("one","a"),("sibling","a"),("foreign","b")):
   self.db.execute("INSERT INTO learners(id,account_id,display_name,learner_type,created_at_ms)"
                   " VALUES(?,?,?,'child',0)",(learner,"account-"+owner,learner))
  self.db.execute("INSERT INTO quran_editions(id,riwayah,page_count,manifest_sha256)"
                  " VALUES(?,'hafs',604,?)",(ED,"c"*64))
  self.db.execute("INSERT INTO quran_ayah_anchors(edition_id,surah,ayah,page,word_count)"
                  " VALUES(?,1,1,1,7)",(ED,))
  self.counter=0
 def op(self,action="put",item="ink-1",kind="pen",page=1,version=0,
        learner="one",actor="user-a",payload=PEN,key=None):
  self.counter+=1
  opid=key or str(uuid4())
  self.db.execute(SQL,("e"+str(self.counter),learner,actor,opid,action,item,kind,
                        ED,page,version,payload,1000+self.counter))
  return opid
 def item(self,item="ink-1",learner="one"):
  return self.db.execute("SELECT visible,version,payload_json FROM private_mushaf_items "
                         "WHERE learner_id=? AND item_id=?",(learner,item)).fetchone()
 def count(self):
  return self.db.execute("SELECT count(*) FROM private_mushaf_events").fetchone()[0]
 def test_pen_marker_tombstones_undo_redo_survive_reload(self):
  self.op()
  self.op(item="marker-1",kind="marker")
  self.op(action="hide",version=1,payload="{}")
  assert self.item()[:2]==(0,2)
  self.op(action="restore",version=2,payload="{}")
  assert self.item()[:2]==(1,3)
  assert self.item()[2]==PEN
  assert self.item("marker-1")[:2]==(1,1)
  assert self.count()==4
  with self.assertRaises(sqlite3.IntegrityError):
   self.db.execute("UPDATE private_mushaf_events SET action='put'")
  with self.assertRaises(sqlite3.IntegrityError):
   self.db.execute("DELETE FROM private_mushaf_events")
 def test_note_validated_against_real_seeded_canonical_page_and_word(self):
  self.op(item="note-1-1",kind="note",payload=NOTE)
  with self.assertRaisesRegex(sqlite3.IntegrityError,"Quran note anchor"):
   self.op(item="note-1-1-wrong",kind="note",page=2,payload=NOTE)
  invalid=NOTE.replace('"wordIndex":null','"wordIndex":8')
  with self.assertRaisesRegex(sqlite3.IntegrityError,"Quran note anchor"):
   self.op(item="note-1-1-word",kind="note",payload=invalid)
  assert self.count()==1
 def test_owned_one_sibling_isolated_foreign_denied_and_disabled(self):
  self.op()
  self.op(item="ink-2",learner="sibling")
  self.op(item="ink-3",learner="foreign",actor="user-b")
  with self.assertRaisesRegex(sqlite3.IntegrityError,"owner denied"):
   self.op(item="foreign-access",learner="foreign",actor="user-a")
  assert self.item("ink-3","foreign")[:2]==(1,1)
  assert self.item("ink-1","sibling") is None
  self.db.execute("UPDATE learners SET status='archived' WHERE id='one'")
  with self.assertRaises(sqlite3.IntegrityError):
   self.op(item="ink-new")
 def test_revision_collision_does_not_log_partial_operation(self):
  self.op()
  with self.assertRaisesRegex(sqlite3.IntegrityError,"revision or identity"):
   self.op(item="ink-1",version=0)
  with self.assertRaises(sqlite3.IntegrityError):
   self.op(action="hide",version=15,payload="{}")
  assert self.item()[:2]==(1,1)
  assert self.count()==1
 def test_duplicate_operation_id_rejected_without_second_mutation(self):
  opid=str(uuid4())
  self.op(key=opid)
  with self.assertRaises(sqlite3.IntegrityError):
   self.op(key=opid,action="hide",version=1,payload="{}")
  assert self.item()[:2]==(1,1)
  assert self.count()==1
 def test_missing_edition_is_not_silently_accepted(self):
  self.db.execute("DELETE FROM quran_ayah_anchors")
  self.db.execute("DELETE FROM quran_editions")
  with self.assertRaises(sqlite3.IntegrityError):
   self.op()
  assert self.count()==0
 def test_position_is_versioned_and_page_may_change(self):
  self.op(item="position",kind="position",page=1,payload="{}")
  self.op(item="position",kind="position",page=22,version=1,payload="{}")
  self.assertEqual(self.db.execute("SELECT page,version FROM private_mushaf_items WHERE item_id='position'").fetchone(),(22,2))

if __name__=="__main__":
 unittest.main()
