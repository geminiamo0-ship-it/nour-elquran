-- ADR 0009 / #251: additive future canonical learner Quran event ledger.
-- No preexisting private_mushaf_items, DO ink or archived lesson rows are mutated.
-- This is server-only D1 infrastructure, NOT a public route or live backfill.
-- New shared academic marks become eligible for the same per-learner projection.
-- Teacher task drafts and DO-to-D1 ingestion are separate #252/#253 gates.
CREATE TABLE learner_quran_events (
 id TEXT NOT NULL PRIMARY KEY CHECK(length(id) BETWEEN 8 AND 128),
 learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE RESTRICT,
 operation_id TEXT NOT NULL CHECK(length(operation_id) BETWEEN 8 AND 128),
 item_id TEXT NOT NULL CHECK(length(item_id) BETWEEN 8 AND 128),
 actor_subject TEXT NOT NULL REFERENCES auth_users(id) ON DELETE RESTRICT,
 actor_role TEXT NOT NULL CHECK(actor_role IN ('learner','teacher')),
 origin_type TEXT NOT NULL CHECK(origin_type IN ('self_study','lesson','assignment')),
 origin_id TEXT,
 audience TEXT NOT NULL CHECK(audience IN ('private','shared')),
 action TEXT NOT NULL CHECK(action IN ('put','hide')),
 edition_id TEXT NOT NULL REFERENCES quran_editions(id) ON DELETE RESTRICT,
 page INTEGER NOT NULL CHECK(page BETWEEN 1 AND 604),
 surah INTEGER CHECK(surah BETWEEN 1 AND 114),
 ayah INTEGER CHECK(ayah>=1),
 word_index INTEGER CHECK(word_index IS NULL OR word_index>0),
 kind TEXT NOT NULL CHECK(kind IN ('pen','marker','highlight','note')),
 expected_revision INTEGER NOT NULL CHECK(expected_revision>=0),
 payload_json TEXT NOT NULL CHECK(json_valid(payload_json) AND length(payload_json)<=110000),
 at_ms INTEGER NOT NULL CHECK(at_ms>=0),
 UNIQUE(learner_id,operation_id),
 FOREIGN KEY(edition_id,surah,ayah,page)
  REFERENCES quran_ayah_anchors(edition_id,surah,ayah,page) ON DELETE RESTRICT,
 CHECK ((origin_type='self_study' AND origin_id IS NULL AND audience='private' AND actor_role='learner')
   OR (origin_type IN ('lesson','assignment') AND origin_id IS NOT NULL
    AND length(origin_id) BETWEEN 1 AND 128 AND audience='shared'
    AND (origin_type<>'assignment' OR actor_role='teacher'))),
 CHECK ((kind IN ('note','highlight') AND surah IS NOT NULL AND ayah IS NOT NULL)
   OR (kind IN ('pen','marker') AND surah IS NULL AND ayah IS NULL AND word_index IS NULL))
) STRICT;
CREATE INDEX learner_quran_event_history
 ON learner_quran_events(learner_id,edition_id,page,at_ms,id);
CREATE INDEX learner_quran_event_origin
 ON learner_quran_events(learner_id,origin_type,origin_id,at_ms,id);

CREATE TABLE learner_quran_current (
 learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE RESTRICT,
 item_id TEXT NOT NULL CHECK(length(item_id) BETWEEN 8 AND 128),
 edition_id TEXT NOT NULL REFERENCES quran_editions(id) ON DELETE RESTRICT,
 page INTEGER NOT NULL CHECK(page BETWEEN 1 AND 604),
 surah INTEGER,
 ayah INTEGER,
 word_index INTEGER,
 kind TEXT NOT NULL CHECK(kind IN ('pen','marker','highlight','note')),
 audience TEXT NOT NULL CHECK(audience IN ('private','shared')),
 author_subject TEXT NOT NULL REFERENCES auth_users(id) ON DELETE RESTRICT,
 author_role TEXT NOT NULL CHECK(author_role IN ('learner','teacher')),
 origin_type TEXT NOT NULL CHECK(origin_type IN ('self_study','lesson','assignment')),
 origin_id TEXT,
 payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),
 visible INTEGER NOT NULL CHECK(visible IN (0,1)),
 revision INTEGER NOT NULL CHECK(revision>=1),
 latest_event_id TEXT NOT NULL REFERENCES learner_quran_events(id) ON DELETE RESTRICT,
 updated_at_ms INTEGER NOT NULL CHECK(updated_at_ms>=0),
 PRIMARY KEY(learner_id,item_id)
) STRICT;
CREATE INDEX learner_quran_current_page
 ON learner_quran_current(learner_id,edition_id,page,audience,visible,item_id);

-- A direct SQL caller may not self-declare another actor or change the cohort;
-- signed Worker additionally verifies the actual cookie and derives role/clock.
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
    OR json_extract(NEW.payload_json,'$.color')
      NOT GLOB '#[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]'
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
CREATE TRIGGER learner_quran_event_apply AFTER INSERT ON learner_quran_events
BEGIN
 INSERT INTO learner_quran_current(learner_id,item_id,edition_id,page,surah,ayah,
  word_index,kind,audience,author_subject,author_role,origin_type,origin_id,
  payload_json,visible,revision,latest_event_id,updated_at_ms)
 SELECT NEW.learner_id,NEW.item_id,NEW.edition_id,NEW.page,NEW.surah,NEW.ayah,
  NEW.word_index,NEW.kind,NEW.audience,NEW.actor_subject,NEW.actor_role,
  NEW.origin_type,NEW.origin_id,NEW.payload_json,1,NEW.expected_revision+1,
  NEW.id,NEW.at_ms WHERE NEW.action='put'
 ON CONFLICT(learner_id,item_id) DO UPDATE SET
  payload_json=excluded.payload_json,visible=1,revision=excluded.revision,
  latest_event_id=excluded.latest_event_id,updated_at_ms=excluded.updated_at_ms;
 UPDATE learner_quran_current SET visible=0,revision=NEW.expected_revision+1,
  latest_event_id=NEW.id,updated_at_ms=NEW.at_ms
 WHERE learner_id=NEW.learner_id AND item_id=NEW.item_id AND NEW.action='hide';
END;
CREATE TRIGGER learner_quran_event_no_update BEFORE UPDATE ON learner_quran_events
BEGIN SELECT RAISE(ABORT,'QURAN_LEDGER_EVENTS_IMMUTABLE'); END;
CREATE TRIGGER learner_quran_event_no_delete BEFORE DELETE ON learner_quran_events
BEGIN SELECT RAISE(ABORT,'QURAN_LEDGER_EVENTS_IMMUTABLE'); END;
-- The projection is modified only by the event trigger; never apply client SQL.
-- A future trusted repair/replay path must verify the event log first.
CREATE TRIGGER learner_quran_current_no_delete BEFORE DELETE ON learner_quran_current
BEGIN SELECT RAISE(ABORT,'QURAN_LEDGER_PROJECTION_IMMUTABLE'); END;
INSERT INTO noor_schema_meta(component,version) VALUES('learner_quran_ledger',1);
