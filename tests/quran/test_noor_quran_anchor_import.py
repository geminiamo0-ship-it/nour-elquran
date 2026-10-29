"""Small synthetic canonical Quran fixtures; never uploaded or imported to real D1."""
import copy
import hashlib
import importlib.util
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location("canon",ROOT/"scripts/noor_quran_anchor_import.py")
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

class QuranAnchorTests(unittest.TestCase):
    def setUp(self):
        self.constants=m.PAGES,m.SURAHS,m.AYAHS,m.WORDS
        m.PAGES,m.SURAHS,m.AYAHS,m.WORDS=2,2,3,5
        self.addCleanup(self.restore)
        self.pages={1:[{"surahNumber":1,"ayahNumber":1,"polygon":"0 1 2 3"},
                       {"surahNumber":1,"ayahNumber":2,"polygon":"1 2 3 4"}],
                    2:[{"surahNumber":2,"ayahNumber":1,"polygon":"2 3 4 5"}]}
        self.index=[{"number":1,"ayahCount":2},{"number":2,"ayahCount":1}]
        self.text={"format":"quran-mushaf","format_version":"1.0",
                   "mushaf":{"key":"hafs","word_count":5},
                   "counting":{"system":"kufi","ayah_count":3},
                   "words":["a","b","c","d","e"],"ayah_starts":[0,2,4],
                   "page_starts":[0,4],
                   "surahs":[{"number":1,"ayah_count":2,"first_ayah":0},
                             {"number":2,"ayah_count":1,"first_ayah":2}]}
    def restore(self):
        m.PAGES,m.SURAHS,m.AYAHS,m.WORDS=self.constants
    def test_valid_index_renders_only_verified_rows(self):
        rows=m.reconcile(self.pages,self.text,self.index)
        self.assertEqual(rows,[(1,1,1,2),(1,2,1,2),(2,1,2,1)])
        generated=m.render_sql(rows,"a"*64,"b"*64)
        self.assertEqual(generated.count("INSERT INTO quran_ayah_anchors"),3)
        self.assertNotIn("CREATE TABLE",generated)
    def test_duplicates_and_missing_verses_block_sql(self):
        bad=copy.deepcopy(self.pages)
        bad[2][0]["surahNumber"]=1
        bad[2][0]["ayahNumber"]=1
        with self.assertRaisesRegex(ValueError,"Duplicate"):m.reconcile(bad,self.text,self.index)
        bad=copy.deepcopy(self.pages)
        bad[1].pop()
        with self.assertRaises(ValueError):m.reconcile(bad,self.text,self.index)
    def test_mismatched_pages_and_zero_word_counts(self):
        bad=copy.deepcopy(self.text)
        bad["page_starts"]=[0,1]
        with self.assertRaisesRegex(ValueError,"page mismatch"):m.reconcile(self.pages,bad,self.index)
        bad=copy.deepcopy(self.text)
        bad["ayah_starts"]=[0,2,5]
        with self.assertRaisesRegex(ValueError,"Zero"):m.reconcile(self.pages,bad,self.index)
        bad=copy.deepcopy(self.text)
        bad["words"][2]=""
        with self.assertRaisesRegex(ValueError,"word"):m.reconcile(self.pages,bad,self.index)
    def test_invalid_manifest_asset_or_hash_denied(self):
        assets={f"pages/{p:03d}.{ext}":hashlib.sha256(f"{p}-{ext}".encode()).hexdigest()
                for p in (1,2) for ext in ("json","svg")}
        assets.update({"indexes/surah.json":"1"*64,"indexes/markers.json":"2"*64,
                       "text/chapters/001.json":"3"*64,"text/chapters/002.json":"3"*64})
        manifest={"edition":"hafs-kfqc","version":"v1.1.1","source_git_revision":m.SVG_REV,
                  "page_count":2,"chapter_count":2,
                  "assets":[{"key":key,"sha256":value} for key,value in assets.items()]}
        blob=m.jsonbytes(manifest)
        self.assertEqual(len(m.check_manifest(blob,m.digest(blob))),8)
        with self.assertRaisesRegex(ValueError,"SHA-256 changed"):
            m.check_manifest(blob,"0"*64)
        manifest["assets"][0]["key"]="../config"
        with self.assertRaisesRegex(ValueError,"Invalid or duplicated"):
            m.check_manifest(m.jsonbytes(manifest))
