-- CLASSROOM-02: append-only event ledger for explicit teacher Start/End.
-- Source: owner-approved classroom policy #7 and implementation plan #120.
-- This schema intentionally does NOT infer attendance or room presence from D1.
-- Connected participants are checked against the verified live DO room snapshot.
-- It also never auto-closes at either the 30m instruction or 40m reserved boundary.

CREATE TABLE lesson_lifecycle_events (
  id TEXT NOT NULL PRIMARY KEY CHECK(length(id) BETWEEN 8 AND 128),
  lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE RESTRICT,
  teacher_id TEXT NOT NULL REFERENCES teachers(id) ON DELETE RESTRICT,
  action TEXT NOT NULL CHECK(action IN ('start','end')),
  at_ms INTEGER NOT NULL CHECK(at_ms >= 0),
  operation_id TEXT NOT NULL UNIQUE CHECK(length(operation_id) BETWEEN 8 AND 128),
  UNIQUE(lesson_id, action)
) STRICT;
CREATE INDEX lesson_lifecycle_timeline
  ON lesson_lifecycle_events(lesson_id, at_ms, action);

-- A verified acting teacher must issue the action; the Worker is still
-- responsible for verifying Better Auth, per-lesson grant, connected learners,
-- and committing transition+event together. SQL protects mismatched actor IDs.
CREATE TRIGGER lesson_lifecycle_actor_insert
BEFORE INSERT ON lesson_lifecycle_events
BEGIN
  SELECT RAISE(ABORT, 'lesson lifecycle actor must be the acting teacher')
  WHERE NOT EXISTS (
    SELECT 1 FROM lessons l
    WHERE l.id = NEW.lesson_id AND l.actual_teacher_id = NEW.teacher_id
  );
END;

-- Prevent a forged start event before the persisted lesson goes live.
CREATE TRIGGER lesson_lifecycle_start_order
BEFORE INSERT ON lesson_lifecycle_events
WHEN NEW.action = 'start'
BEGIN
  SELECT RAISE(ABORT, 'start requires a live lesson')
  WHERE NOT EXISTS (
    SELECT 1 FROM lessons WHERE id = NEW.lesson_id AND status = 'live'
  );
END;

-- End is valid only for a teacher-completed lesson with actual end timestamp.
-- A prior START audit event must exist (new-classroom workflow). Historical
-- pre-migration records need no synthetic fabricated events.
CREATE TRIGGER lesson_lifecycle_end_order
BEFORE INSERT ON lesson_lifecycle_events
WHEN NEW.action = 'end'
BEGIN
  SELECT RAISE(ABORT, 'end requires completed lesson and recorded time')
  WHERE NOT EXISTS (
    SELECT 1 FROM lessons
    WHERE id = NEW.lesson_id AND status = 'completed' AND ended_at_ms IS NOT NULL
      AND ended_at_ms = NEW.at_ms
  );
  SELECT RAISE(ABORT, 'end requires preceding start')
  WHERE NOT EXISTS (
    SELECT 1 FROM lesson_lifecycle_events started
    WHERE started.lesson_id = NEW.lesson_id AND started.action = 'start'
      AND started.at_ms <= NEW.at_ms
  );
END;

CREATE TRIGGER lesson_lifecycle_event_immutable_update
BEFORE UPDATE ON lesson_lifecycle_events
BEGIN
  SELECT RAISE(ABORT, 'lesson lifecycle audit is immutable');
END;
CREATE TRIGGER lesson_lifecycle_event_immutable_delete
BEFORE DELETE ON lesson_lifecycle_events
BEGIN
  SELECT RAISE(ABORT, 'lesson lifecycle audit is immutable');
END;

INSERT INTO noor_schema_meta(component, version)
VALUES('classroom_lifecycle', 1);
