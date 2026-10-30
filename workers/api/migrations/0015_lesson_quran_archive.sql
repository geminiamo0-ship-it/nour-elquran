-- Phase 08B1 #192: canonical teacher lesson archive, NEVER copies Quran text/pages.
-- No public API writes these tables. A future authenticated Classroom-DO
-- exporter must verify checkpoint digest and seal a complete manifest.
CREATE TABLE lesson_quran_archives (
 lesson_id TEXT NOT NULL,
 learner_id TEXT NOT NULL,
 report_revision INTEGER NOT NULL CHECK(report_revision>=1),
 edition_id TEXT NOT NULL REFERENCES quran_editions(id) ON DELETE RESTRICT,
 end_event_id TEXT NOT NULL REFERENCES lesson_lifecycle_events(id) ON DELETE RESTRICT,
 source TEXT NOT NULL CHECK(source='classroom-do:v1'),
 source_sha256 TEXT NOT NULL CHECK(length(source_sha256)=64 AND source_sha256 NOT GLOB '*[^0-9a-f]*'),
 created_at_ms INTEGER NOT NULL CHECK(created_at_ms>=0),
 sealed_at_ms INTEGER CHECK(sealed_at_ms IS NULL OR sealed_at_ms>=created_at_ms),
 PRIMARY KEY(lesson_id,report_revision),
 UNIQUE(lesson_id,report_revision,edition_id),
 FOREIGN KEY(lesson_id,learner_id) REFERENCES lessons(id,learner_id) ON DELETE RESTRICT,
 FOREIGN KEY(lesson_id,report_revision) REFERENCES lesson_report_publications(lesson_id,revision) ON DELETE RESTRICT
) STRICT;
CREATE TABLE lesson_quran_archive_pages (
 lesson_id TEXT NOT NULL,
 report_revision INTEGER NOT NULL,
 page INTEGER NOT NULL CHECK(page BETWEEN 1 AND 604),
 PRIMARY KEY(lesson_id,report_revision,page),
 FOREIGN KEY(lesson_id,report_revision)
  REFERENCES lesson_quran_archives(lesson_id,report_revision) ON DELETE RESTRICT
) STRICT;
CREATE TABLE lesson_quran_archive_marks (
 lesson_id TEXT NOT NULL,
 report_revision INTEGER NOT NULL,
 mark_id TEXT NOT NULL CHECK(length(mark_id) BETWEEN 1 AND 128),
 edition_id TEXT NOT NULL,
 page INTEGER NOT NULL CHECK(page BETWEEN 1 AND 604),
 surah INTEGER CHECK(surah BETWEEN 1 AND 114),
 ayah INTEGER CHECK(ayah>=1),
 kind TEXT NOT NULL CHECK(kind IN ('note','highlight','pen','marker')),
 payload_json TEXT NOT NULL CHECK(json_valid(payload_json) AND length(payload_json)<=110000),
 PRIMARY KEY(lesson_id,report_revision,mark_id),
 FOREIGN KEY(lesson_id,report_revision,page)
  REFERENCES lesson_quran_archive_pages(lesson_id,report_revision,page) ON DELETE RESTRICT,
 FOREIGN KEY(lesson_id,report_revision,edition_id)
  REFERENCES lesson_quran_archives(lesson_id,report_revision,edition_id) ON DELETE RESTRICT,
 FOREIGN KEY(edition_id,surah,ayah,page)
  REFERENCES quran_ayah_anchors(edition_id,surah,ayah,page) ON DELETE RESTRICT,
 CHECK((kind IN ('note','highlight') AND surah IS NOT NULL AND ayah IS NOT NULL)
   OR (kind IN ('pen','marker') AND surah IS NULL AND ayah IS NULL))
) STRICT;
CREATE INDEX lesson_quran_marks_page ON lesson_quran_archive_marks(lesson_id,report_revision,page,kind);

CREATE TRIGGER lesson_archive_insert_guard BEFORE INSERT ON lesson_quran_archives
BEGIN
 SELECT RAISE(ABORT,'ARCHIVE_LESSON_NOT_COMPLETED') WHERE NOT EXISTS (
  SELECT 1 FROM lessons l JOIN lesson_lifecycle_events e
   ON e.lesson_id=l.id AND e.id=NEW.end_event_id
  JOIN lesson_report_publications p
   ON p.lesson_id=l.id AND p.revision=NEW.report_revision
  JOIN quran_editions q ON q.id=NEW.edition_id
  WHERE l.id=NEW.lesson_id AND l.learner_id=NEW.learner_id
   AND l.status='completed' AND l.ended_at_ms=e.at_ms AND e.action='end'
   AND e.teacher_id=l.actual_teacher_id AND p.learner_id=l.learner_id
   AND q.riwayah='hafs' AND q.page_count=604
   AND NEW.created_at_ms>=p.published_at_ms
 );
 SELECT RAISE(ABORT,'ARCHIVE_MUST_START_UNSEALED') WHERE NEW.sealed_at_ms IS NOT NULL;
END;
CREATE TRIGGER lesson_archive_page_guard BEFORE INSERT ON lesson_quran_archive_pages
BEGIN
 SELECT RAISE(ABORT,'ARCHIVE_SEALED') WHERE NOT EXISTS (
  SELECT 1 FROM lesson_quran_archives a WHERE a.lesson_id=NEW.lesson_id
  AND a.report_revision=NEW.report_revision AND a.sealed_at_ms IS NULL
 );
 SELECT RAISE(ABORT,'ARCHIVE_PAGE_LIMIT') WHERE
  (SELECT COUNT(*) FROM lesson_quran_archive_pages p
   WHERE p.lesson_id=NEW.lesson_id AND p.report_revision=NEW.report_revision)>=20;
END;
CREATE TRIGGER lesson_archive_mark_guard BEFORE INSERT ON lesson_quran_archive_marks
BEGIN
 SELECT RAISE(ABORT,'ARCHIVE_SEALED') WHERE NOT EXISTS (
  SELECT 1 FROM lesson_quran_archives a WHERE a.lesson_id=NEW.lesson_id
   AND a.report_revision=NEW.report_revision AND a.edition_id=NEW.edition_id
   AND a.sealed_at_ms IS NULL
 );
 SELECT RAISE(ABORT,'ARCHIVE_MARK_LIMIT') WHERE
  (SELECT COUNT(*) FROM lesson_quran_archive_marks m WHERE m.lesson_id=NEW.lesson_id
    AND m.report_revision=NEW.report_revision)>=100;
 SELECT RAISE(ABORT,'ARCHIVE_MARK_INVALID') WHERE (
  (NEW.kind IN ('note','highlight') AND (
   json_type(NEW.payload_json,'$.color')!='text' OR
   length(json_extract(NEW.payload_json,'$.color'))!=7 OR
   json_extract(NEW.payload_json,'$.color') NOT GLOB '#[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]' OR
   (NEW.kind='note' AND (json_type(NEW.payload_json,'$.text')!='text' OR
    length(trim(json_extract(NEW.payload_json,'$.text'))) NOT BETWEEN 1 AND 500))
  )) OR
  (NEW.kind IN ('pen','marker') AND (
   json_type(NEW.payload_json,'$.color')!='text' OR
   length(json_extract(NEW.payload_json,'$.color'))!=7 OR
   json_extract(NEW.payload_json,'$.color') NOT GLOB '#[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]' OR
   json_type(NEW.payload_json,'$.width') NOT IN ('integer','real') OR
   json_extract(NEW.payload_json,'$.width') NOT BETWEEN 1 AND 60 OR
   json_type(NEW.payload_json,'$.points')!='array' OR
   json_array_length(NEW.payload_json,'$.points') NOT BETWEEN 2 AND 2500
  ))
 );
 SELECT RAISE(ABORT,'ARCHIVE_BAD_POINT') WHERE NEW.kind IN ('pen','marker') AND EXISTS (
   SELECT 1 FROM json_each(NEW.payload_json,'$.points') pt WHERE
     json_type(pt.value,'$.x') NOT IN ('integer','real') OR
     json_type(pt.value,'$.y') NOT IN ('integer','real') OR
     json_extract(pt.value,'$.x') NOT BETWEEN 0 AND 1000 OR
     json_extract(pt.value,'$.y') NOT BETWEEN 0 AND 1594
 );
END;
CREATE TRIGGER lesson_archive_seal_guard BEFORE UPDATE ON lesson_quran_archives
BEGIN
 SELECT RAISE(ABORT,'ARCHIVE_IMMUTABLE') WHERE
  OLD.sealed_at_ms IS NOT NULL OR NEW.sealed_at_ms IS NULL OR
  NEW.lesson_id IS NOT OLD.lesson_id OR NEW.learner_id IS NOT OLD.learner_id OR
  NEW.report_revision IS NOT OLD.report_revision OR NEW.edition_id IS NOT OLD.edition_id OR
  NEW.end_event_id IS NOT OLD.end_event_id OR NEW.source IS NOT OLD.source OR
  NEW.source_sha256 IS NOT OLD.source_sha256 OR NEW.created_at_ms IS NOT OLD.created_at_ms;
 SELECT RAISE(ABORT,'ARCHIVE_EMPTY') WHERE NOT EXISTS (
  SELECT 1 FROM lesson_quran_archive_pages p WHERE p.lesson_id=NEW.lesson_id
   AND p.report_revision=NEW.report_revision
 );
END;
CREATE TRIGGER lesson_archive_no_delete BEFORE DELETE ON lesson_quran_archives
BEGIN SELECT RAISE(ABORT,'ARCHIVE_IMMUTABLE'); END;
CREATE TRIGGER lesson_archive_page_no_update BEFORE UPDATE ON lesson_quran_archive_pages
BEGIN SELECT RAISE(ABORT,'ARCHIVE_IMMUTABLE'); END;
CREATE TRIGGER lesson_archive_page_no_delete BEFORE DELETE ON lesson_quran_archive_pages
BEGIN SELECT RAISE(ABORT,'ARCHIVE_IMMUTABLE'); END;
CREATE TRIGGER lesson_archive_mark_no_update BEFORE UPDATE ON lesson_quran_archive_marks
BEGIN SELECT RAISE(ABORT,'ARCHIVE_IMMUTABLE'); END;
CREATE TRIGGER lesson_archive_mark_no_delete BEFORE DELETE ON lesson_quran_archive_marks
BEGIN SELECT RAISE(ABORT,'ARCHIVE_IMMUTABLE'); END;
INSERT INTO noor_schema_meta(component,version) VALUES('lesson_quran_archive',1);
