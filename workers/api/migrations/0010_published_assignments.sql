-- Phase 05A: immutable teacher-published, learner-scoped Quran assignments.
-- No voice content, audio URLs, or private mushaf data stored here.
CREATE TABLE assignment_publish_events (
 operation_id TEXT NOT NULL PRIMARY KEY CHECK(length(operation_id)=36),
 assignment_id TEXT NOT NULL UNIQUE CHECK(length(assignment_id)=36),
 learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE RESTRICT,
 actor_auth_subject TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('memorization','revision','recitation')),
 edition_id TEXT NOT NULL REFERENCES quran_editions(id) ON DELETE RESTRICT,
 surah INTEGER NOT NULL CHECK(surah BETWEEN 1 AND 114),
 from_ayah INTEGER NOT NULL CHECK(from_ayah>0),
 to_ayah INTEGER NOT NULL CHECK(to_ayah>=from_ayah),
 due_at_ms INTEGER NOT NULL,
 instructions TEXT NOT NULL CHECK(length(trim(instructions)) BETWEEN 1 AND 500),
 published_at_ms INTEGER NOT NULL CHECK(published_at_ms>=0),
 FOREIGN KEY(edition_id,surah,from_ayah) REFERENCES quran_ayah_anchors(edition_id,surah,ayah),
 FOREIGN KEY(edition_id,surah,to_ayah) REFERENCES quran_ayah_anchors(edition_id,surah,ayah)
) STRICT;
CREATE INDEX assignment_events_learner ON assignment_publish_events(learner_id,published_at_ms DESC);

CREATE TABLE learner_assignments (
 id TEXT NOT NULL PRIMARY KEY CHECK(length(id)=36),
 learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE RESTRICT,
 teacher_auth_subject TEXT NOT NULL,
 operation_id TEXT NOT NULL UNIQUE REFERENCES assignment_publish_events(operation_id) ON DELETE RESTRICT,
 kind TEXT NOT NULL CHECK(kind IN ('memorization','revision','recitation')),
 edition_id TEXT NOT NULL,
 surah INTEGER NOT NULL CHECK(surah BETWEEN 1 AND 114),
 from_ayah INTEGER NOT NULL CHECK(from_ayah>0),
 to_ayah INTEGER NOT NULL CHECK(to_ayah>=from_ayah),
 due_at_ms INTEGER NOT NULL,
 instructions TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'assigned' CHECK(status='assigned'),
 revision INTEGER NOT NULL DEFAULT 1 CHECK(revision=1),
 published_at_ms INTEGER NOT NULL,
 FOREIGN KEY(edition_id,surah,from_ayah) REFERENCES quran_ayah_anchors(edition_id,surah,ayah),
 FOREIGN KEY(edition_id,surah,to_ayah) REFERENCES quran_ayah_anchors(edition_id,surah,ayah)
) STRICT;
CREATE INDEX learner_assignments_visible ON learner_assignments(learner_id,status,due_at_ms,id);

CREATE TRIGGER assignment_publish_guard BEFORE INSERT ON assignment_publish_events
BEGIN
 SELECT RAISE(ABORT,'ASSIGNMENT_ACCESS_DENIED') WHERE NOT EXISTS(
   SELECT 1 FROM learners l JOIN accounts owner ON owner.id=l.account_id
   JOIN teacher_assignments a ON a.learner_id=l.id
   JOIN teachers t ON t.id=a.teacher_id
   WHERE l.id=NEW.learner_id AND l.status='active' AND owner.status='active'
     AND t.auth_subject=NEW.actor_auth_subject
     AND t.status='active' AND t.qualified=1
     AND a.revoked_at_ms IS NULL
     AND a.starts_at_ms<=NEW.published_at_ms AND a.ends_at_ms>NEW.published_at_ms
 );
 SELECT RAISE(ABORT,'ASSIGNMENT_BAD_DUE_DATE')
 WHERE NEW.due_at_ms<=NEW.published_at_ms OR
   NEW.due_at_ms>NEW.published_at_ms+15552000000;
 SELECT RAISE(ABORT,'ASSIGNMENT_INVALID_RANGE') WHERE NOT EXISTS(
   SELECT 1 FROM quran_ayah_anchors start_anchor
   JOIN quran_ayah_anchors end_anchor
    ON end_anchor.edition_id=start_anchor.edition_id AND end_anchor.surah=start_anchor.surah
   WHERE start_anchor.edition_id=NEW.edition_id AND start_anchor.surah=NEW.surah
     AND start_anchor.ayah=NEW.from_ayah AND end_anchor.ayah=NEW.to_ayah
 );
 SELECT RAISE(ABORT,'ASSIGNMENT_CAP') WHERE
  (SELECT count(*) FROM learner_assignments WHERE learner_id=NEW.learner_id)>=200;
END;
CREATE TRIGGER assignment_publish_apply AFTER INSERT ON assignment_publish_events
BEGIN
 INSERT INTO learner_assignments(id,learner_id,teacher_auth_subject,operation_id,
  kind,edition_id,surah,from_ayah,to_ayah,due_at_ms,instructions,published_at_ms)
 VALUES(NEW.assignment_id,NEW.learner_id,NEW.actor_auth_subject,NEW.operation_id,
  NEW.kind,NEW.edition_id,NEW.surah,NEW.from_ayah,NEW.to_ayah,NEW.due_at_ms,
  trim(NEW.instructions),NEW.published_at_ms);
END;
CREATE TRIGGER assignment_events_immutable_update BEFORE UPDATE ON assignment_publish_events
BEGIN SELECT RAISE(ABORT,'ASSIGNMENT_EVENT_IMMUTABLE'); END;
CREATE TRIGGER assignment_events_immutable_delete BEFORE DELETE ON assignment_publish_events
BEGIN SELECT RAISE(ABORT,'ASSIGNMENT_EVENT_IMMUTABLE'); END;
CREATE TRIGGER assignment_projection_immutable_update BEFORE UPDATE ON learner_assignments
BEGIN SELECT RAISE(ABORT,'ASSIGNMENT_IMMUTABLE'); END;
CREATE TRIGGER assignment_projection_immutable_delete BEFORE DELETE ON learner_assignments
BEGIN SELECT RAISE(ABORT,'ASSIGNMENT_IMMUTABLE'); END;
INSERT INTO noor_schema_meta(component,version) VALUES('assignments',1);
