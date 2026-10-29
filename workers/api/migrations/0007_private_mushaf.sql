-- #144: learner-private Quran operations. No teacher/shared lesson visibility.
-- Canonical edition and ayah metadata must be independently imported/verified
-- before writes; do not seed fabricated Quran hashes or page/verse mappings.
CREATE TABLE private_mushaf_items (
 learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE RESTRICT,
 item_id TEXT NOT NULL CHECK(length(item_id) BETWEEN 1 AND 128),
 kind TEXT NOT NULL CHECK(kind IN ('pen','marker','note','highlight','bookmark','position')),
 edition_id TEXT NOT NULL REFERENCES quran_editions(id) ON DELETE RESTRICT,
 page INTEGER NOT NULL CHECK(page BETWEEN 1 AND 604),
 payload_json TEXT NOT NULL CHECK(json_valid(payload_json) AND length(payload_json)<=110000),
 visible INTEGER NOT NULL CHECK(visible IN (0,1)),
 version INTEGER NOT NULL CHECK(version>=1),
 updated_at_ms INTEGER NOT NULL CHECK(updated_at_ms>=0),
 PRIMARY KEY(learner_id,item_id)
) STRICT;
CREATE INDEX private_mushaf_by_page ON private_mushaf_items(learner_id,edition_id,page,visible,item_id);
CREATE INDEX private_mushaf_index ON private_mushaf_items(learner_id,edition_id,kind,visible);

CREATE TABLE private_mushaf_events (
 id TEXT NOT NULL PRIMARY KEY,
 learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE RESTRICT,
 actor_auth_subject TEXT NOT NULL REFERENCES auth_users(id) ON DELETE RESTRICT,
 operation_id TEXT NOT NULL CHECK(length(operation_id) BETWEEN 8 AND 128),
 action TEXT NOT NULL CHECK(action IN ('put','hide','restore')),
 item_id TEXT NOT NULL CHECK(length(item_id) BETWEEN 1 AND 128),
 kind TEXT NOT NULL CHECK(kind IN ('pen','marker','note','highlight','bookmark','position')),
 edition_id TEXT NOT NULL REFERENCES quran_editions(id) ON DELETE RESTRICT,
 page INTEGER NOT NULL CHECK(page BETWEEN 1 AND 604),
 expected_version INTEGER NOT NULL CHECK(expected_version>=0),
 payload_json TEXT NOT NULL CHECK(json_valid(payload_json) AND length(payload_json)<=110000),
 at_ms INTEGER NOT NULL CHECK(at_ms>=0),
 UNIQUE(learner_id,operation_id)
) STRICT;
CREATE INDEX private_mushaf_events_learner ON private_mushaf_events(learner_id,at_ms,id);

CREATE TRIGGER private_mushaf_event_guard BEFORE INSERT ON private_mushaf_events
BEGIN
 SELECT RAISE(ABORT,'private mushaf owner denied') WHERE NOT EXISTS(
  SELECT 1 FROM learners learner
  JOIN accounts owner ON owner.id=learner.account_id
  WHERE learner.id=NEW.learner_id AND learner.status='active'
    AND owner.status='active' AND owner.auth_subject=NEW.actor_auth_subject
 );
 SELECT RAISE(ABORT,'canonical edition unavailable') WHERE NOT EXISTS(
  SELECT 1 FROM quran_editions edition
  WHERE edition.id=NEW.edition_id AND edition.riwayah='hafs' AND edition.page_count=604
 );
 SELECT RAISE(ABORT,'Quran note anchor unavailable') WHERE NEW.action='put'
   AND NEW.kind IN ('note','highlight') AND NOT EXISTS(
   SELECT 1 FROM quran_ayah_anchors a WHERE a.edition_id=NEW.edition_id
     AND a.page=NEW.page
     AND a.surah=json_extract(NEW.payload_json,'$.target.surah')
     AND a.ayah=json_extract(NEW.payload_json,'$.target.ayah')
     AND (json_extract(NEW.payload_json,'$.target.wordIndex') IS NULL OR
       (json_type(NEW.payload_json,'$.target.wordIndex')='integer'
        AND json_extract(NEW.payload_json,'$.target.wordIndex')>=1
        AND json_extract(NEW.payload_json,'$.target.wordIndex')<=a.word_count))
 );
 SELECT RAISE(ABORT,'item revision or identity mismatch') WHERE
   (NEW.action='put' AND (
     (NEW.expected_version=0 AND EXISTS(
       SELECT 1 FROM private_mushaf_items it WHERE it.learner_id=NEW.learner_id AND it.item_id=NEW.item_id))
     OR (NEW.expected_version>0 AND NOT EXISTS(
       SELECT 1 FROM private_mushaf_items it WHERE it.learner_id=NEW.learner_id AND it.item_id=NEW.item_id
        AND it.version=NEW.expected_version AND it.kind=NEW.kind
        AND it.edition_id=NEW.edition_id
        AND (it.page=NEW.page OR it.kind='position')))
   ))
   OR (NEW.action IN ('hide','restore') AND NOT EXISTS(
     SELECT 1 FROM private_mushaf_items it WHERE it.learner_id=NEW.learner_id AND it.item_id=NEW.item_id
       AND it.kind=NEW.kind AND it.page=NEW.page AND it.edition_id=NEW.edition_id
       AND it.version=NEW.expected_version
       AND it.visible=(NEW.action='hide')
   ));
END;

-- SQLite triggers are part of the same atomic D1 INSERT; no multi-query
-- read-modify-write or eventually consistent client claim of persistence.
CREATE TRIGGER private_mushaf_event_apply AFTER INSERT ON private_mushaf_events
BEGIN
 INSERT INTO private_mushaf_items(learner_id,item_id,kind,edition_id,page,payload_json,visible,version,updated_at_ms)
 SELECT NEW.learner_id,NEW.item_id,NEW.kind,NEW.edition_id,NEW.page,
   NEW.payload_json,1,NEW.expected_version+1,NEW.at_ms WHERE NEW.action='put'
 ON CONFLICT(learner_id,item_id) DO UPDATE SET
   page=excluded.page,payload_json=excluded.payload_json,visible=1,
   version=excluded.version,updated_at_ms=excluded.updated_at_ms;
 UPDATE private_mushaf_items
 SET visible=(NEW.action='restore'),
     version=NEW.expected_version+1,updated_at_ms=NEW.at_ms
 WHERE learner_id=NEW.learner_id AND item_id=NEW.item_id AND NEW.action IN ('hide','restore');
END;
CREATE TRIGGER private_mushaf_audit_no_update BEFORE UPDATE ON private_mushaf_events
BEGIN SELECT RAISE(ABORT,'private Quran audit immutable'); END;
CREATE TRIGGER private_mushaf_audit_no_delete BEFORE DELETE ON private_mushaf_events
BEGIN SELECT RAISE(ABORT,'private Quran audit immutable'); END;
INSERT INTO noor_schema_meta(component,version) VALUES('private_mushaf',1);
