"""Synthetic ownership/anchor fixtures only; no children's data or Quran text."""
from pathlib import Path
import sqlite3
import unittest

MIGRATIONS = sorted((Path(__file__).resolve().parents[1] / "migrations").glob("*.sql"))

def database():
    db = sqlite3.connect(":memory:")
    db.execute("PRAGMA foreign_keys = ON")
    for migration in MIGRATIONS:
        db.executescript(migration.read_text())
    return db

class CoreMigrationTests(unittest.TestCase):
    def setUp(self):
        self.db = database()
        self.db.executemany("INSERT INTO accounts VALUES (?,?,?,?)",
                            [("a","subject-a","active",0),("b","subject-b","active",0)])
        self.db.executemany("INSERT INTO learners VALUES (?,?,?,?,?,?)",
                            [("la","a","Fixture A","child","active",0),
                             ("lb","a","Fixture B","child","active",0),
                             ("lc","b","Fixture C","adult","active",0)])
        self.db.execute("INSERT INTO teachers VALUES ('t','teacher-subject',1,'active')")
        self.db.execute("INSERT INTO lessons VALUES ('l1','la','t','trial','completed',1000,2000,2000)")
        self.db.execute("INSERT INTO lessons VALUES ('l2','lb','t','standard','scheduled',3000,4000,NULL)")
        self.db.execute("INSERT INTO quran_editions VALUES ('fixture','hafs',604,?)", ("0"*64,))
        self.db.execute("INSERT INTO quran_ayah_anchors VALUES ('fixture',1,1,1,4)")
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def annotation(self, **override):
        row = dict(id="n1", learner_id="la", account_id="a", lesson_id="l1", edition_id="fixture",
                   surah=1, ayah=1, page=1, word_index=None, kind="text", layer="private",
                   payload_json='{"text":"synthetic note"}', version=1, operation_id="op1", created_at_ms=0)
        row.update(override)
        keys = ",".join(row)
        self.db.execute("INSERT INTO personal_annotations ("+keys+") VALUES ("+
                        ",".join("?" for _ in row)+")", tuple(row.values()))

    def test_migrations_replay_on_clean_database(self):
        second = database()
        self.assertEqual(second.execute("SELECT version FROM noor_schema_meta WHERE component='core'").fetchone(), (1,))
        self.assertEqual(second.execute("PRAGMA foreign_key_check").fetchall(), [])
        second.close()

    def test_valid_annotation(self):
        self.annotation(word_index=4)
        self.assertEqual(self.db.execute("SELECT learner_id FROM personal_annotations").fetchone(), ("la",))

    def test_account_scope_cannot_reference_other_owner(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.annotation(account_id="b")

    def test_sibling_lesson_cannot_be_linked_to_annotation(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.annotation(lesson_id="l2")

    def test_lesson_grant_cannot_reference_wrong_learner(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO lesson_access_grants VALUES ('g','l1','lb','t','substitute',900,950,1000,2000,NULL)")

    def test_annotation_cannot_be_moved_to_sibling_by_update(self):
        self.annotation(lesson_id=None)
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("UPDATE personal_annotations SET learner_id='lb' WHERE id='n1'")

    def test_lesson_scope_is_immutable(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("UPDATE lessons SET learner_id='lb' WHERE id='l1'")

    def test_duplicate_operation_does_not_create_second_note(self):
        self.annotation()
        with self.assertRaises(sqlite3.IntegrityError):
            self.annotation(id="n2")

    def test_missing_or_mismatched_quran_anchor_rejected(self):
        for values in [dict(ayah=2), dict(page=2), dict(edition_id="unknown")]:
            with self.subTest(values=values), self.assertRaises(sqlite3.IntegrityError):
                self.annotation(**values)

    def test_word_bounds_on_insert_and_update(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.annotation(word_index=5)
        self.annotation()
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("UPDATE personal_annotations SET word_index=5 WHERE id='n1'")

    def test_personal_layer_cannot_become_published_teacher_content(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.annotation(layer="published")
        self.annotation()
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("UPDATE personal_annotations SET layer='published' WHERE id='n1'")

    def test_invalid_payload_and_version(self):
        for values in [dict(payload_json="not-json"), dict(version=0)]:
            with self.subTest(values=values), self.assertRaises(sqlite3.IntegrityError):
                self.annotation(**values)

    def test_primary_assignment_overlap_insert_and_update(self):
        self.db.execute("INSERT INTO teacher_assignments VALUES ('g1','la','t',0,100,NULL)")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO teacher_assignments VALUES ('g2','la','t',99,200,NULL)")
        self.db.execute("INSERT INTO teacher_assignments VALUES ('g2','la','t',100,200,NULL)")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("UPDATE teacher_assignments SET starts_at_ms=99 WHERE id='g2'")

    def test_substitute_late_consent_cannot_be_accepted(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO lesson_access_grants VALUES ('g','l1','la','t','substitute',951,950,1000,2000,NULL)")
        self.db.execute("INSERT INTO lesson_access_grants VALUES ('g','l1','la','t','substitute',950,950,1000,2000,NULL)")

    def test_relationship_delete_restricted(self):
        self.annotation()
        for sql in ["DELETE FROM accounts WHERE id='a'", "DELETE FROM learners WHERE id='la'",
                    "DELETE FROM lessons WHERE id='l1'"]:
            with self.subTest(sql=sql), self.assertRaises(sqlite3.IntegrityError):
                self.db.execute(sql)

    def test_failed_transaction_rolls_back_prior_effect(self):
        with self.assertRaises(sqlite3.IntegrityError):
            with self.db:
                self.db.execute("UPDATE accounts SET status='disabled' WHERE id='a'")
                self.annotation(account_id="b")
        self.assertEqual(self.db.execute("SELECT status FROM accounts WHERE id='a'").fetchone(), ("active",))

    def test_strict_types_reject_invalid_time_and_fractional_anchor(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO accounts VALUES ('bad','bad-subject','active','not-a-time')")
        with self.assertRaises(sqlite3.IntegrityError):
            self.annotation(ayah=1.5)

    def test_sql_export_restore_keeps_ownership_and_references(self):
        self.annotation(word_index=4)
        dump = "\n".join(self.db.iterdump())
        restored = sqlite3.connect(":memory:")
        restored.executescript(dump)
        restored.execute("PRAGMA foreign_keys=ON")
        self.assertEqual(restored.execute("PRAGMA foreign_key_check").fetchall(), [])
        self.assertEqual(restored.execute("SELECT learner_id,lesson_id,word_index FROM personal_annotations").fetchone(), ("la","l1",4))
        with self.assertRaises(sqlite3.IntegrityError):
            restored.execute("UPDATE personal_annotations SET learner_id='lb' WHERE id='n1'")
        restored.close()

    def test_null_identity_rejected(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO accounts VALUES (NULL,'new-subject','active',0)")

if __name__ == "__main__":
    unittest.main()
