"""#182 Private R2 audio ledger remains locked before guardian/retention policy approval."""
import sqlite3
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]/'migrations'
def ident(p,n):
    return f'{p}0000000-0000-4000-8000-{n:012d}'

class PrivateAudioPrivacy(unittest.TestCase):
    def setUp(self):
        self.db=sqlite3.connect(':memory:')
        self.db.execute('PRAGMA foreign_keys=ON')
        for name in ('0001_core.sql','0010_published_assignments.sql',
                     '0011_assignment_submissions.sql','0012_recitation_audio_privacy.sql'):
            self.db.executescript((ROOT/name).read_text())
        self.db.execute("INSERT INTO accounts(id,auth_subject,created_at_ms) VALUES('owner','subject-a',0)")
        self.db.execute("INSERT INTO accounts(id,auth_subject,created_at_ms) VALUES('other','subject-b',0)")
        self.db.execute("INSERT INTO learners(id,account_id,display_name,learner_type,created_at_ms) VALUES('learner','owner','Synthetic','child',0)")
        self.db.execute("INSERT INTO teachers(id,auth_subject,qualified) VALUES('teacher','sheikh',1)")
        self.db.execute("INSERT INTO teacher_assignments(id,learner_id,teacher_id,starts_at_ms,ends_at_ms) VALUES('assign','learner','teacher',1,900000)")
        self.db.execute("INSERT INTO quran_editions(id,riwayah,page_count,manifest_sha256) VALUES('hafs','hafs',604,?)",('c'*64,))
        self.db.execute("INSERT INTO quran_ayah_anchors(edition_id,surah,ayah,page,word_count) VALUES('hafs',1,1,1,7)")
        self.task=ident('a',1)
        self.sub=ident('b',1)
        self.db.execute("""INSERT INTO assignment_publish_events
          (operation_id,assignment_id,learner_id,actor_auth_subject,kind,edition_id,
           surah,from_ayah,to_ayah,due_at_ms,instructions,published_at_ms)
          VALUES(?,?,'learner','sheikh','recitation','hafs',1,1,1,800000,'Recite',100)""",
          (ident('c',1),self.task))
        self.db.execute("""INSERT INTO assignment_submission_events
          (operation_id,id,assignment_id,learner_id,actor_auth_subject,attempt,note,submitted_at_ms)
          VALUES(?,?,?,'learner','subject-a',1,'written',200)""",
          (ident('d',1),self.sub))
    def tearDown(self):self.db.close()
    def consent(self,action='grant',actor='subject-a',n=1):
        self.db.execute("""INSERT INTO recitation_consent_events
          (operation_id,id,learner_id,actor_auth_subject,policy_version,decision,recorded_at_ms)
          VALUES(?,?,'learner',?,'pending-v1',?,1000)""",
          (ident('e',n),ident('f',n),actor,action))
    def asset(self,sub=None,learner='learner',actor='subject-a',key=None):
        aid=ident('a',2)
        value=key or f'assignment-audio/{learner}/{aid}.webm'
        self.db.execute("""INSERT INTO recitation_audio_assets
          (id,learner_id,assignment_id,submission_id,created_by_auth_subject,object_key,
           media_type,byte_size,duration_ms,sha256,created_at_ms)
          VALUES(?,?,?,?,?,?,'audio/webm',4000,30000,?,1000)""",
          (aid,learner,self.task,sub or self.sub,actor,value,'a'*64))
    def test_schema_is_additive_and_upload_is_locked(self):
        self.assertEqual(self.db.execute("SELECT version FROM noor_schema_meta WHERE component='recitation_audio_privacy'").fetchone(),(1,))
        with self.assertRaisesRegex(sqlite3.IntegrityError,'AUDIO_GUARDIAN_POLICY_NOT_APPROVED'):
            self.consent('grant')
        with self.assertRaisesRegex(sqlite3.IntegrityError,'AUDIO_STORAGE_NOT_APPROVED'):
            self.asset()
        self.assertEqual(self.db.execute("SELECT count(*) FROM recitation_audio_assets").fetchone(),(0,))
    def test_revocation_audit_has_owner_and_immutable_guards(self):
        with self.assertRaises(sqlite3.IntegrityError):self.consent('withdraw',actor='subject-b')
        self.consent('withdraw')
        with self.assertRaises(sqlite3.IntegrityError):self.consent('withdraw')
        with self.assertRaisesRegex(sqlite3.IntegrityError,'AUDIO_CONSENT_IMMUTABLE'):
            self.db.execute("UPDATE recitation_consent_events SET policy_version='new'")
        with self.assertRaisesRegex(sqlite3.IntegrityError,'AUDIO_CONSENT_IMMUTABLE'):
            self.db.execute("DELETE FROM recitation_consent_events")
    def test_scope_remains_guarded_even_in_synthetic_unlocked_schema(self):
        # Only in an isolated in-memory test; this never alters any live D1.
        self.db.execute('DROP TRIGGER recitation_audio_upload_locked')
        with self.assertRaises(sqlite3.IntegrityError):self.asset(actor='subject-b')
        with self.assertRaises(sqlite3.IntegrityError):self.asset(sub=ident('b',9))
        with self.assertRaises(sqlite3.IntegrityError):
            self.asset(key='https://public.r2.dev/exposed.webm')
        self.asset()
        with self.assertRaisesRegex(sqlite3.IntegrityError,'AUDIO_ASSET_IMMUTABLE'):
            self.db.execute("UPDATE recitation_audio_assets SET byte_size=30")
        with self.assertRaisesRegex(sqlite3.IntegrityError,'AUDIO_ASSET_IMMUTABLE'):
            self.db.execute("DELETE FROM recitation_audio_assets")

if __name__=='__main__':unittest.main()
