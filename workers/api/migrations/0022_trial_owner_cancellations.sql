-- #244: guardians may cancel their own scheduled first-free-trial >=6h
-- before its start. Append-only provenance, no billing and no live cancellation.
-- Bind auto-created short-lived teacher grants to booking provenance first;
-- never revoke a pre-existing teacher assignment used by a booked trial.
CREATE TABLE trial_booking_auto_grants (
 booking_id TEXT NOT NULL PRIMARY KEY REFERENCES trial_booking_events(id) ON DELETE RESTRICT,
 assignment_id TEXT NOT NULL UNIQUE REFERENCES teacher_assignments(id) ON DELETE RESTRICT
) STRICT;

-- Change the *new*, not yet production-activated trial trigger from 0021:
-- deterministic grant IDs make safe, exact-purpose revocation possible.
DROP TRIGGER trial_booking_apply;
CREATE TRIGGER trial_booking_apply AFTER INSERT ON trial_booking_events
BEGIN
 INSERT INTO teacher_assignments(id,learner_id,teacher_id,starts_at_ms,ends_at_ms)
 SELECT 'trialgrant-'||NEW.id,NEW.learner_id,s.teacher_id,s.starts_at_ms,s.ends_at_ms
 FROM trial_open_slot_events s WHERE s.id=NEW.slot_id
 AND NOT EXISTS(SELECT 1 FROM teacher_assignments g
  WHERE g.learner_id=NEW.learner_id AND g.teacher_id=s.teacher_id
   AND g.revoked_at_ms IS NULL AND g.starts_at_ms<=s.starts_at_ms
   AND g.ends_at_ms>=s.ends_at_ms);
 INSERT INTO trial_booking_auto_grants(booking_id,assignment_id)
 SELECT NEW.id,'trialgrant-'||NEW.id FROM teacher_assignments g
 WHERE g.id='trialgrant-'||NEW.id;
 INSERT INTO lessons(id,learner_id,actual_teacher_id,kind,status,starts_at_ms,ends_at_ms)
 SELECT NEW.lesson_id,NEW.learner_id,s.teacher_id,'trial','scheduled',
  s.starts_at_ms,s.ends_at_ms
 FROM trial_open_slot_events s WHERE s.id=NEW.slot_id;
END;

CREATE TABLE trial_owner_cancellation_events (
 id TEXT NOT NULL PRIMARY KEY CHECK(length(id)=36),
 operation_id TEXT NOT NULL UNIQUE CHECK(length(operation_id)=36),
 lesson_id TEXT NOT NULL UNIQUE REFERENCES lessons(id) ON DELETE RESTRICT,
 learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE RESTRICT,
 actor_subject TEXT NOT NULL REFERENCES auth_users(id) ON DELETE RESTRICT,
 at_ms INTEGER NOT NULL CHECK(at_ms>=0)
) STRICT;
CREATE INDEX trial_cancel_owner ON trial_owner_cancellation_events(learner_id,at_ms DESC);
CREATE TRIGGER trial_owner_cancel_guard BEFORE INSERT ON trial_owner_cancellation_events
BEGIN
 SELECT RAISE(ABORT,'TRIAL_OWNER_DENIED') WHERE NOT EXISTS (
  SELECT 1 FROM learners child JOIN accounts a ON a.id=child.account_id
  JOIN trial_booking_events booked ON booked.learner_id=child.id
  JOIN lessons l ON l.id=booked.lesson_id
  WHERE child.id=NEW.learner_id AND child.status='active'
   AND a.auth_subject=NEW.actor_subject AND a.status='active'
   AND booked.lesson_id=NEW.lesson_id AND l.learner_id=child.id
   AND l.kind='trial' AND l.status='scheduled'
 );
 SELECT RAISE(ABORT,'TRIAL_CANCEL_TOO_LATE') WHERE NOT EXISTS(
  SELECT 1 FROM lessons l WHERE l.id=NEW.lesson_id
   AND l.learner_id=NEW.learner_id AND l.status='scheduled'
   AND l.starts_at_ms>=NEW.at_ms+21600000
 );
END;
CREATE TRIGGER trial_owner_cancel_apply AFTER INSERT ON trial_owner_cancellation_events
BEGIN
 UPDATE lessons SET status='cancelled'
 WHERE id=NEW.lesson_id AND learner_id=NEW.learner_id AND status='scheduled';
 -- Only a SHORT-LIVED grant created by this exact trial booking is revoked.
 -- Reused pre-existing permanent/current teacher assignments are untouched.
 UPDATE teacher_assignments SET revoked_at_ms=NEW.at_ms
 WHERE revoked_at_ms IS NULL AND id IN (
  SELECT g.assignment_id FROM trial_booking_auto_grants g
  JOIN trial_booking_events b ON b.id=g.booking_id
  WHERE b.lesson_id=NEW.lesson_id AND b.learner_id=NEW.learner_id
 );
END;
CREATE TRIGGER trial_cancel_no_update BEFORE UPDATE ON trial_owner_cancellation_events
BEGIN SELECT RAISE(ABORT,'TRIAL_CANCELLATION_IMMUTABLE'); END;
CREATE TRIGGER trial_cancel_no_delete BEFORE DELETE ON trial_owner_cancellation_events
BEGIN SELECT RAISE(ABORT,'TRIAL_CANCELLATION_IMMUTABLE'); END;
CREATE TRIGGER trial_auto_grant_no_update BEFORE UPDATE ON trial_booking_auto_grants
BEGIN SELECT RAISE(ABORT,'TRIAL_GRANT_MAPPING_IMMUTABLE'); END;
CREATE TRIGGER trial_auto_grant_no_delete BEFORE DELETE ON trial_booking_auto_grants
BEGIN SELECT RAISE(ABORT,'TRIAL_GRANT_MAPPING_IMMUTABLE'); END;

INSERT INTO noor_schema_meta(component,version) VALUES('trial_owner_cancel',1);
