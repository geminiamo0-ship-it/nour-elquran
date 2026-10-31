-- #286: Cloudflare D1 native SQLite rejects the 6-class hexadecimal GLOB
-- with "LIKE or GLOB pattern too complex: SQLITE_ERROR" on first draft INSERT.
-- Keep all existing access, range, JSON, immutability and projection checks.
-- Existing 0017/0018 are already deployed: additive migration only.
-- Use length + leading '#' + short negated-class GLOB for 6 hex characters.
-- Apply to both private draft and canonical event guards; publication must
-- not fail later for the same cause. No existing data is modified.
DROP TRIGGER teacher_assignment_draft_guard;
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
   OR (length(json_extract(m.value,'$.payload.color'))<>7
    OR substr(json_extract(m.value,'$.payload.color'),1,1)<>'#'
    OR substr(json_extract(m.value,'$.payload.color'),2) GLOB '*[^0-9a-fA-F]*')
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
DROP TRIGGER learner_quran_event_guard;
CREATE TRIGGER learner_quran_event_guard BEFORE INSERT ON learner_quran_events
BEGIN
 SELECT RAISE(ABORT,'QURAN_LEDGER_EDITION_DENIED') WHERE NOT EXISTS (
  SELECT 1 FROM quran_editions q
  WHERE q.id=NEW.edition_id AND q.riwayah='hafs' AND q.page_count=604
 );
 SELECT RAISE(ABORT,'QURAN_LEDGER_ACTOR_DENIED') WHERE NOT EXISTS (
  SELECT 1 FROM learners l
  JOIN accounts a ON a.id=l.account_id
  WHERE l.id=NEW.learner_id AND l.status='active' AND a.status='active'
 );
 SELECT RAISE(ABORT,'QURAN_LEDGER_ACTOR_DENIED') WHERE
  (NEW.actor_role='learner' AND NOT EXISTS (
    SELECT 1 FROM learners l JOIN accounts a ON a.id=l.account_id
    WHERE l.id=NEW.learner_id AND a.auth_subject=NEW.actor_subject
      AND a.status='active' AND l.status='active'
  ))
  OR (NEW.actor_role='teacher' AND NOT EXISTS (
    SELECT 1 FROM teachers t JOIN auth_users u ON u.id=t.auth_subject
    WHERE t.auth_subject=NEW.actor_subject AND t.status='active' AND t.qualified=1
  ));
 -- Lesson edits are allowed only during the actual LIVE lesson, not after END.
 -- Presence/consent is verified by Worker/DO, not inferred from this trigger.
 SELECT RAISE(ABORT,'QURAN_LEDGER_LESSON_DENIED') WHERE
  NEW.origin_type='lesson' AND NOT EXISTS (
    SELECT 1 FROM lessons l WHERE l.id=NEW.origin_id
    AND l.learner_id=NEW.learner_id AND l.status='live'
    AND (NEW.actor_role='learner' OR EXISTS (
      SELECT 1 FROM teachers t
      WHERE t.id=l.actual_teacher_id AND t.auth_subject=NEW.actor_subject
        AND t.status='active' AND t.qualified=1
    ))
  );
 -- Teacher homework events must target an already *published* assignment,
 -- with the same teacher and an active assignment grant at event time.
 -- Never allow a draft to masquerade as a published teacher mark.
 SELECT RAISE(ABORT,'QURAN_LEDGER_ASSIGNMENT_DENIED') WHERE
  NEW.origin_type='assignment' AND NOT EXISTS (
    SELECT 1 FROM learner_assignments task
    JOIN teachers t ON t.auth_subject=NEW.actor_subject
    JOIN teacher_assignments grant_row ON grant_row.teacher_id=t.id
      AND grant_row.learner_id=task.learner_id
    WHERE task.id=NEW.origin_id AND task.learner_id=NEW.learner_id
      AND task.edition_id=NEW.edition_id AND task.status='assigned'
      AND task.teacher_auth_subject=NEW.actor_subject
      AND t.status='active' AND t.qualified=1
      AND grant_row.revoked_at_ms IS NULL
      AND grant_row.starts_at_ms<=NEW.at_ms AND grant_row.ends_at_ms>NEW.at_ms
      AND EXISTS (
        SELECT 1 FROM quran_ayah_anchors anchor
        WHERE anchor.edition_id=NEW.edition_id AND anchor.page=NEW.page
          AND anchor.surah=task.surah
          AND anchor.ayah BETWEEN task.from_ayah AND task.to_ayah
          AND (NEW.surah IS NULL OR (NEW.surah=anchor.surah AND NEW.ayah=anchor.ayah))
      )
  );
 -- Never let a new item reuse a prior ID or alter authorship/visibility/source.
 SELECT RAISE(ABORT,'QURAN_LEDGER_REVISION_CONFLICT') WHERE
  (NEW.expected_revision=0 AND (NEW.action<>'put' OR EXISTS(
    SELECT 1 FROM learner_quran_current cur WHERE cur.learner_id=NEW.learner_id
      AND cur.item_id=NEW.item_id
  )))
  OR (NEW.expected_revision>0 AND NOT EXISTS(
    SELECT 1 FROM learner_quran_current cur
    WHERE cur.learner_id=NEW.learner_id AND cur.item_id=NEW.item_id
      AND cur.revision=NEW.expected_revision AND cur.visible=1
      AND cur.edition_id=NEW.edition_id AND cur.page=NEW.page
      AND cur.kind=NEW.kind AND cur.surah IS NEW.surah AND cur.ayah IS NEW.ayah
      AND cur.word_index IS NEW.word_index AND cur.origin_type=NEW.origin_type
      AND cur.origin_id IS NEW.origin_id AND cur.audience=NEW.audience
      AND (cur.author_subject=NEW.actor_subject OR
        (NEW.action='hide' AND NEW.actor_role='teacher' AND
          NEW.origin_type='lesson' AND cur.author_role='learner' AND
          cur.audience='shared'))
  ));
 SELECT RAISE(ABORT,'QURAN_LEDGER_WORD_DENIED') WHERE
  NEW.word_index IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM quran_ayah_anchors anchor
    WHERE anchor.edition_id=NEW.edition_id AND anchor.surah=NEW.surah
      AND anchor.ayah=NEW.ayah AND anchor.page=NEW.page
      AND NEW.word_index<=anchor.word_count
  );
 SELECT RAISE(ABORT,'QURAN_LEDGER_PAYLOAD_DENIED') WHERE
  (NEW.action='hide' AND NEW.payload_json<>'{}')
  OR (NEW.action='put' AND (
    COALESCE(json_type(NEW.payload_json,'$.color'),'<missing>')<>'text'
    OR (length(json_extract(NEW.payload_json,'$.color'))<>7
      OR substr(json_extract(NEW.payload_json,'$.color'),1,1)<>'#'
      OR substr(json_extract(NEW.payload_json,'$.color'),2) GLOB '*[^0-9a-fA-F]*')
    OR (NEW.kind='note' AND (
      COALESCE(json_type(NEW.payload_json,'$.text'),'<missing>')<>'text'
      OR length(trim(json_extract(NEW.payload_json,'$.text'))) NOT BETWEEN 1 AND 500))
    OR (NEW.kind IN ('pen','marker') AND (
      COALESCE(json_type(NEW.payload_json,'$.width'),'<missing>') NOT IN ('integer','real')
      OR json_extract(NEW.payload_json,'$.width') NOT BETWEEN 1 AND 60
      OR COALESCE(json_type(NEW.payload_json,'$.points'),'<missing>')<>'array'
      OR json_array_length(NEW.payload_json,'$.points') NOT BETWEEN 2 AND 2500))
  ));
 SELECT RAISE(ABORT,'QURAN_LEDGER_POINT_DENIED') WHERE
  NEW.action='put' AND NEW.kind IN ('pen','marker') AND EXISTS (
    SELECT 1 FROM json_each(NEW.payload_json,'$.points') point WHERE
      json_type(point.value,'$.x') NOT IN ('integer','real') OR
      json_type(point.value,'$.y') NOT IN ('integer','real') OR
      json_extract(point.value,'$.x') NOT BETWEEN 0 AND 1000 OR
      json_extract(point.value,'$.y') NOT BETWEEN 0 AND 1594
  );
 -- Cap current page density. Do not return partial projections.
 SELECT RAISE(ABORT,'QURAN_LEDGER_PAGE_CAPACITY') WHERE
  NEW.action='put' AND NEW.expected_revision=0 AND
  (SELECT COUNT(*) FROM learner_quran_current cur
    WHERE cur.learner_id=NEW.learner_id AND cur.edition_id=NEW.edition_id
      AND cur.page=NEW.page AND cur.visible=1)>=300;
END;
INSERT INTO noor_schema_meta(component,version)
 VALUES('quran_ink_color_d1_compat',1);
