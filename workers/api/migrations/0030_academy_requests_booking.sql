-- #315: owner trial confirmation requests and atomic academic paid bookings.
-- This migration adds event-driven staff approvals; no gateway or bank integration.
CREATE TABLE academy_trial_request_events (
 id TEXT NOT NULL PRIMARY KEY CHECK(length(id)=36),
 operation_id TEXT NOT NULL UNIQUE CHECK(length(operation_id)=36),
 learner_id TEXT NOT NULL REFERENCES learners(id),
 slot_id TEXT NOT NULL REFERENCES trial_open_slot_events(id),
 actor_subject TEXT NOT NULL REFERENCES auth_users(id),
 requested_at_ms INTEGER NOT NULL CHECK(requested_at_ms>=0)
) STRICT;
CREATE INDEX academy_trial_requests_by_learner ON academy_trial_request_events(learner_id,requested_at_ms DESC);
CREATE TABLE academy_trial_decision_events (
 id TEXT NOT NULL PRIMARY KEY CHECK(length(id)=36),
 operation_id TEXT NOT NULL UNIQUE CHECK(length(operation_id)=36),
 request_id TEXT NOT NULL UNIQUE REFERENCES academy_trial_request_events(id),
 actor_subject TEXT NOT NULL REFERENCES auth_users(id),
 decision TEXT NOT NULL CHECK(decision IN ('approved','rejected')),
 lesson_id TEXT UNIQUE CHECK(lesson_id IS NULL OR length(lesson_id)=36),
 reason TEXT NOT NULL CHECK(length(trim(reason)) BETWEEN 8 AND 500),
 at_ms INTEGER NOT NULL CHECK(at_ms>=0),
 CHECK((decision='approved' AND lesson_id IS NOT NULL) OR
       (decision='rejected' AND lesson_id IS NULL))
) STRICT;
CREATE TABLE academy_paid_booking_events (
 id TEXT NOT NULL PRIMARY KEY CHECK(length(id)=36),
 operation_id TEXT NOT NULL UNIQUE CHECK(length(operation_id)=36),
 lesson_id TEXT NOT NULL UNIQUE CHECK(length(lesson_id)=36),
 learner_id TEXT NOT NULL REFERENCES learners(id),
 teacher_id TEXT NOT NULL REFERENCES teachers(id),
 cycle_id TEXT NOT NULL REFERENCES subscription_cycles(id),
 actor_subject TEXT NOT NULL REFERENCES auth_users(id),
 starts_at_ms INTEGER NOT NULL,
 ends_at_ms INTEGER NOT NULL CHECK(ends_at_ms=starts_at_ms+2400000),
 reason TEXT NOT NULL CHECK(length(trim(reason)) BETWEEN 8 AND 500),
 at_ms INTEGER NOT NULL CHECK(at_ms>=0)
) STRICT;
CREATE INDEX academy_paid_booking_learner ON academy_paid_booking_events(learner_id,starts_at_ms);

CREATE TRIGGER academy_trial_request_guard BEFORE INSERT ON academy_trial_request_events BEGIN
 SELECT RAISE(ABORT,'ACADEMY_OWNER_DENIED') WHERE NOT EXISTS(
 SELECT 1 FROM learners l JOIN accounts a ON a.id=l.account_id
 WHERE l.id=NEW.learner_id AND a.auth_subject=NEW.actor_subject
 AND l.status='active' AND a.status='active');
 SELECT RAISE(ABORT,'ACADEMY_TRIAL_USED') WHERE EXISTS(
 SELECT 1 FROM lessons l WHERE l.learner_id=NEW.learner_id
 AND l.kind='trial' AND l.status<>'cancelled');
 SELECT RAISE(ABORT,'ACADEMY_TRIAL_SLOT_UNAVAILABLE') WHERE NOT EXISTS(
 SELECT 1 FROM trial_open_slot_events s JOIN teachers t ON t.id=s.teacher_id
 WHERE s.id=NEW.slot_id AND t.status='active' AND t.qualified=1
  AND s.starts_at_ms>NEW.requested_at_ms AND
  s.starts_at_ms<=NEW.requested_at_ms+2592000000
  AND NOT EXISTS(SELECT 1 FROM trial_slot_closure_events x WHERE x.slot_id=s.id)
  AND NOT EXISTS(SELECT 1 FROM trial_booking_events x WHERE x.slot_id=s.id));
 SELECT RAISE(ABORT,'ACADEMY_TRIAL_REQUEST_PENDING') WHERE EXISTS(
 SELECT 1 FROM academy_trial_request_events r WHERE r.learner_id=NEW.learner_id
 AND NOT EXISTS(SELECT 1 FROM academy_trial_decision_events d WHERE d.request_id=r.id));
END;
CREATE TRIGGER academy_trial_decision_guard BEFORE INSERT ON academy_trial_decision_events BEGIN
 SELECT RAISE(ABORT,'ACADEMY_STAFF_DENIED') WHERE NOT EXISTS(
 SELECT 1 FROM staff_grants g JOIN auth_users u ON u.id=g.auth_subject
 JOIN accounts a ON a.auth_subject=u.id WHERE g.auth_subject=NEW.actor_subject
 AND g.permission='roles.manage' AND g.revoked_at_ms IS NULL
 AND u.phone_number_verified=1 AND a.status='active');
 SELECT RAISE(ABORT,'ACADEMY_TRIAL_REQUEST_EXPIRED') WHERE NEW.decision='approved' AND NOT EXISTS(
 SELECT 1 FROM academy_trial_request_events req
 JOIN trial_open_slot_events slot ON slot.id=req.slot_id
 WHERE req.id=NEW.request_id AND slot.starts_at_ms>NEW.at_ms);
END;
-- Existing trial booking guard authenticates the original owner even though
-- the decision was staff authorized. All booking, grant and lesson writes are
-- part of the same D1 transaction; a conflict rolls the review back.
CREATE TRIGGER academy_trial_decision_apply AFTER INSERT ON academy_trial_decision_events BEGIN
 INSERT INTO trial_booking_events(id,operation_id,lesson_id,slot_id,learner_id,
  actor_subject,booked_at_ms)
 SELECT lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-4'||
  substr(hex(randomblob(2)),2,3)||'-a'||substr(hex(randomblob(2)),2,3)||
  '-'||hex(randomblob(6))),NEW.operation_id,NEW.lesson_id,req.slot_id,
  req.learner_id,req.actor_subject,NEW.at_ms
 FROM academy_trial_request_events req WHERE NEW.decision='approved' AND req.id=NEW.request_id;
END;
CREATE TRIGGER academy_paid_booking_guard BEFORE INSERT ON academy_paid_booking_events BEGIN
 SELECT RAISE(ABORT,'ACADEMY_STAFF_DENIED') WHERE NOT EXISTS (
 SELECT 1 FROM staff_grants g JOIN auth_users u ON u.id=g.auth_subject
 JOIN accounts a ON a.auth_subject=u.id WHERE g.auth_subject=NEW.actor_subject
 AND g.permission='roles.manage' AND g.revoked_at_ms IS NULL
 AND u.phone_number_verified=1 AND a.status='active');
 SELECT RAISE(ABORT,'ACADEMY_PAID_WINDOW_INVALID') WHERE NEW.starts_at_ms<NEW.at_ms
  OR NEW.ends_at_ms>NEW.at_ms+2592000000;
 SELECT RAISE(ABORT,'ACADEMY_PAID_ASSIGNMENT_MISSING') WHERE NOT EXISTS(
 SELECT 1 FROM teacher_assignments g JOIN teachers t ON t.id=g.teacher_id
 JOIN learners l ON l.id=g.learner_id JOIN accounts a ON a.id=l.account_id
 WHERE g.learner_id=NEW.learner_id AND g.teacher_id=NEW.teacher_id
  AND g.revoked_at_ms IS NULL AND g.starts_at_ms<=NEW.starts_at_ms
  AND g.ends_at_ms>=NEW.ends_at_ms AND t.qualified=1 AND t.status='active'
  AND l.status='active' AND a.status='active');
 SELECT RAISE(ABORT,'ACADEMY_PAID_CYCLE_INVALID') WHERE NOT EXISTS(
 SELECT 1 FROM subscription_cycles c
 WHERE c.id=NEW.cycle_id AND c.learner_id=NEW.learner_id
 AND NEW.at_ms>=c.starts_at_ms AND NEW.at_ms<c.ends_at_ms
 AND NEW.starts_at_ms>=c.starts_at_ms AND NEW.starts_at_ms<c.ends_at_ms
 AND (SELECT COUNT(*) FROM subscription_spend_events e
 WHERE e.source_kind='cycle' AND e.source_id=c.id)<c.base_sessions+c.rollover_sessions);
END;
CREATE TRIGGER academy_paid_booking_apply AFTER INSERT ON academy_paid_booking_events BEGIN
 INSERT INTO lessons(id,learner_id,actual_teacher_id,kind,status,starts_at_ms,ends_at_ms)
 VALUES(NEW.lesson_id,NEW.learner_id,NEW.teacher_id,'standard','scheduled',
 NEW.starts_at_ms,NEW.ends_at_ms);
 INSERT INTO subscription_spend_events(id,operation_id,learner_id,lesson_id,
 actor_subject,source_kind,source_id,at_ms)
 VALUES(lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-4'||
  substr(hex(randomblob(2)),2,3)||'-a'||substr(hex(randomblob(2)),2,3)||
  '-'||hex(randomblob(6))),NEW.operation_id,NEW.learner_id,NEW.lesson_id,
 NEW.actor_subject,'cycle',NEW.cycle_id,NEW.at_ms);
END;
CREATE TRIGGER academy_trial_request_events_immutable_update BEFORE UPDATE ON academy_trial_request_events BEGIN SELECT RAISE(ABORT,'ACADEMY_IMMUTABLE'); END;
CREATE TRIGGER academy_trial_request_events_immutable_delete BEFORE DELETE ON academy_trial_request_events BEGIN SELECT RAISE(ABORT,'ACADEMY_IMMUTABLE'); END;
CREATE TRIGGER academy_trial_decision_events_immutable_update BEFORE UPDATE ON academy_trial_decision_events BEGIN SELECT RAISE(ABORT,'ACADEMY_IMMUTABLE'); END;
CREATE TRIGGER academy_trial_decision_events_immutable_delete BEFORE DELETE ON academy_trial_decision_events BEGIN SELECT RAISE(ABORT,'ACADEMY_IMMUTABLE'); END;
CREATE TRIGGER academy_paid_booking_events_immutable_update BEFORE UPDATE ON academy_paid_booking_events BEGIN SELECT RAISE(ABORT,'ACADEMY_IMMUTABLE'); END;
CREATE TRIGGER academy_paid_booking_events_immutable_delete BEFORE DELETE ON academy_paid_booking_events BEGIN SELECT RAISE(ABORT,'ACADEMY_IMMUTABLE'); END;
INSERT INTO noor_schema_meta(component,version) VALUES('academy_requests_and_booking',1);
