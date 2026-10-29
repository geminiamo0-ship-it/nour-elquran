"""#157: SQLite acceptance of exact D1 migration (synthetic profiles only)."""
import sqlite3
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def event(n, learner='a-1', owner='account-a', actor='subject-a',
          action='rename', revision=1, name='New name'):
    return (f'00000000-0000-4000-8000-{n:012d}',learner,owner,actor,
            action,revision,name if action=='rename' else None,1000+n)

class ProfileLifecycleTests(unittest.TestCase):
    def setUp(self):
        self.db=sqlite3.connect(':memory:')
        self.db.execute('PRAGMA foreign_keys=ON')
        for name in ('0001_core.sql','0002_auth.sql','0008_learner_profiles.sql'):
            self.db.executescript((ROOT/'migrations'/name).read_text(encoding='utf-8'))
        self.db.executemany(
            'INSERT INTO accounts(id,auth_subject,status,created_at_ms) VALUES(?,?,?,0)',
            [('account-a','subject-a','active'),('account-b','subject-b','active')])
        self.db.executemany(
            "INSERT INTO learners(id,account_id,display_name,learner_type,status,created_at_ms) VALUES(?,?,?,'child','active',0)",
            [('a-1','account-a','Old name'),('a-2','account-a','Sibling'),
             ('b-1','account-b','Other owner')])
        self.db.execute("INSERT INTO teachers(id,auth_subject,qualified,status) VALUES('t-1','teacher-subject',1,'active')")
        self.db.execute("INSERT INTO lessons(id,learner_id,actual_teacher_id,kind,status,starts_at_ms,ends_at_ms) "
                        "VALUES('lesson-a','a-1','t-1','trial','completed',0,2400000)")
    def tearDown(self):
        self.db.close()
    def issue(self, values):
        return self.db.execute('INSERT INTO learner_profile_events '
            '(operation_id,learner_id,account_id,actor_auth_subject,action,expected_revision,new_name,at_ms) '
            'VALUES(?,?,?,?,?,?,?,?)',values)

    def test_rename_cas_audit_and_immutable_event(self):
        self.issue(event(1))
        self.assertEqual(self.db.execute("SELECT display_name,status,revision FROM learners WHERE id='a-1'").fetchone(),
                         ('New name','active',2))
        self.assertEqual(self.db.execute("SELECT revision FROM learners WHERE id='a-2'").fetchone(),(1,))
        self.assertEqual(self.db.execute(
            "SELECT previous_name,updated_name,previous_status,updated_status,previous_revision,updated_revision "
            "FROM learner_profile_audit WHERE learner_id='a-1'").fetchone(),
            ('Old name','New name','active','active',1,2))
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("UPDATE learner_profile_audit SET updated_name='Tampered' WHERE learner_id='a-1'")

        with self.assertRaises(sqlite3.IntegrityError): self.issue(event(2,revision=1,name='Race'))
        with self.assertRaises(sqlite3.IntegrityError): self.issue(event(3,revision=2,name='New name'))
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("DELETE FROM learner_profile_events WHERE operation_id=?", (event(1)[0],))
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("UPDATE learner_profile_events SET new_name='Other' WHERE operation_id=?", (event(1)[0],))
        self.assertEqual(self.db.execute("SELECT count(*) FROM learner_profile_events").fetchone(),(1,))

    def test_cross_owner_and_forged_subject_refused_atomically(self):
        for n,kwargs in enumerate([
            {'learner':'b-1','owner':'account-a'},
            {'actor':'subject-b'},
            {'owner':'account-b'},
            {'learner':'a-2','actor':'subject-b'},
        ],4):
            with self.assertRaises(sqlite3.IntegrityError):self.issue(event(n,**kwargs))
        self.assertEqual(self.db.execute("SELECT count(*) FROM learner_profile_events").fetchone(),(0,))
        self.assertEqual(self.db.execute("SELECT display_name FROM learners WHERE id='b-1'").fetchone(),('Other owner',))

    def test_archive_keeps_history_and_fails_closed_after_archive(self):
        self.issue(event(9,action='archive'))
        self.assertEqual(self.db.execute("SELECT status,revision FROM learners WHERE id='a-1'").fetchone(),('archived',2))
        self.assertEqual(self.db.execute("SELECT learner_id FROM lessons WHERE id='lesson-a'").fetchone(),('a-1',))
        self.assertEqual(self.db.execute(
            "SELECT previous_name,updated_name,previous_status,updated_status FROM learner_profile_audit "
            "WHERE learner_id='a-1'").fetchone(),
            ('Old name','Old name','active','archived'))

        with self.assertRaises(sqlite3.IntegrityError):self.issue(event(10,revision=2))
        with self.assertRaises(sqlite3.IntegrityError):self.issue(event(9,action='archive'))
        self.assertEqual(self.db.execute("SELECT count(*) FROM learner_profile_events").fetchone(),(1,))

    def test_disabled_household_is_denied(self):
        self.db.execute("UPDATE accounts SET status='disabled' WHERE id='account-a'")
        with self.assertRaises(sqlite3.IntegrityError):self.issue(event(11))

if __name__=='__main__':
    unittest.main()
