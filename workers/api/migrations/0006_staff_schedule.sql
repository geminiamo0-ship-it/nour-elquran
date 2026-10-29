-- B3: staff scheduling commands are immutable events; each row and its data
-- mutation commit atomically in D1 (one INSERT). No API can inject a staff role.
CREATE TABLE staff_schedule_events (
 id TEXT NOT NULL PRIMARY KEY,
 operation_id TEXT NOT NULL UNIQUE CHECK(length(operation_id) BETWEEN 8 AND 128),
 actor_auth_subject TEXT NOT NULL REFERENCES auth_users(id) ON DELETE RESTRICT,
 action TEXT NOT NULL CHECK(action IN ('assign','revoke','book','cancel')),
 resource_id TEXT NOT NULL CHECK(length(resource_id) BETWEEN 1 AND 128),
 learner_id TEXT NOT NULL DEFAULT '',
 teacher_id TEXT NOT NULL DEFAULT '',
 starts_at_ms INTEGER,
 ends_at_ms INTEGER,
 lesson_kind TEXT,
 reason TEXT NOT NULL CHECK(length(trim(reason)) BETWEEN 8 AND 500),
 at_ms INTEGER NOT NULL CHECK(at_ms >= 0),
 CHECK (
  (action='assign' AND length(learner_id)>0 AND length(teacher_id)>0
   AND starts_at_ms IS NOT NULL AND ends_at_ms IS NOT NULL
   AND lesson_kind IS NULL)
  OR (action='book' AND length(learner_id)>0 AND length(teacher_id)>0
   AND starts_at_ms IS NOT NULL AND ends_at_ms IS NOT NULL
   AND lesson_kind IN ('trial','standard','makeup'))
  OR (action IN ('revoke','cancel') AND learner_id='' AND teacher_id=''
   AND starts_at_ms IS NULL AND ends_at_ms IS NULL AND lesson_kind IS NULL)
 )
) STRICT;
CREATE INDEX staff_schedule_by_actor ON staff_schedule_events(actor_auth_subject,at_ms DESC,id);
CREATE INDEX staff_schedule_by_resource ON staff_schedule_events(resource_id,at_ms DESC,id);

-- Guard every event at SQL-write time (not just a prior Worker read): late
-- grant revocation and malicious direct writes fail atomically.
CREATE TRIGGER staff_schedule_validate BEFORE INSERT ON staff_schedule_events
BEGIN
 SELECT RAISE(ABORT,'unverified staff')
 WHERE NOT EXISTS(
  SELECT 1 FROM staff_grants g
  JOIN auth_users actor ON actor.id=g.auth_subject
  JOIN accounts account ON account.auth_subject=actor.id
  WHERE g.auth_subject=NEW.actor_auth_subject AND g.permission='roles.manage'
    AND g.revoked_at_ms IS NULL AND actor.phone_number_verified=1
    AND account.status='active'
 );
 SELECT RAISE(ABORT,'invalid scheduling window')
 WHERE NEW.action IN ('assign','book') AND
   (NEW.starts_at_ms < NEW.at_ms OR NEW.ends_at_ms <= NEW.starts_at_ms
    OR NEW.ends_at_ms > NEW.at_ms+63244800000);
 SELECT RAISE(ABORT,'booking duration must be 40 minutes')
 WHERE NEW.action='book' AND NEW.ends_at_ms-NEW.starts_at_ms != 2400000;
 SELECT RAISE(ABORT,'learner or teacher unavailable')
 WHERE NEW.action IN ('assign','book') AND NOT EXISTS(
  SELECT 1 FROM learners learner
  JOIN accounts owner ON owner.id=learner.account_id
  JOIN teachers teacher ON teacher.id=NEW.teacher_id
  WHERE learner.id=NEW.learner_id AND learner.status='active'
    AND owner.status='active' AND teacher.qualified=1 AND teacher.status='active'
 );
 -- Assignment must cover *entire* reserved slot, not just start.
 SELECT RAISE(ABORT,'no active primary assignment covers booking')
 WHERE NEW.action='book' AND NOT EXISTS(
  SELECT 1 FROM teacher_assignments a
  WHERE a.learner_id=NEW.learner_id AND a.teacher_id=NEW.teacher_id
   AND a.revoked_at_ms IS NULL
   AND a.starts_at_ms<=NEW.starts_at_ms AND a.ends_at_ms>=NEW.ends_at_ms
 );
 SELECT RAISE(ABORT,'primary assignment not active')
 WHERE NEW.action='revoke' AND NOT EXISTS(
  SELECT 1 FROM teacher_assignments a WHERE a.id=NEW.resource_id
   AND a.revoked_at_ms IS NULL AND a.ends_at_ms>NEW.at_ms
 );
 -- Bookings must be cancelled/reassigned first; never orphan a scheduled
 -- lesson or strip authorization for an ongoing session via assignment revoke.
 SELECT RAISE(ABORT,'cancel outstanding lessons before assignment revoke')
 WHERE NEW.action='revoke' AND EXISTS(
  SELECT 1 FROM teacher_assignments a
  JOIN lessons lesson ON lesson.learner_id=a.learner_id
    AND lesson.actual_teacher_id=a.teacher_id
  WHERE a.id=NEW.resource_id AND lesson.status IN ('scheduled','live')
    AND lesson.starts_at_ms<a.ends_at_ms AND lesson.ends_at_ms>a.starts_at_ms
 );
 SELECT RAISE(ABORT,'cancellation requires scheduled lesson six hours ahead')
 WHERE NEW.action='cancel' AND NOT EXISTS(
  SELECT 1 FROM lessons l WHERE l.id=NEW.resource_id
   AND l.status='scheduled' AND l.starts_at_ms>=NEW.at_ms+21600000
 );
END;

-- Existing 0001 primary assignment exclusion and 0003 schedule conflict,
-- qualification, booking state and 40m triggers still apply to these writes.
CREATE TRIGGER staff_schedule_apply AFTER INSERT ON staff_schedule_events
BEGIN
 INSERT INTO teacher_assignments(id,learner_id,teacher_id,starts_at_ms,ends_at_ms)
 SELECT NEW.resource_id,NEW.learner_id,NEW.teacher_id,NEW.starts_at_ms,NEW.ends_at_ms
 WHERE NEW.action='assign';
 UPDATE teacher_assignments SET revoked_at_ms=NEW.at_ms
 WHERE NEW.action='revoke' AND id=NEW.resource_id;
 INSERT INTO lessons(id,learner_id,actual_teacher_id,kind,status,starts_at_ms,ends_at_ms)
 SELECT NEW.resource_id,NEW.learner_id,NEW.teacher_id,NEW.lesson_kind,
        'scheduled',NEW.starts_at_ms,NEW.ends_at_ms WHERE NEW.action='book';
 UPDATE lessons SET status='cancelled'
 WHERE NEW.action='cancel' AND id=NEW.resource_id;
END;
CREATE TRIGGER staff_schedule_immutable_update BEFORE UPDATE ON staff_schedule_events
BEGIN SELECT RAISE(ABORT,'staff scheduling audit immutable'); END;
CREATE TRIGGER staff_schedule_immutable_delete BEFORE DELETE ON staff_schedule_events
BEGIN SELECT RAISE(ABORT,'staff scheduling audit immutable'); END;

INSERT INTO noor_schema_meta(component,version) VALUES('staff_schedule',1);
