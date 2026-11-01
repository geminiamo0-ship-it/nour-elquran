"""#315: full D1 migration contracts for versioned packages, receipts and invites."""
import sqlite3
import unittest
from uuid import uuid4
from test_staff_schedule import TeacherSchedulingTests,T
DAY=86400000
PKG="""INSERT INTO academy_package_events
(id,operation_id,package_id,actor_subject,title,price_egp,sessions,active,at_ms)
VALUES(?,?,?,?,?,?,?,?,?)"""
REQUEST="""INSERT INTO academy_request_events
(id,operation_id,learner_id,actor_subject,package_id,package_version_id,kind,at_ms)
VALUES(?,?,?,?,?,?,'subscription',?)"""
ACT="""INSERT INTO academy_subscription_activation_events
(id,operation_id,actor_subject,learner_id,request_id,package_version_id,cycle_id,
previous_cycle_id,rollover_sessions,starts_at_ms,ends_at_ms,note,manually_confirmed,at_ms)
VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)"""
class AcademyAdminD1(unittest.TestCase):
 def setUp(self):
  self.fixture=TeacherSchedulingTests();self.fixture.setUp()
  self.db=self.fixture.db
  self.package=str(uuid4())
 def version(self,price=2000,at=T,active=1,actor='staff'):
  v=str(uuid4())
  self.db.execute(PKG,(v,str(uuid4()),self.package,actor,'Eight Quran lessons',price,8,active,at))
  return v
 def request(self,version,child='child-a',actor='staff'):
  v=str(uuid4())
  self.db.execute(REQUEST,(v,str(uuid4()),child,actor,self.package,version,T))
  return v
 def activate(self,version,req=None,child='child-a',actor='staff',now=T):
  cycle=str(uuid4())
  self.db.execute(ACT,(str(uuid4()),str(uuid4()),actor,child,req,version,cycle,
                      None,0,now,now+30*DAY,'Manual bank receipt reviewed by staff',1,now))
  return cycle
 def test_first_manual_confirmation_atomically_creates_real_academic_cycle(self):
  p=self.version()
  req=self.request(p)
  cycle=self.activate(p,req)
  self.assertEqual(self.db.execute('SELECT base_sessions FROM subscription_cycles WHERE id=?',
   (cycle,)).fetchone(),(8,))
  self.assertEqual(self.db.execute('SELECT package_version_id FROM academy_subscription_activation_events',
   ).fetchone(),(p,))
  for table in ('academy_package_events','academy_request_events',
                'academy_subscription_activation_events'):
   with self.assertRaisesRegex(sqlite3.IntegrityError,'ACADEMY_IMMUTABLE'):
    self.db.execute('DELETE FROM '+table)
  self.assertEqual(self.db.execute('PRAGMA foreign_key_check').fetchall(),[])
 def test_price_changes_preserve_original_student_request_snapshot(self):
  p=self.version(price=2000)
  request=self.request(p)
  new=self.version(price=2400,at=T+1)
  self.assertNotEqual(p,new)
  self.assertEqual(self.db.execute(
   'SELECT price_egp FROM academy_request_events r JOIN academy_package_events p '
   'ON p.id=r.package_version_id WHERE r.id=?',(request,)).fetchone(),(2000,))
  self.activate(p,request)
  with self.assertRaises(sqlite3.IntegrityError):
   self.activate(p,None)
 def test_foreign_owner_staff_revocation_and_legacy_credit_constraints(self):
  p=self.version()
  with self.assertRaisesRegex(sqlite3.IntegrityError,'ACADEMY_OWNER_DENIED'):
   self.request(p,child='child-b')
  with self.assertRaisesRegex(sqlite3.IntegrityError,'ACADEMY_STAFF_DENIED'):
   self.db.execute(PKG,(str(uuid4()),str(uuid4()),str(uuid4()),'other',
    'Fake package',1,1,1,T))
  self.db.execute("UPDATE staff_grants SET revoked_at_ms=? WHERE auth_subject='staff'",(T,))
  with self.assertRaisesRegex(sqlite3.IntegrityError,'ACADEMY_STAFF_DENIED'):
   self.activate(p)
 def test_one_use_invite_creates_active_sheikh_not_admin(self):
  from hashlib import sha256
  token_hash=sha256(b'unpredictable-synthetic-invite').hexdigest()
  invitation=str(uuid4())
  self.db.execute("""INSERT INTO academy_teacher_invites(id,operation_id,token_hash,
   actor_subject,created_at_ms,expires_at_ms) VALUES(?,?,?,?,?,?)""",
   (invitation,str(uuid4()),token_hash,'staff',T,T+7*DAY))
  self.db.execute("UPDATE auth_users SET phone_number_verified=0 WHERE id='other'")
  self.db.execute("""UPDATE academy_teacher_invites SET claimed_subject='other',
    claimed_at_ms=? WHERE id=?""",(T+100,invitation))
  teacher=self.db.execute("SELECT id,status,qualified FROM teachers WHERE auth_subject='other'").fetchone()
  self.assertEqual(teacher[1:],('active',1))
  self.assertEqual(len(teacher[0]),36)
  self.assertEqual(self.db.execute("SELECT COUNT(*) FROM staff_grants WHERE auth_subject='other'").fetchone(),(0,))
  with self.assertRaises(sqlite3.IntegrityError):
   self.db.execute("UPDATE academy_teacher_invites SET claimed_subject='teacher-a' WHERE id=?",
    (invitation,))
 def test_invalid_invite_after_staff_revocation_never_grants_sheikh(self):
  inv=str(uuid4())
  self.db.execute("""INSERT INTO academy_teacher_invites(id,operation_id,token_hash,
   actor_subject,created_at_ms,expires_at_ms) VALUES(?,?,?,?,?,?)""",
   (inv,str(uuid4()),'f'*64,'staff',T,T+DAY))
  self.db.execute("UPDATE staff_grants SET revoked_at_ms=? WHERE auth_subject='staff'",(T,))
  with self.assertRaisesRegex(sqlite3.IntegrityError,'ACADEMY_INVITER_REVOKED'):
   self.db.execute("UPDATE academy_teacher_invites SET claimed_subject='other',claimed_at_ms=? WHERE id=?",(T+500,inv))
  self.assertIsNone(self.db.execute("SELECT id FROM teachers WHERE auth_subject='other'").fetchone())
if __name__=='__main__':unittest.main()
