-- #253 / ADR 0009: append-only private Sheikh homework ink drafts.
-- A draft is NOT part of the canonical learner Mushaf until its assignment
-- is published in the SAME D1 batch as the publication binding.
CREATE TABLE teacher_assignment_draft_versions (
 draft_id TEXT NOT NULL CHECK(length(draft_id)=36),
 revision INTEGER NOT NULL CHECK(revision>0),
 learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE RESTRICT,
 teacher_subject TEXT NOT NULL REFERENCES auth_users(id) ON DELETE RESTRICT,
 kind TEXT NOT NULL CHECK(kind IN ('memorization','revision','recitation')),
 edition_id TEXT NOT NULL REFERENCES quran_editions(id) ON DELETE RESTRICT,
 surah INTEGER NOT NULL CHECK(surah BETWEEN 1 AND 114),
 from_ayah INTEGER NOT NULL CHECK(from_ayah>0),
 to_ayah INTEGER NOT NULL CHECK(to_ayah>=from_ayah),
 due_at_ms INTEGER NOT NULL,
 instructions TEXT NOT NULL CHECK(length(trim(instructions)) BETWEEN 1 AND 500),
 marks_json TEXT NOT NULL CHECK(json_valid(marks_json) AND length(marks_json)<=180000),
 at_ms INTEGER NOT NULL CHECK(at_ms>=0),
 PRIMARY KEY(draft_id,revision)
) STRICT;
CREATE INDEX teacher_assignment_drafts_owner
 ON teacher_assignment_draft_versions(teacher_subject,learner_id,draft_id,revision DESC);
CREATE TRIGGER teacher_assignment_draft_guard BEFORE INSERT ON teacher_assignment_draft_versions
BEGIN
 SELECT RAISE(ABORT,'DRAFT_REVISION_CONFLICT') WHERE
  NEW.revision<>COALESCE((SELECT MAX(v.revision) FROM teacher_assignment_draft_versions v
      WHERE v.draft_id=NEW.draft_id),0)+1;
 SELECT RAISE(ABORT,'DRAFT_ALREADY_PUBLISHED') WHERE
  EXISTS(SELECT 1 FROM teacher_assignment_draft_publications p
         WHERE p.draft_id=NEW.draft_id);
 SELECT RAISE(ABORT,'DRAFT_IDENTITY_CONFLICT') WHERE EXISTS(
  SELECT 1 FROM teacher_assignment_draft_versions v
  WHERE v.draft_id=NEW.draft_id AND
   (v.learner_id<>NEW.learner_id OR v.teacher_subject<>NEW.teacher_subject
     OR v.edition_id<>NEW.edition_id));
 SELECT RAISE(ABORT,'DRAFT_ACCESS_DENIED') WHERE NOT EXISTS(
  SELECT 1 FROM learners l JOIN accounts a ON a.id=l.account_id
  JOIN teacher_assignments g ON g.learner_id=l.id
  JOIN teachers t ON t.id=g.teacher_id
  WHERE l.id=NEW.learner_id AND l.status='active' AND a.status='active'
   AND t.auth_subject=NEW.teacher_subject AND t.status='active' AND t.qualified=1
   AND g.revoked_at_ms IS NULL
   AND g.starts_at_ms<=NEW.at_ms AND g.ends_at_ms>NEW.at_ms);
 SELECT RAISE(ABORT,'DRAFT_INVALID_RANGE') WHERE NOT EXISTS(
  SELECT 1 FROM quran_ayah_anchors a JOIN quran_ayah_anchors b
    ON b.edition_id=a.edition_id AND b.surah=a.surah
  WHERE a.edition_id=NEW.edition_id AND a.surah=NEW.surah
   AND a.ayah=NEW.from_ayah AND b.ayah=NEW.to_ayah);
 SELECT RAISE(ABORT,'DRAFT_MARKS_INVALID') WHERE
  json_type(NEW.marks_json)<>'array' OR json_array_length(NEW.marks_json)>24;
 SELECT RAISE(ABORT,'DRAFT_MARKS_INVALID') WHERE EXISTS(
  SELECT 1 FROM json_each(NEW.marks_json) m WHERE
   json_type(m.value)<>'object'
   OR json_type(m.value,'$.id')<>'text'
   OR length(json_extract(m.value,'$.id')) NOT BETWEEN 8 AND 40
   OR json_type(m.value,'$.kind')<>'text'
   OR json_extract(m.value,'$.kind') NOT IN ('pen','marker','note','highlight')
   OR json_type(m.value,'$.page')<>'integer'
   OR json_extract(m.value,'$.page') NOT BETWEEN 1 AND 604
   OR json_type(m.value,'$.payload')<>'object'
   OR json_type(m.value,'$.payload.color')<>'text'
   OR json_extract(m.value,'$.payload.color') NOT GLOB '#[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]'
   OR NOT EXISTS(
    SELECT 1 FROM quran_ayah_anchors anchor
    WHERE anchor.edition_id=NEW.edition_id AND anchor.page=json_extract(m.value,'$.page')
     AND anchor.surah=NEW.surah AND anchor.ayah BETWEEN NEW.from_ayah AND NEW.to_ayah
     AND (json_extract(m.value,'$.kind') IN ('pen','marker')
       OR (anchor.ayah=json_extract(m.value,'$.ayah') AND
        json_extract(m.value,'$.surah')=anchor.surah))
   )
   OR (json_extract(m.value,'$.kind') IN ('pen','marker') AND
      (json_type(m.value,'$.surah')<>'null' OR json_type(m.value,'$.ayah')<>'null' OR
       json_type(m.value,'$.payload.points')<>'array' OR
       json_array_length(m.value,'$.payload.points') NOT BETWEEN 2 AND 600 OR
       json_type(m.value,'$.payload.width') NOT IN ('integer','real') OR
       json_extract(m.value,'$.payload.width') NOT BETWEEN 1 AND 60))
   OR (json_extract(m.value,'$.kind')='note' AND
     (json_type(m.value,'$.payload.text')<>'text' OR
       length(trim(json_extract(m.value,'$.payload.text'))) NOT BETWEEN 1 AND 500))
 );
 SELECT RAISE(ABORT,'DRAFT_MARKS_INVALID') WHERE EXISTS(
  SELECT 1 FROM json_each(NEW.marks_json) a JOIN json_each(NEW.marks_json) b
  ON a.key<b.key AND json_extract(a.value,'$.id')=json_extract(b.value,'$.id'));
 SELECT RAISE(ABORT,'DRAFT_MARKS_INVALID') WHERE EXISTS(
  SELECT 1 FROM json_each(NEW.marks_json) m, json_each(m.value,'$.payload.points') point
  WHERE json_extract(m.value,'$.kind') IN ('pen','marker')
    AND (json_type(point.value,'$.x') NOT IN ('integer','real') OR
      json_type(point.value,'$.y') NOT IN ('integer','real') OR
      json_extract(point.value,'$.x') NOT BETWEEN 0 AND 1000 OR
      json_extract(point.value,'$.y') NOT BETWEEN 0 AND 1594));
END;
CREATE TRIGGER teacher_assignment_draft_no_update BEFORE UPDATE ON teacher_assignment_draft_versions
BEGIN SELECT RAISE(ABORT,'DRAFT_IMMUTABLE'); END;
CREATE TRIGGER teacher_assignment_draft_no_delete BEFORE DELETE ON teacher_assignment_draft_versions
BEGIN SELECT RAISE(ABORT,'DRAFT_IMMUTABLE'); END;

CREATE TABLE teacher_assignment_draft_publications (
 draft_id TEXT NOT NULL PRIMARY KEY CHECK(length(draft_id)=36),
 operation_id TEXT NOT NULL UNIQUE CHECK(length(operation_id)=36),
 revision INTEGER NOT NULL,
 learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE RESTRICT,
 teacher_subject TEXT NOT NULL REFERENCES auth_users(id) ON DELETE RESTRICT,
 at_ms INTEGER NOT NULL CHECK(at_ms>=0),
 FOREIGN KEY(draft_id,revision) REFERENCES teacher_assignment_draft_versions(draft_id,revision)
) STRICT;
CREATE TRIGGER teacher_assignment_draft_publish_guard BEFORE INSERT ON teacher_assignment_draft_publications
BEGIN
 SELECT RAISE(ABORT,'DRAFT_REVISION_CONFLICT') WHERE NOT EXISTS (
  SELECT 1 FROM teacher_assignment_draft_versions v
  WHERE v.draft_id=NEW.draft_id AND v.revision=NEW.revision
   AND v.learner_id=NEW.learner_id AND v.teacher_subject=NEW.teacher_subject
   AND NOT EXISTS(SELECT 1 FROM teacher_assignment_draft_versions newer
     WHERE newer.draft_id=v.draft_id AND newer.revision>v.revision));
 SELECT RAISE(ABORT,'DRAFT_ACCESS_DENIED') WHERE NOT EXISTS(
  SELECT 1 FROM learners l JOIN accounts a ON a.id=l.account_id
  JOIN teacher_assignments g ON g.learner_id=l.id
  JOIN teachers t ON t.id=g.teacher_id
  WHERE l.id=NEW.learner_id AND l.status='active' AND a.status='active'
   AND t.auth_subject=NEW.teacher_subject AND t.status='active' AND t.qualified=1
   AND g.revoked_at_ms IS NULL AND g.starts_at_ms<=NEW.at_ms AND g.ends_at_ms>NEW.at_ms);
END;
CREATE TRIGGER teacher_assignment_draft_publish_check BEFORE INSERT ON assignment_publish_events
WHEN EXISTS(SELECT 1 FROM teacher_assignment_draft_publications p WHERE p.operation_id=NEW.operation_id)
BEGIN
 SELECT RAISE(ABORT,'DRAFT_PUBLICATION_MISMATCH') WHERE NOT EXISTS (
  SELECT 1 FROM teacher_assignment_draft_publications p
  JOIN teacher_assignment_draft_versions d
    ON d.draft_id=p.draft_id AND d.revision=p.revision
  WHERE p.operation_id=NEW.operation_id AND p.learner_id=NEW.learner_id
   AND p.teacher_subject=NEW.actor_auth_subject AND p.at_ms=NEW.published_at_ms
   AND d.kind=NEW.kind AND d.edition_id=NEW.edition_id
   AND d.surah=NEW.surah AND d.from_ayah=NEW.from_ayah AND d.to_ayah=NEW.to_ayah
   AND d.due_at_ms=NEW.due_at_ms AND d.instructions=NEW.instructions);
END;
-- This trigger runs AFTER the older assignment_publish_apply inserted the
-- published learner_assignments row. Its own ledger inserts trigger the same
-- canonical event guard/projection used by all other academic marks.
CREATE TRIGGER teacher_assignment_draft_canonical_projection AFTER INSERT ON learner_assignments
BEGIN
 INSERT INTO learner_quran_events(
   id,learner_id,operation_id,item_id,actor_subject,actor_role,
   origin_type,origin_id,audience,action,edition_id,page,surah,ayah,word_index,
   kind,expected_revision,payload_json,at_ms)
 SELECT 'draft-event-'||NEW.id||'-'||json_extract(m.value,'$.id'),
   NEW.learner_id,'draft-op-'||NEW.id||'-'||json_extract(m.value,'$.id'),
   'draft-item-'||NEW.id||'-'||json_extract(m.value,'$.id'),
   NEW.teacher_auth_subject,'teacher','assignment',NEW.id,'shared','put',
   NEW.edition_id,json_extract(m.value,'$.page'),
   json_extract(m.value,'$.surah'),json_extract(m.value,'$.ayah'),NULL,
   json_extract(m.value,'$.kind'),0,json_extract(m.value,'$.payload'),NEW.published_at_ms
 FROM teacher_assignment_draft_publications p
 JOIN teacher_assignment_draft_versions d ON d.draft_id=p.draft_id
  AND d.revision=p.revision
 JOIN json_each(d.marks_json) m
 WHERE p.operation_id=NEW.operation_id AND p.learner_id=NEW.learner_id
  AND p.teacher_subject=NEW.teacher_auth_subject;
END;
CREATE TRIGGER teacher_assignment_draft_pub_no_update BEFORE UPDATE ON teacher_assignment_draft_publications
BEGIN SELECT RAISE(ABORT,'DRAFT_PUBLICATION_IMMUTABLE'); END;
CREATE TRIGGER teacher_assignment_draft_pub_no_delete BEFORE DELETE ON teacher_assignment_draft_publications
BEGIN SELECT RAISE(ABORT,'DRAFT_PUBLICATION_IMMUTABLE'); END;
INSERT INTO noor_schema_meta(component,version) VALUES('teacher_assignment_drafts',1);
