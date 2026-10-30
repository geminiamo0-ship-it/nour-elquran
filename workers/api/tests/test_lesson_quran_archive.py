"""08B1: strict immutable Quran archive provenance, references and sealing."""
import sqlite3,unittest,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]/"migrations"
def uid(n):return f"00000000-0000-4000-8000-{n:012d}"
class LessonQuranArchive(unittest.TestCase):
 def setUp(self):
  self.db=sqlite3.connect(":memory:")
  self.db.execute("PRAGMA foreign_keys=ON")
  for name in ("0001_core.sql","0003_teacher_schedule.sql",
               "0004_classroom_lifecycle.sql","0013_lesson_reports.sql",
               "0015_lesson_quran_archive.sql","0016_lesson_archive_required_fields.sql"):
   self.db.executescript((ROOT/name).read_text())
  db=self.db
  db.execute("INSERT INTO accounts(id,auth_subject,created_at_ms) VALUES('home','owner',0)")
  db.execute("INSERT INTO accounts(id,auth_subject,created_at_ms) VALUES('other','foreign',0)")
  db.execute("INSERT INTO learners(id,account_id,display_name,learner_type,created_at_ms)"
             " VALUES('a','home','Synthetic learner','child',0)")
  db.execute("INSERT INTO learners(id,account_id,display_name,learner_type,created_at_ms)"
             " VALUES('b','other','Other synthetic learner','adult',0)")
  db.execute("INSERT INTO teachers(id,auth_subject,qualified) VALUES('t','sheikh',1)")
  db.execute("INSERT INTO teacher_assignments(id,learner_id,teacher_id,starts_at_ms,ends_at_ms)"
             " VALUES('primary','a','t',0,999999999)")
  db.execute("INSERT INTO lessons(id,learner_id,actual_teacher_id,kind,status,starts_at_ms,ends_at_ms)"
             " VALUES('lesson','a','t','standard','scheduled',1000,2401000)")
  db.execute("INSERT INTO quran_editions(id,riwayah,page_count,manifest_sha256)"
             " VALUES('test-edition','hafs',604,?)",("a"*64,))
  db.execute("INSERT INTO quran_ayah_anchors(edition_id,surah,ayah,page,word_count)"
             " VALUES('test-edition',1,1,1,4)")
 def tearDown(self):self.db.close()
 def completed(self):
  db=self.db
  db.execute("UPDATE lessons SET status='live' WHERE id='lesson'")
  db.execute("INSERT INTO lesson_lifecycle_events(id,lesson_id,teacher_id,action,at_ms,operation_id)"
             " VALUES('start-event','lesson','t','start',1200,'op-start-1')")
  db.execute("UPDATE lessons SET status='completed',ended_at_ms=3000 WHERE id='lesson'")
  db.execute("INSERT INTO lesson_lifecycle_events(id,lesson_id,teacher_id,action,at_ms,operation_id)"
             " VALUES('end-event','lesson','t','end',3000,'op-end-1')")
  db.execute("INSERT INTO lesson_report_events(operation_id,lesson_id,learner_id,actor_auth_subject,"
             "kind,expected_revision,scope,strengths,corrections,next_plan,at_ms)"
             " VALUES(?,'lesson','a','sheikh','save',0,'الفاتحة','','','',3100)",(uid(1),))
  db.execute("INSERT INTO lesson_report_events(operation_id,lesson_id,learner_id,actor_auth_subject,"
             "kind,expected_revision,scope,strengths,corrections,next_plan,at_ms)"
             " VALUES(?,'lesson','a','sheikh','publish',1,'الفاتحة','','','',3200)",(uid(2),))
 def manifest(self,rev=1,sha=None,end_event="end-event",seal=None):
  return self.db.execute(
   "INSERT INTO lesson_quran_archives(lesson_id,learner_id,report_revision,"
   "edition_id,end_event_id,source,source_sha256,created_at_ms,sealed_at_ms)"
   " VALUES('lesson','a',?,'test-edition',?,'classroom-do:v1',?,3300,?)",
   (rev,end_event,sha or 'b'*64,seal))
 def page(self,n=1):
  return self.db.execute("INSERT INTO lesson_quran_archive_pages"
   "(lesson_id,report_revision,page) VALUES('lesson',1,?)",(n,))
 def mark(self,n=1,kind="note",surah=1,ayah=1,page=1,body=None):
  data=body or {"text":"Synthetic correction","color":"#CC0000"}
  return self.db.execute("INSERT INTO lesson_quran_archive_marks"
   "(lesson_id,report_revision,mark_id,edition_id,page,surah,ayah,kind,payload_json)"
   " VALUES('lesson',1,?,'test-edition',?,?,?,?,?)",
   (f"mark{n}",page,surah,ayah,kind,json.dumps(data)))
 def seal(self):self.db.execute("UPDATE lesson_quran_archives SET sealed_at_ms=3400"
   " WHERE lesson_id='lesson' AND report_revision=1")
 def test_refuse_archive_until_real_end_and_published_report(self):
  with self.assertRaises(sqlite3.IntegrityError):self.manifest()
  self.completed()
  with self.assertRaisesRegex(sqlite3.IntegrityError,"ARCHIVE_MUST_START_UNSEALED"):
   self.manifest(seal=3400)
  with self.assertRaisesRegex(sqlite3.IntegrityError,"ARCHIVE_LESSON_NOT_COMPLETED"):
   self.manifest(end_event="start-event")
  self.manifest()
  with self.assertRaisesRegex(sqlite3.IntegrityError,"ARCHIVE_EMPTY"):self.seal()
 def test_published_archive_is_immutable_and_bounded(self):
  self.completed();self.manifest();self.page()
  self.mark()
  ink={"color":"#112233","width":3,"points":[{"x":1,"y":1},{"x":100,"y":120}]}
  self.mark(2,"pen",None,None,1,ink)
  self.seal()
  with self.assertRaisesRegex(sqlite3.IntegrityError,"ARCHIVE_IMMUTABLE"):
   self.db.execute("UPDATE lesson_quran_archives SET source_sha256=?",
                   ("c"*64,))
  with self.assertRaisesRegex(sqlite3.IntegrityError,"ARCHIVE_SEALED"):
   self.page(2)
  with self.assertRaisesRegex(sqlite3.IntegrityError,"ARCHIVE_SEALED"):
   self.mark(3)
  with self.assertRaisesRegex(sqlite3.IntegrityError,"ARCHIVE_IMMUTABLE"):
   self.db.execute("DELETE FROM lesson_quran_archive_marks")
  with self.assertRaisesRegex(sqlite3.IntegrityError,"ARCHIVE_IMMUTABLE"):
   self.db.execute("DELETE FROM lesson_quran_archives")
 def test_no_unapproved_or_noncanonical_mark(self):
  self.completed();self.manifest();self.page()
  with self.assertRaises(sqlite3.IntegrityError):
   self.mark(1,page=2)
  with self.assertRaises(sqlite3.IntegrityError):
   self.mark(2,surah=1,ayah=2)
  with self.assertRaisesRegex(sqlite3.IntegrityError,"ARCHIVE_MARK_INVALID"):
   self.mark(3,body={"text":"note","color":"red"})
  with self.assertRaisesRegex(sqlite3.IntegrityError,"ARCHIVE_BAD_POINT"):
   self.mark(4,"marker",None,None,1,
    {"color":"#123456","width":12,"points":[{"x":1,"y":2},{"x":1100,"y":2}]})
  with self.assertRaisesRegex(sqlite3.IntegrityError,"ARCHIVE_MARK_REQUIRED_FIELD_MISSING"):
   self.mark(15,body={"text":"Missing color"})
  with self.assertRaisesRegex(sqlite3.IntegrityError,"ARCHIVE_MARK_REQUIRED_FIELD_MISSING"):
   self.mark(16,"pen",None,None,1,{"color":"#000000","points":[{"x":1,"y":2},{"x":3,"y":4}]})
  self.mark(5)
  self.seal()
  self.assertEqual(self.db.execute("SELECT COUNT(*) FROM lesson_quran_archive_marks").fetchone(),(1,))
 def test_latest_published_version_must_match_archived_version(self):
  self.completed();self.manifest();self.page();self.seal()
  sql=("SELECT a.report_revision FROM lesson_quran_archives a JOIN "
       "lesson_report_state s ON s.lesson_id=a.lesson_id AND "
       "s.latest_published_revision=a.report_revision WHERE a.sealed_at_ms IS NOT NULL")
  self.assertEqual(self.db.execute(sql).fetchall(),[(1,)])
  self.db.execute("INSERT INTO lesson_report_events(operation_id,lesson_id,learner_id,actor_auth_subject,"
   "kind,expected_revision,scope,strengths,corrections,next_plan,at_ms)"
   " VALUES(?,'lesson','a','sheikh','save',1,'البقرة','','','',3500)",(uid(3),))
  self.assertEqual(self.db.execute(sql).fetchall(),[(1,)])
  self.db.execute("INSERT INTO lesson_report_events(operation_id,lesson_id,learner_id,actor_auth_subject,"
   "kind,expected_revision,scope,strengths,corrections,next_plan,at_ms)"
   " VALUES(?,'lesson','a','sheikh','publish',2,'البقرة','','','',3600)",(uid(4),))
  self.assertEqual(self.db.execute(sql).fetchall(),[])
if __name__=="__main__":unittest.main()
