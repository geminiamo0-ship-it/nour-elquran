-- ADR 0009 / #251 A3: forward-only Cloudflare D1 compatibility fix.
-- Wrangler's local SQLite enforces a low GLOB complexity limit; the original
-- six bracket classes in 0017 reject otherwise valid colors at runtime.
-- Preserve every other event/actor/revision guard and all immutable data.
-- Do not rewrite or drop existing learner Quran events/current rows.
DROP TRIGGER IF EXISTS learner_quran_event_guard;
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
    OR length(json_extract(NEW.payload_json,'$.color'))<>7
    OR substr(json_extract(NEW.payload_json,'$.color'),1,1)<>'#'
    OR substr(json_extract(NEW.payload_json,'$.color'),2)
      GLOB '*[^0-9a-fA-F]*'
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
