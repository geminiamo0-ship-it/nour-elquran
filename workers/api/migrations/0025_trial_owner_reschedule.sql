-- #244 migration 0025; requires reviewed 0024_trial_slot_close_booking_guard.sql (#280) before Dev rollout.
-- #244: atomic first-free-trial reschedule. One INSERT either commits BOTH
-- cancellation of the former scheduled trial and its replacement, or neither.
-- No prices, payments, automatic penalties, provider messages or child media.
CREATE TABLE trial_owner_reschedule_events (
 id TEXT NOT NULL PRIMARY KEY CHECK(length(id)=36),
 operation_id TEXT NOT NULL UNIQUE CHECK(length(operation_id)=36),
 old_lesson_id TEXT NOT NULL UNIQUE REFERENCES lessons(id) ON DELETE RESTRICT,
 new_lesson_id TEXT NOT NULL UNIQUE CHECK(length(new_lesson_id)=36),
 new_slot_id TEXT NOT NULL REFERENCES trial_open_slot_events(id) ON DELETE RESTRICT,
 learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE RESTRICT,
 actor_subject TEXT NOT NULL REFERENCES auth_users(id) ON DELETE RESTRICT,
 at_ms INTEGER NOT NULL CHECK(at_ms>=0)
) STRICT;
CREATE INDEX trial_reschedule_child ON trial_owner_reschedule_events(learner_id,at_ms DESC);

CREATE TRIGGER trial_owner_reschedule_guard BEFORE INSERT ON trial_owner_reschedule_events
BEGIN
 SELECT RAISE(ABORT,'TRIAL_RESCHEDULE_OWNER_DENIED') WHERE NOT EXISTS(
  SELECT 1 FROM learners child JOIN accounts a ON a.id=child.account_id
  JOIN trial_booking_events booked ON booked.learner_id=child.id
  JOIN lessons old ON old.id=booked.lesson_id
  WHERE child.id=NEW.learner_id AND child.status='active'
   AND a.auth_subject=NEW.actor_subject AND a.status='active'
   AND booked.lesson_id=NEW.old_lesson_id
   AND old.kind='trial' AND old.status='scheduled'
   AND old.learner_id=NEW.learner_id
 );
 SELECT RAISE(ABORT,'TRIAL_RESCHEDULE_TOO_LATE') WHERE NOT EXISTS(
  SELECT 1 FROM lessons old WHERE old.id=NEW.old_lesson_id
   AND old.status='scheduled' AND old.starts_at_ms>=NEW.at_ms+21600000
 );
 SELECT RAISE(ABORT,'TRIAL_RESCHEDULE_SLOT_UNAVAILABLE') WHERE NOT EXISTS(
  SELECT 1 FROM trial_open_slot_events s
   JOIN teachers teacher ON teacher.id=s.teacher_id
   JOIN trial_booking_events prev ON prev.lesson_id=NEW.old_lesson_id
  WHERE s.id=NEW.new_slot_id AND s.id<>prev.slot_id
   AND teacher.status='active' AND teacher.qualified=1
   AND s.starts_at_ms>=NEW.at_ms
   AND s.starts_at_ms<=NEW.at_ms+2592000000
   AND NOT EXISTS(SELECT 1 FROM trial_slot_closure_events closed
     WHERE closed.slot_id=s.id)
 );
 -- Exclude ONLY the old lesson, which is cancelled by the same transaction.
 SELECT RAISE(ABORT,'TRIAL_RESCHEDULE_SLOT_OCCUPIED') WHERE EXISTS(
  SELECT 1 FROM trial_open_slot_events s JOIN lessons l
   ON (l.actual_teacher_id=s.teacher_id OR l.learner_id=NEW.learner_id)
  WHERE s.id=NEW.new_slot_id AND l.id<>NEW.old_lesson_id
   AND l.status<>'cancelled'
   AND l.starts_at_ms<s.ends_at_ms AND s.starts_at_ms<l.ends_at_ms
 );
 -- Existing grants for another teacher block the new window unless they
 -- originated from precisely this booking and will be revoked atomically.
 SELECT RAISE(ABORT,'TRIAL_RESCHEDULE_GRANT_CONFLICT') WHERE EXISTS(
  SELECT 1 FROM trial_open_slot_events s
  JOIN teacher_assignments g ON g.learner_id=NEW.learner_id
   AND g.teacher_id<>s.teacher_id AND g.revoked_at_ms IS NULL
   AND g.starts_at_ms<s.ends_at_ms AND s.starts_at_ms<g.ends_at_ms
  WHERE s.id=NEW.new_slot_id AND NOT EXISTS(
   SELECT 1 FROM trial_booking_auto_grants auto
    JOIN trial_booking_events oldbook ON oldbook.id=auto.booking_id
   WHERE oldbook.lesson_id=NEW.old_lesson_id AND auto.assignment_id=g.id
  )
 );
END;

CREATE TRIGGER trial_owner_reschedule_apply AFTER INSERT ON trial_owner_reschedule_events
BEGIN
 UPDATE lessons SET status='cancelled'
  WHERE id=NEW.old_lesson_id AND learner_id=NEW.learner_id AND status='scheduled';
 UPDATE teacher_assignments SET revoked_at_ms=NEW.at_ms
  WHERE revoked_at_ms IS NULL AND id IN(
   SELECT auto.assignment_id FROM trial_booking_auto_grants auto
   JOIN trial_booking_events booked ON booked.id=auto.booking_id
   WHERE booked.lesson_id=NEW.old_lesson_id AND booked.learner_id=NEW.learner_id
  );
 -- Existing booking SQL guards and triggers create the replacement classroom,
 -- short-lived grant when needed, and the normal learner/teacher inbox event.
 -- A failure of any later constraint rolls back the earlier UPDATEs.
 INSERT INTO trial_booking_events(id,operation_id,lesson_id,slot_id,
    learner_id,actor_subject,booked_at_ms)
 VALUES(NEW.id,NEW.id,NEW.new_lesson_id,NEW.new_slot_id,
    NEW.learner_id,NEW.actor_subject,NEW.at_ms);
END;
CREATE TRIGGER trial_reschedule_immutable_update BEFORE UPDATE ON trial_owner_reschedule_events
BEGIN SELECT RAISE(ABORT,'TRIAL_RESCHEDULE_IMMUTABLE'); END;
CREATE TRIGGER trial_reschedule_immutable_delete BEFORE DELETE ON trial_owner_reschedule_events
BEGIN SELECT RAISE(ABORT,'TRIAL_RESCHEDULE_IMMUTABLE'); END;
INSERT INTO noor_schema_meta(component,version) VALUES('trial_owner_reschedule',1);
