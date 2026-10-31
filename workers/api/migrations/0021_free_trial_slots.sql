-- #244: verified availability and atomic self-service FREE trial booking.
-- 30-minute teaching time, 40-minute internal reserved slot. No pricing,
-- payment, credits, family contact info or WhatsApp side effects.
CREATE TABLE trial_open_slot_events (
 id TEXT NOT NULL PRIMARY KEY CHECK(length(id)=36),
 operation_id TEXT NOT NULL UNIQUE CHECK(length(operation_id)=36),
 actor_subject TEXT NOT NULL REFERENCES auth_users(id) ON DELETE RESTRICT,
 teacher_id TEXT NOT NULL REFERENCES teachers(id) ON DELETE RESTRICT,
 starts_at_ms INTEGER NOT NULL CHECK(starts_at_ms>=0),
 ends_at_ms INTEGER NOT NULL CHECK(ends_at_ms=starts_at_ms+2400000),
 published_at_ms INTEGER NOT NULL CHECK(published_at_ms>=0),
 UNIQUE(teacher_id,starts_at_ms),
 CHECK(starts_at_ms>=published_at_ms AND starts_at_ms<=published_at_ms+2592000000)
) STRICT;
CREATE INDEX trial_open_slots_time ON trial_open_slot_events(starts_at_ms,teacher_id,id);
CREATE TRIGGER trial_slot_staff_guard BEFORE INSERT ON trial_open_slot_events
BEGIN
 SELECT RAISE(ABORT,'TRIAL_STAFF_DENIED') WHERE NOT EXISTS (
  SELECT 1 FROM staff_grants g JOIN auth_users u ON u.id=g.auth_subject
   JOIN accounts a ON a.auth_subject=u.id
  WHERE g.auth_subject=NEW.actor_subject AND g.permission='roles.manage'
   AND g.revoked_at_ms IS NULL AND u.phone_number_verified=1 AND a.status='active'
 );
 SELECT RAISE(ABORT,'TRIAL_TEACHER_UNAVAILABLE') WHERE NOT EXISTS(
  SELECT 1 FROM teachers t WHERE t.id=NEW.teacher_id
    AND t.status='active' AND t.qualified=1);
 SELECT RAISE(ABORT,'TRIAL_SLOT_OVERLAP') WHERE EXISTS(
  SELECT 1 FROM trial_open_slot_events s
  WHERE s.teacher_id=NEW.teacher_id
   AND s.starts_at_ms<NEW.ends_at_ms AND NEW.starts_at_ms<s.ends_at_ms);
 SELECT RAISE(ABORT,'TRIAL_SLOT_OCCUPIED') WHERE EXISTS(
  SELECT 1 FROM lessons l WHERE l.actual_teacher_id=NEW.teacher_id
   AND l.status<>'cancelled'
   AND l.starts_at_ms<NEW.ends_at_ms AND NEW.starts_at_ms<l.ends_at_ms);
END;
CREATE TRIGGER trial_slots_immutable_update BEFORE UPDATE ON trial_open_slot_events
BEGIN SELECT RAISE(ABORT,'TRIAL_SLOT_IMMUTABLE'); END;
CREATE TRIGGER trial_slots_immutable_delete BEFORE DELETE ON trial_open_slot_events
BEGIN SELECT RAISE(ABORT,'TRIAL_SLOT_IMMUTABLE'); END;

-- Staff may withdraw an unfilled advertised slot; a withdrawal does
-- NOT cancel an already booked lesson (that needs a separate staff decision).
CREATE TABLE trial_slot_closure_events (
 id TEXT NOT NULL PRIMARY KEY CHECK(length(id)=36),
 operation_id TEXT NOT NULL UNIQUE CHECK(length(operation_id)=36),
 slot_id TEXT NOT NULL UNIQUE REFERENCES trial_open_slot_events(id) ON DELETE RESTRICT,
 actor_subject TEXT NOT NULL REFERENCES auth_users(id) ON DELETE RESTRICT,
 reason TEXT NOT NULL CHECK(length(trim(reason)) BETWEEN 8 AND 500),
 at_ms INTEGER NOT NULL CHECK(at_ms>=0)
) STRICT;
CREATE TRIGGER trial_slot_close_guard BEFORE INSERT ON trial_slot_closure_events
BEGIN
 SELECT RAISE(ABORT,'TRIAL_STAFF_DENIED') WHERE NOT EXISTS(
  SELECT 1 FROM staff_grants g JOIN auth_users u ON u.id=g.auth_subject
  JOIN accounts a ON a.auth_subject=u.id WHERE g.auth_subject=NEW.actor_subject
   AND g.permission='roles.manage' AND g.revoked_at_ms IS NULL
   AND u.phone_number_verified=1 AND a.status='active');
 SELECT RAISE(ABORT,'TRIAL_SLOT_TOO_LATE') WHERE NOT EXISTS (
  SELECT 1 FROM trial_open_slot_events s WHERE s.id=NEW.slot_id
  AND NEW.at_ms<s.starts_at_ms);
END;
CREATE TRIGGER trial_slot_closure_no_update BEFORE UPDATE ON trial_slot_closure_events
BEGIN SELECT RAISE(ABORT,'TRIAL_SLOT_CLOSURE_IMMUTABLE'); END;
CREATE TRIGGER trial_slot_closure_no_delete BEFORE DELETE ON trial_slot_closure_events
BEGIN SELECT RAISE(ABORT,'TRIAL_SLOT_CLOSURE_IMMUTABLE'); END;

CREATE TABLE trial_booking_events (
 id TEXT NOT NULL PRIMARY KEY CHECK(length(id)=36),
 operation_id TEXT NOT NULL UNIQUE CHECK(length(operation_id)=36),
 lesson_id TEXT NOT NULL UNIQUE CHECK(length(lesson_id)=36),
 slot_id TEXT NOT NULL REFERENCES trial_open_slot_events(id) ON DELETE RESTRICT,
 learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE RESTRICT,
 actor_subject TEXT NOT NULL REFERENCES auth_users(id) ON DELETE RESTRICT,
 booked_at_ms INTEGER NOT NULL CHECK(booked_at_ms>=0)
) STRICT;
CREATE INDEX trial_bookings_child ON trial_booking_events(learner_id,booked_at_ms DESC);
CREATE INDEX trial_bookings_slot ON trial_booking_events(slot_id,booked_at_ms DESC);
CREATE TRIGGER trial_booking_owner_guard BEFORE INSERT ON trial_booking_events
BEGIN
 SELECT RAISE(ABORT,'TRIAL_OWNER_DENIED') WHERE NOT EXISTS(
  SELECT 1 FROM learners l JOIN accounts a ON a.id=l.account_id
  WHERE l.id=NEW.learner_id AND l.status='active'
   AND a.auth_subject=NEW.actor_subject AND a.status='active');
 SELECT RAISE(ABORT,'TRIAL_SLOT_UNAVAILABLE') WHERE NOT EXISTS(
  SELECT 1 FROM trial_open_slot_events s JOIN teachers t ON t.id=s.teacher_id
  WHERE s.id=NEW.slot_id AND t.status='active' AND t.qualified=1
   AND NOT EXISTS(SELECT 1 FROM trial_slot_closure_events c WHERE c.slot_id=s.id)
   AND s.starts_at_ms>=NEW.booked_at_ms AND
   s.starts_at_ms<=NEW.booked_at_ms+2592000000);
 SELECT RAISE(ABORT,'TRIAL_ALREADY_CONSUMED') WHERE EXISTS(
  SELECT 1 FROM lessons past WHERE past.learner_id=NEW.learner_id
   AND past.kind='trial' AND past.status<>'cancelled');
 SELECT RAISE(ABORT,'TRIAL_SLOT_UNAVAILABLE') WHERE EXISTS(
  SELECT 1 FROM trial_open_slot_events s JOIN lessons l
  ON (l.actual_teacher_id=s.teacher_id OR l.learner_id=NEW.learner_id)
  WHERE s.id=NEW.slot_id AND l.status<>'cancelled'
    AND l.starts_at_ms<s.ends_at_ms AND s.starts_at_ms<l.ends_at_ms);
 SELECT RAISE(ABORT,'TRIAL_TEACHER_ASSIGNMENT_CONFLICT') WHERE EXISTS(
  SELECT 1 FROM trial_open_slot_events s JOIN teacher_assignments a
   ON a.learner_id=NEW.learner_id AND a.teacher_id<>s.teacher_id
  WHERE s.id=NEW.slot_id AND a.revoked_at_ms IS NULL
   AND a.starts_at_ms<s.ends_at_ms AND s.starts_at_ms<a.ends_at_ms);
END;
-- One source INSERT makes the student grant and 40-minute trial lesson real
-- in exactly one D1 transaction. Existing overlapping grant for SAME Sheikh
-- is reused; wrong-teacher grants are rejected by the BEFORE trigger.
CREATE TRIGGER trial_booking_apply AFTER INSERT ON trial_booking_events
BEGIN
 INSERT INTO teacher_assignments(id,learner_id,teacher_id,starts_at_ms,ends_at_ms)
 SELECT lower(hex(randomblob(16))),NEW.learner_id,s.teacher_id,s.starts_at_ms,s.ends_at_ms
 FROM trial_open_slot_events s WHERE s.id=NEW.slot_id
 AND NOT EXISTS(SELECT 1 FROM teacher_assignments g
  WHERE g.learner_id=NEW.learner_id AND g.teacher_id=s.teacher_id
   AND g.revoked_at_ms IS NULL AND g.starts_at_ms<=s.starts_at_ms
   AND g.ends_at_ms>=s.ends_at_ms);
 INSERT INTO lessons(id,learner_id,actual_teacher_id,kind,status,starts_at_ms,ends_at_ms)
 SELECT NEW.lesson_id,NEW.learner_id,s.teacher_id,'trial','scheduled',
  s.starts_at_ms,s.ends_at_ms
 FROM trial_open_slot_events s WHERE s.id=NEW.slot_id;
END;
CREATE TRIGGER trial_booking_no_update BEFORE UPDATE ON trial_booking_events
BEGIN SELECT RAISE(ABORT,'TRIAL_BOOKING_IMMUTABLE'); END;
CREATE TRIGGER trial_booking_no_delete BEFORE DELETE ON trial_booking_events
BEGIN SELECT RAISE(ABORT,'TRIAL_BOOKING_IMMUTABLE'); END;
INSERT INTO noor_schema_meta(component,version) VALUES('free_trial_booking',1);
