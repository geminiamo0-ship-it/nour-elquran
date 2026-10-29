"""#162: synthetic SQLite/D1 teacher academic plan acceptance."""
from pathlib import Path
import sqlite3
import unittest
ROOT=Path(__file__).resolve().parents[1]
def event(n,learner='learner-1',actor='teacher-one',revision=0,level='beginner',wird='الفاتحة',review='المراجعة',focus='مخارج الحروف',at=1500):
    return (f'00000000-0000-4000-8000-{n:012d}',learner,actor,revision,level,wird,review,focus,at)
class PlanDBTests(unittest.TestCase):
    def setUp(self):
        self.db=sqlite3.connect(':memory:')
        self.db.execute('PRAGMA foreign_keys=ON')
        for name in ('0001_core.sql','0009_academic_plan.sql'):
            self.db.executescript((ROOT/'migrations'/name).read_text())
        self.db.executemany('INSERT INTO accounts(id,auth_subject,status,created_at_ms) VALUES(?,?,?,0)',
                            [('home-a','owner-a','active'),('home-b','owner-b','active')])
        self.db.executemany(
            "INSERT INTO learners(id,account_id,display_name,learner_type,status,created_at_ms) VALUES(?,?,?,'child','active',0)",
            [('learner-1','home-a','Test A1'),('learner-2','home-a','Test A2'),('learner-3','home-b','Test B1')])
        self.db.executemany('INSERT INTO teachers(id,auth_subject,qualified,status) VALUES(?,?,1,\'active\')',
                            [('teacher-1','teacher-one'),('teacher-2','teacher-two')])
        self.db.execute('INSERT INTO teacher_assignments(id,learner_id,teacher_id,starts_at_ms,ends_at_ms) '
                        "VALUES('assignment-1','learner-1','teacher-1',1000,5000)")
    def tearDown(self):self.db.close()
    def write(self,args):
        return self.db.execute('INSERT INTO academic_plan_events '
            '(operation_id,learner_id,actor_auth_subject,expected_revision,level,next_wird,revision_wird,focus,at_ms) '
            'VALUES(?,?,?,?,?,?,?,?,?)',args)
    def test_creation_replay_cas_and_immutable_before_after(self):
        self.write(event(1))
        self.assertEqual(self.db.execute('SELECT revision,next_wird FROM learner_academic_plans').fetchone(),(1,'الفاتحة'))
        self.assertEqual(self.db.execute('SELECT previous_revision,new_revision,previous_level FROM academic_plan_audit').fetchone(),(0,1,None))
        self.write(event(2,revision=1,level='intermediate',wird='الآيات التالية'))
        self.assertEqual(self.db.execute('SELECT revision,level FROM learner_academic_plans').fetchone(),(2,'intermediate'))
        self.assertEqual(self.db.execute("SELECT previous_level,previous_next_wird,previous_revision,new_revision FROM academic_plan_audit WHERE operation_id=?", (event(2)[0],)).fetchone(),('beginner','الفاتحة',1,2))
        with self.assertRaisesRegex(sqlite3.IntegrityError,'PLAN_REVISION_CONFLICT'):
            self.write(event(3,revision=1))
        with self.assertRaises(sqlite3.IntegrityError):self.write(event(1))
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute('DELETE FROM academic_plan_events WHERE operation_id=?',(event(1)[0],))
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute('UPDATE academic_plan_audit SET previous_level=?',('forged',))
    def test_denies_sibling_other_owner_unassigned_and_substitute(self):
        for n,kw in enumerate([
            {'learner':'learner-2'}, {'learner':'learner-3'},
            {'actor':'teacher-two'}, {'actor':'owner-a'},
            {'at':999}, {'at':5000},
        ],10):
            with self.assertRaisesRegex(sqlite3.IntegrityError,'PLAN_ACCESS_DENIED'):
                self.write(event(n,**kw))
        self.assertEqual(self.db.execute('SELECT count(*) FROM learner_academic_plans').fetchone(),(0,))
    def test_revoke_disable_unqualify_archive_fail_closed(self):
        cases=[
          ("UPDATE teacher_assignments SET revoked_at_ms=1200",),
          ("UPDATE teachers SET qualified=0 WHERE id='teacher-1'",),
          ("UPDATE teachers SET status='disabled' WHERE id='teacher-1'",),
          ("UPDATE accounts SET status='disabled' WHERE id='home-a'",),
          ("UPDATE learners SET status='archived' WHERE id='learner-1'",),
        ]
        for n,(query,) in enumerate(cases,20):
            self.db.execute('SAVEPOINT guard_case')
            self.db.execute(query)
            with self.assertRaisesRegex(sqlite3.IntegrityError,'PLAN_ACCESS_DENIED'):
                self.write(event(n))
            self.db.execute('ROLLBACK TO guard_case')
            self.db.execute('RELEASE guard_case')
if __name__=='__main__':unittest.main()
