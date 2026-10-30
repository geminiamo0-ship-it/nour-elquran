-- Phase 08A #190. Per-lesson free-text student notes are NOT Quran/ayah annotations.
-- Owner-private only; no Sheikh/admin read or public-sharing API in this slice.
CREATE TABLE notebook_private_notes (
 id TEXT NOT NULL PRIMARY KEY CHECK(length(id)=36),
 learner_id TEXT NOT NULL,
 lesson_id TEXT NOT NULL,
 body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 500),
 version INTEGER NOT NULL CHECK(version>=1),
 visible INTEGER NOT NULL CHECK(visible IN (0,1)),
 updated_at_ms INTEGER NOT NULL CHECK(updated_at_ms>=0),
 FOREIGN KEY(lesson_id,learner_id) REFERENCES lessons(id,learner_id) ON DELETE RESTRICT
) STRICT;
CREATE INDEX notebook_private_notes_lookup ON notebook_private_notes(learner_id,lesson_id,visible,updated_at_ms DESC);

CREATE TABLE notebook_note_events (
 operation_id TEXT NOT NULL PRIMARY KEY CHECK(length(operation_id)=36),
 id TEXT NOT NULL CHECK(length(id)=36),
 learner_id TEXT NOT NULL,
 lesson_id TEXT NOT NULL,
 actor_auth_subject TEXT NOT NULL,
 action TEXT NOT NULL CHECK(action IN ('put','hide')),
 expected_version INTEGER NOT NULL CHECK(expected_version>=0),
 body TEXT NOT NULL CHECK(length(body)<=500),
 at_ms INTEGER NOT NULL CHECK(at_ms>=0),
 FOREIGN KEY(lesson_id,learner_id) REFERENCES lessons(id,learner_id) ON DELETE RESTRICT
) STRICT;
CREATE INDEX notebook_note_events_lesson ON notebook_note_events(learner_id,lesson_id,at_ms,operation_id);

CREATE TRIGGER notebook_event_guard BEFORE INSERT ON notebook_note_events
BEGIN
 SELECT RAISE(ABORT,'NOTEBOOK_ACCESS_DENIED') WHERE NOT EXISTS (
  SELECT 1 FROM lessons lesson
  JOIN learners student ON student.id=lesson.learner_id
  JOIN accounts owner ON owner.id=student.account_id
  WHERE lesson.id=NEW.lesson_id AND lesson.learner_id=NEW.learner_id
   AND student.status='active' AND owner.status='active'
   AND owner.auth_subject=NEW.actor_auth_subject
   AND lesson.status='completed' AND lesson.ended_at_ms IS NOT NULL
   AND lesson.ended_at_ms<=NEW.at_ms
   AND EXISTS (
    SELECT 1 FROM lesson_lifecycle_events e
    WHERE e.lesson_id=lesson.id AND e.action='end'
     AND e.teacher_id=lesson.actual_teacher_id AND e.at_ms=lesson.ended_at_ms
   )
 );
 SELECT RAISE(ABORT,'NOTEBOOK_BAD_BODY') WHERE
  (NEW.action='put' AND length(trim(NEW.body))=0)
   OR (NEW.action='hide' AND NEW.body!='');
 SELECT RAISE(ABORT,'NOTEBOOK_VERSION_CONFLICT') WHERE
   (NEW.expected_version=0 AND (NEW.action!='put'
     OR EXISTS (SELECT 1 FROM notebook_private_notes WHERE id=NEW.id)))
   OR (NEW.expected_version>0 AND NOT EXISTS (
     SELECT 1 FROM notebook_private_notes n WHERE n.id=NEW.id
      AND n.learner_id=NEW.learner_id AND n.lesson_id=NEW.lesson_id
      AND n.version=NEW.expected_version
      AND (NEW.action='put' OR n.visible=1)
   ));
 SELECT RAISE(ABORT,'NOTEBOOK_NOTE_LIMIT') WHERE NEW.action='put'
  AND NEW.expected_version=0 AND
  (SELECT COUNT(*) FROM notebook_private_notes n
   WHERE n.learner_id=NEW.learner_id AND n.lesson_id=NEW.lesson_id AND n.visible=1)>=100;
END;
CREATE TRIGGER notebook_event_apply AFTER INSERT ON notebook_note_events
BEGIN
 INSERT INTO notebook_private_notes(id,learner_id,lesson_id,body,version,visible,updated_at_ms)
 SELECT NEW.id,NEW.learner_id,NEW.lesson_id,trim(NEW.body),NEW.expected_version+1,1,NEW.at_ms
 WHERE NEW.action='put'
 ON CONFLICT(id) DO UPDATE SET
  body=excluded.body,visible=1,version=excluded.version,updated_at_ms=excluded.updated_at_ms;
 UPDATE notebook_private_notes SET visible=0,version=NEW.expected_version+1,
  updated_at_ms=NEW.at_ms WHERE id=NEW.id AND NEW.action='hide';
END;
CREATE TRIGGER notebook_event_immutable_update BEFORE UPDATE ON notebook_note_events
BEGIN SELECT RAISE(ABORT,'NOTEBOOK_EVENT_IMMUTABLE'); END;
CREATE TRIGGER notebook_event_immutable_delete BEFORE DELETE ON notebook_note_events
BEGIN SELECT RAISE(ABORT,'NOTEBOOK_EVENT_IMMUTABLE'); END;
INSERT INTO noor_schema_meta(component,version) VALUES('notebook_notes',1);
