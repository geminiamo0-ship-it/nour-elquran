"""#244: immutable subscription/compensation academic-credit D1 schema."""
import sqlite3
import unittest
from uuid import uuid4
from test_staff_schedule import TeacherSchedulingTests,T,SLOT

DAY=86400000
MONTH=30*DAY
CYCLE="""INSERT INTO subscription_cycles
(id,operation_id,learner_id,actor_subject,previous_cycle_id,
 starts_at_ms,ends_at_ms,base_sessions,rollover_sessions,reason,at_ms)
VALUES(?,?,?,?,?,?,?,?,?,?,?)"""
SPEND="""INSERT INTO subscription_spend_events
(id,operation_id,learner_id,lesson_id,actor_subject,source_kind,source_id,at_ms)
VALUES(?,?,?,?,?,?,?,?)"""
GRANT="""INSERT INTO subscription_compensation_grants
(id,operation_id,learner_id,lesson_id,actor_subject,
 fault_kind,sessions,reason,issued_at_ms) VALUES(?,?,?,?,?,?,?,?,?)"""

class AcademicLedgerTests(unittest.TestCase):
 def setUp(self):
  self.fixture=TeacherSchedulingTests()
  self.fixture.setUp()
  self.db=self.fixture.db
  self.db.commit()
 def tearDown(self): self.db.close()
 def cycle(self,start=T,base=5,carry=0,previous=None,child='child-a',
           actor='staff',op=None):
  value=str(uuid4())
  self.db.execute(CYCLE,(value,op or str(uuid4()),child,actor,previous,
    start,start+MONTH,base,carry,"Synthetic academic cycle authorized manually",start))
  return value
 def booked(self,start=T+SLOT,child='child-a',kind='standard'):
  return self.fixture.action('book',start=start,child=child,kind=kind)
 def spend(self,lesson,source,kind='cycle',at=T,child='child-a',actor='staff',op=None):
  self.db.execute(SPEND,(str(uuid4()),op or str(uuid4()),child,
    lesson,actor,kind,source,at))
 def grant(self,lesson,when,child='child-a',actor='staff',fault='teacher',count=1):
  result=str(uuid4())
  self.db.execute(GRANT,(result,str(uuid4()),child,lesson,actor,fault,count,
    "Staff-verified synthetic missed educational lesson",when))
  return result
 def test_schema_is_append_only_and_no_money_fields(self):
  self.assertEqual(self.db.execute("""SELECT version FROM noor_schema_meta
   WHERE component='subscription_ledger'""").fetchone(),(1,))
  c=self.cycle()
  for sql in ("DELETE FROM subscription_cycles",
              "UPDATE subscription_cycles SET base_sessions=60"):
   with self.assertRaisesRegex(sqlite3.IntegrityError,"SUBSCRIPTION_IMMUTABLE"):
    self.db.execute(sql)
  for table in ('subscription_cycles','subscription_spend_events',
                'subscription_compensation_grants'):
   columns={r[1] for r in self.db.execute("PRAGMA table_info("+table+")")}
   self.assertFalse({'amount','currency','payment_status','payment_id'} & columns)
  self.assertEqual(self.db.execute("PRAGMA foreign_key_check").fetchall(),[])
 def test_owner_boundary_role_revocation_and_duplicate_operation(self):
  c=self.cycle()
  with self.assertRaises(sqlite3.IntegrityError):
   self.cycle(start=T+MONTH,previous=c,op=self.db.execute(
    "SELECT operation_id FROM subscription_cycles WHERE id=?",(c,)).fetchone()[0])
  with self.assertRaisesRegex(sqlite3.IntegrityError,'SUBSCRIPTION_STAFF_DENIED'):
   self.cycle(start=T+MONTH,previous=c,actor='other')
  self.db.execute("UPDATE staff_grants SET revoked_at_ms=? WHERE auth_subject='staff'",(T,))
  with self.assertRaisesRegex(sqlite3.IntegrityError,'SUBSCRIPTION_STAFF_DENIED'):
   self.cycle(start=T+MONTH,previous=c)
  self.db.execute("UPDATE staff_grants SET revoked_at_ms=NULL WHERE auth_subject='staff'")
  with self.assertRaisesRegex(sqlite3.IntegrityError,'SUBSCRIPTION_LEARNER_DENIED'):
   self.cycle(start=T+MONTH,previous=c,child='nonexistent')
 def test_renewal_carries_only_previous_base_once_with_three_day_grace(self):
  self.fixture.action('assign')
  first=self.cycle(base=5)
  for j in range(2):
   lesson=self.booked(start=T+(j+1)*SLOT)
   self.spend(lesson,first)
  second=self.cycle(start=T+MONTH,base=4,carry=3,previous=first)
  self.assertEqual(self.db.execute("SELECT rollover_sessions FROM subscription_cycles WHERE id=?",
     (second,)).fetchone(),(3,))
  with self.assertRaisesRegex(sqlite3.IntegrityError,'SUBSCRIPTION_RENEWAL_CHAIN_INVALID'):
   self.cycle(start=T+2*MONTH,base=4,previous=first)
  # Seven unused in the second cycle, but only four are new base credits.
  third=self.cycle(start=T+2*MONTH,base=4,carry=4,previous=second)
  self.assertEqual(self.db.execute("SELECT rollover_sessions FROM subscription_cycles WHERE id=?",
    (third,)).fetchone(),(4,))
  with self.assertRaisesRegex(sqlite3.IntegrityError,'SUBSCRIPTION_ROLLOVER_MISMATCH'):
   self.cycle(start=T+3*MONTH,base=4,carry=8,previous=third)
 def test_late_renewal_drops_rollover_and_early_overlaps_rejected(self):
  a=self.cycle()
  with self.assertRaisesRegex(sqlite3.IntegrityError,'SUBSCRIPTION_CYCLE_OVERLAP'):
   self.cycle(start=T+MONTH-DAY,previous=a)
  with self.assertRaisesRegex(sqlite3.IntegrityError,'SUBSCRIPTION_ROLLOVER_MISMATCH'):
   self.cycle(start=T+MONTH+4*DAY,carry=5,previous=a)
  self.cycle(start=T+MONTH+4*DAY,carry=0,previous=a)
 def test_spend_never_exceeds_cycle_and_cannot_change_foreign_child(self):
  self.fixture.action('assign')
  c=self.cycle(base=1)
  first=self.booked()
  self.spend(first,c)
  with self.assertRaises(sqlite3.IntegrityError):
   self.spend(first,c)
  second=self.booked(start=T+2*SLOT)
  with self.assertRaisesRegex(sqlite3.IntegrityError,'SUBSCRIPTION_CYCLE_NO_CREDIT'):
   self.spend(second,c)
  with self.assertRaisesRegex(sqlite3.IntegrityError,'SUBSCRIPTION_LESSON_INELIGIBLE'):
   self.spend(second,c,child='child-b')
  self.db.execute("UPDATE learners SET status='archived' WHERE id='child-a'")
  with self.assertRaisesRegex(sqlite3.IntegrityError,'SUBSCRIPTION_LESSON_INELIGIBLE'):
   self.spend(second,c)
  self.assertEqual(self.db.execute("SELECT COUNT(*) FROM subscription_spend_events").fetchone(),(1,))
 def test_compensation_is_manual_lesson_backed_and_never_expires(self):
  self.fixture.action('assign')
  missed=self.booked(start=T+7*3600000)
  with self.assertRaisesRegex(sqlite3.IntegrityError,'SUBSCRIPTION_COMPENSATION_NOT_VERIFIED'):
   self.grant(missed,T+8*3600000)
  self.fixture.action('cancel',resource=missed,now=T)
  credit=self.grant(missed,T+8*3600000)
  with self.assertRaises(sqlite3.IntegrityError):
   self.grant(missed,T+8*3600000)
  future=self.booked(start=T+300*DAY)
  # A late backdated debit must not consume credit against an already-started
  # lesson, even when the grant is still unspent and valid indefinitely.
  with self.assertRaisesRegex(sqlite3.IntegrityError,'SUBSCRIPTION_COMPENSATION_NO_CREDIT'):
   self.spend(future,credit,kind='compensation',at=T+301*DAY)
  # No expiry on this make-up credit even though 300 calendar days passed.
  self.spend(future,credit,kind='compensation',at=T+299*DAY)
  with self.assertRaisesRegex(sqlite3.IntegrityError,'SUBSCRIPTION_COMPENSATION_NO_CREDIT'):
   other=self.booked(start=T+301*DAY)
   self.spend(other,credit,kind='compensation',at=T+300*DAY)
  self.assertEqual(self.db.execute("PRAGMA foreign_key_check").fetchall(),[])

if __name__=='__main__':unittest.main()
