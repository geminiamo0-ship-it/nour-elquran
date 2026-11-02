-- #317: immutable guardian paid-lesson slot proposals and staff decisions.
-- A request never books a lesson or spends a cycle unit. Only a verified
-- staff approval atomically invokes the existing #315 paid booking trigger.
-- Staff-published PAID availability is distinct from free trial slots.
-- No guardian may invent a time by supplying a valid-looking timestamp.
CREATE TABLE academy_paid_open_slot_events (
 id TEXT PRIMARY KEY NOT NULL CHECK(length(id)=36),
 operation_id TEXT NOT NULL UNIQUE CHECK(length(operation_id)=36),
 teacher_id TEXT NOT NULL REFERENCES teachers(id),
 actor_subject TEXT NOT NULL REFERENCES auth_users(id),
 starts_at_ms INTEGER NOT NULL,
 ends_at_ms INTEGER NOT NULL CHECK(ends_at_ms=starts_at_ms+2400000),
 published_at_ms INTEGER NOT NULL CHECK(published_at_ms>=0),
 UNIQUE(teacher_id,starts_at_ms)
) STRICT;
CREATE INDEX academy_paid_open_slots_time
 ON academy_paid_open_slot_events(starts_at_ms,teacher_id,id);
CREATE TRIGGER academy_paid_open_slot_guard
BEFORE INSERT ON academy_paid_open_slot_events BEGIN
 SELECT RAISE(ABORT,'ACADEMY_STAFF_DENIED') WHERE NOT EXISTS(
  SELECT 1 FROM staff_grants g JOIN auth_users u ON u.id=g.auth_subject
  JOIN accounts a ON a.auth_subject=u.id
  WHERE g.auth_subject=NEW.actor_subject AND g.permission='roles.manage'
   AND g.revoked_at_ms IS NULL AND u.phone_number_verified=1
   AND a.status='active');
 SELECT RAISE(ABORT,'ACADEMY_PAID_OFFER_WINDOW') WHERE
  NEW.starts_at_ms<=NEW.published_at_ms+60000 OR
  NEW.ends_at_ms>NEW.published_at_ms+2592000000;
 SELECT RAISE(ABORT,'ACADEMY_PAID_OFFER_TEACHER') WHERE NOT EXISTS(
  SELECT 1 FROM teachers t WHERE t.id=NEW.teacher_id
   AND t.status='active' AND t.qualified=1);
 SELECT RAISE(ABORT,'ACADEMY_PAID_OFFER_OVERLAP') WHERE EXISTS(
  SELECT 1 FROM academy_paid_open_slot_events s
  WHERE s.teacher_id=NEW.teacher_id
   AND NOT EXISTS(SELECT 1 FROM academy_paid_open_slot_closure_events x
    WHERE x.slot_id=s.id)
   AND s.starts_at_ms<NEW.ends_at_ms AND s.ends_at_ms>NEW.starts_at_ms);
 SELECT RAISE(ABORT,'ACADEMY_PAID_OFFER_OCCUPIED') WHERE EXISTS(
  SELECT 1 FROM lessons l WHERE l.actual_teacher_id=NEW.teacher_id
   AND l.status IN ('scheduled','live')
   AND l.starts_at_ms<NEW.ends_at_ms AND l.ends_at_ms>NEW.starts_at_ms);
 SELECT RAISE(ABORT,'ACADEMY_PAID_OFFER_TRIAL_CONFLICT') WHERE EXISTS(
  SELECT 1 FROM trial_open_slot_events t WHERE t.teacher_id=NEW.teacher_id
   AND NOT EXISTS(SELECT 1 FROM trial_slot_closure_events x WHERE x.slot_id=t.id)
   AND t.starts_at_ms<NEW.ends_at_ms AND t.ends_at_ms>NEW.starts_at_ms);
END;
CREATE TABLE academy_paid_open_slot_closure_events (
 id TEXT PRIMARY KEY NOT NULL CHECK(length(id)=36),
 operation_id TEXT NOT NULL UNIQUE CHECK(length(operation_id)=36),
 slot_id TEXT NOT NULL UNIQUE REFERENCES academy_paid_open_slot_events(id),
 actor_subject TEXT NOT NULL REFERENCES auth_users(id),
 reason TEXT NOT NULL CHECK(length(trim(reason)) BETWEEN 8 AND 500),
 at_ms INTEGER NOT NULL CHECK(at_ms>=0)
) STRICT;
CREATE TRIGGER academy_paid_open_slot_close_guard
BEFORE INSERT ON academy_paid_open_slot_closure_events BEGIN
 SELECT RAISE(ABORT,'ACADEMY_STAFF_DENIED') WHERE NOT EXISTS(
  SELECT 1 FROM staff_grants g JOIN auth_users u ON u.id=g.auth_subject
  JOIN accounts a ON a.auth_subject=u.id
  WHERE g.auth_subject=NEW.actor_subject AND g.permission='roles.manage'
   AND g.revoked_at_ms IS NULL AND u.phone_number_verified=1
   AND a.status='active');
 SELECT RAISE(ABORT,'ACADEMY_PAID_OFFER_CLOSE_DENIED') WHERE NOT EXISTS(
  SELECT 1 FROM academy_paid_open_slot_events s
  WHERE s.id=NEW.slot_id AND NEW.at_ms>=s.published_at_ms
   AND NEW.at_ms<s.starts_at_ms
   AND NOT EXISTS(SELECT 1 FROM lessons l
    WHERE l.actual_teacher_id=s.teacher_id AND l.status IN ('scheduled','live')
     AND l.starts_at_ms<s.ends_at_ms AND l.ends_at_ms>s.starts_at_ms));
END;
CREATE TRIGGER academy_paid_open_slot_no_update
 BEFORE UPDATE ON academy_paid_open_slot_events
 BEGIN SELECT RAISE(ABORT,'ACADEMY_IMMUTABLE'); END;
CREATE TRIGGER academy_paid_open_slot_no_delete
 BEFORE DELETE ON academy_paid_open_slot_events
 BEGIN SELECT RAISE(ABORT,'ACADEMY_IMMUTABLE'); END;
CREATE TRIGGER academy_paid_open_slot_close_no_update
 BEFORE UPDATE ON academy_paid_open_slot_closure_events
 BEGIN SELECT RAISE(ABORT,'ACADEMY_IMMUTABLE'); END;
CREATE TRIGGER academy_paid_open_slot_close_no_delete
 BEFORE DELETE ON academy_paid_open_slot_closure_events
 BEGIN SELECT RAISE(ABORT,'ACADEMY_IMMUTABLE'); END;

CREATE TABLE academy_paid_slot_request_events (
 id TEXT PRIMARY KEY NOT NULL CHECK(length(id)=36),
 operation_id TEXT NOT NULL UNIQUE CHECK(length(operation_id)=36),
 learner_id TEXT NOT NULL REFERENCES learners(id),
 teacher_id TEXT NOT NULL REFERENCES teachers(id),
 cycle_id TEXT NOT NULL REFERENCES subscription_cycles(id),
 actor_subject TEXT NOT NULL REFERENCES auth_users(id),
 starts_at_ms INTEGER NOT NULL,
 ends_at_ms INTEGER NOT NULL CHECK(ends_at_ms=starts_at_ms+2400000),
 requested_at_ms INTEGER NOT NULL CHECK(requested_at_ms>=0)
) STRICT;
CREATE INDEX academy_paid_slot_requests_by_learner
 ON academy_paid_slot_request_events(learner_id,requested_at_ms DESC,id DESC);
CREATE TABLE academy_paid_slot_decision_events (
 id TEXT PRIMARY KEY NOT NULL CHECK(length(id)=36),
 operation_id TEXT NOT NULL UNIQUE CHECK(length(operation_id)=36),
 request_id TEXT NOT NULL UNIQUE REFERENCES academy_paid_slot_request_events(id),
 actor_subject TEXT NOT NULL REFERENCES auth_users(id),
 decision TEXT NOT NULL CHECK(decision IN ('approved','rejected')),
 lesson_id TEXT UNIQUE CHECK(lesson_id IS NULL OR length(lesson_id)=36),
 reason TEXT NOT NULL CHECK(length(trim(reason)) BETWEEN 8 AND 500),
 at_ms INTEGER NOT NULL CHECK(at_ms>=0),
 CHECK((decision='approved' AND lesson_id IS NOT NULL) OR
       (decision='rejected' AND lesson_id IS NULL))
) STRICT;

CREATE TRIGGER academy_paid_slot_request_guard
BEFORE INSERT ON academy_paid_slot_request_events BEGIN
 SELECT RAISE(ABORT,'ACADEMY_OWNER_DENIED') WHERE NOT EXISTS(
  SELECT 1 FROM learners l JOIN accounts a ON a.id=l.account_id
  WHERE l.id=NEW.learner_id AND a.auth_subject=NEW.actor_subject
   AND l.status='active' AND a.status='active');
 SELECT RAISE(ABORT,'ACADEMY_SLOT_WINDOW_DENIED') WHERE
  NEW.starts_at_ms<NEW.requested_at_ms+60000 OR
  NEW.ends_at_ms>NEW.requested_at_ms+2592000000;
 SELECT RAISE(ABORT,'ACADEMY_SLOT_ASSIGNMENT_DENIED') WHERE NOT EXISTS(
  SELECT 1 FROM teacher_assignments g JOIN teachers t ON t.id=g.teacher_id
  WHERE g.learner_id=NEW.learner_id AND g.teacher_id=NEW.teacher_id
   AND g.revoked_at_ms IS NULL AND g.starts_at_ms<=NEW.starts_at_ms
   AND g.ends_at_ms>=NEW.ends_at_ms AND t.qualified=1 AND t.status='active');
 -- Match a currently published, unwithdrawn PAID offer. Trial slots
 -- never authorize a paid proposal. Staff can publish only via audited D1.
 SELECT RAISE(ABORT,'ACADEMY_PAID_OFFER_MISSING') WHERE NOT EXISTS(
  SELECT 1 FROM academy_paid_open_slot_events s
  WHERE s.teacher_id=NEW.teacher_id AND s.starts_at_ms=NEW.starts_at_ms
   AND s.ends_at_ms=NEW.ends_at_ms AND s.published_at_ms<=NEW.requested_at_ms
   AND NOT EXISTS(SELECT 1 FROM academy_paid_open_slot_closure_events x
    WHERE x.slot_id=s.id));
 SELECT RAISE(ABORT,'ACADEMY_SLOT_CYCLE_DENIED') WHERE NOT EXISTS(
  SELECT 1 FROM subscription_cycles c WHERE c.id=NEW.cycle_id
   AND c.learner_id=NEW.learner_id AND NEW.requested_at_ms>=c.starts_at_ms
   AND NEW.requested_at_ms<c.ends_at_ms
   AND NEW.starts_at_ms>=c.starts_at_ms AND NEW.ends_at_ms<=c.ends_at_ms
   AND (SELECT COUNT(*) FROM subscription_spend_events s
    WHERE s.source_kind='cycle' AND s.source_id=c.id)
     <c.base_sessions+c.rollover_sessions);
 SELECT RAISE(ABORT,'ACADEMY_SLOT_ALREADY_BOOKED') WHERE EXISTS(
  SELECT 1 FROM lessons l WHERE
   (l.learner_id=NEW.learner_id OR l.actual_teacher_id=NEW.teacher_id)
   AND l.status IN ('scheduled','live')
   AND l.starts_at_ms<NEW.ends_at_ms AND l.ends_at_ms>NEW.starts_at_ms);
 SELECT RAISE(ABORT,'ACADEMY_SLOT_REQUEST_PENDING') WHERE EXISTS(
  SELECT 1 FROM academy_paid_slot_request_events r
  WHERE r.learner_id=NEW.learner_id
   -- An undecided proposal whose start has already passed the approval
   -- cutoff must not permanently prevent the owner proposing a new slot.
   -- It remains immutable/auditable and can only be rejected by staff.
   AND r.starts_at_ms>NEW.requested_at_ms+60000
   AND NOT EXISTS(SELECT 1 FROM academy_paid_slot_decision_events d
    WHERE d.request_id=r.id));
END;

CREATE TRIGGER academy_paid_slot_decision_guard
BEFORE INSERT ON academy_paid_slot_decision_events BEGIN
 SELECT RAISE(ABORT,'ACADEMY_STAFF_DENIED') WHERE NOT EXISTS(
  SELECT 1 FROM staff_grants g JOIN auth_users u ON u.id=g.auth_subject
  JOIN accounts a ON a.auth_subject=u.id
  WHERE g.auth_subject=NEW.actor_subject AND g.permission='roles.manage'
   AND g.revoked_at_ms IS NULL AND u.phone_number_verified=1
   AND a.status='active');
 -- The staff decision audit timestamp must not precede the owner's
 -- proposal. This holds for approvals AND rejections, even if a caller
 -- accidentally supplies a stale server timestamp.
 SELECT RAISE(ABORT,'ACADEMY_DECISION_PRECEDES_REQUEST') WHERE
  NEW.at_ms < (SELECT r.requested_at_ms
   FROM academy_paid_slot_request_events r WHERE r.id=NEW.request_id);
 SELECT RAISE(ABORT,'ACADEMY_SLOT_REQUEST_EXPIRED') WHERE
  NEW.decision='approved' AND NOT EXISTS(
   SELECT 1 FROM academy_paid_slot_request_events r
   WHERE r.id=NEW.request_id AND r.starts_at_ms>NEW.at_ms+60000);
 -- #317: A valid proposal does not reserve eligibility. Re-check the
 -- learner, owner, teacher qualification and assignment AT APPROVAL time.
 -- Rejections must remain possible for stale proposals without spending.
 -- A withdrawn offer cannot be approved later. Rejection is still
 -- allowed to preserve the immutable audit without spending a credit.
 SELECT RAISE(ABORT,'ACADEMY_PAID_OFFER_MISSING') WHERE
  NEW.decision='approved' AND NOT EXISTS(
   SELECT 1 FROM academy_paid_slot_request_events r
   JOIN academy_paid_open_slot_events s
    ON s.teacher_id=r.teacher_id AND s.starts_at_ms=r.starts_at_ms
    AND s.ends_at_ms=r.ends_at_ms
   WHERE r.id=NEW.request_id AND s.published_at_ms<=r.requested_at_ms
    AND NOT EXISTS(SELECT 1 FROM academy_paid_open_slot_closure_events x
     WHERE x.slot_id=s.id));
 SELECT RAISE(ABORT,'ACADEMY_PAID_ASSIGNMENT_MISSING') WHERE
  NEW.decision='approved' AND NOT EXISTS(
   SELECT 1 FROM academy_paid_slot_request_events r
   JOIN learners l ON l.id=r.learner_id
   JOIN accounts a ON a.id=l.account_id
   JOIN teachers t ON t.id=r.teacher_id
   JOIN teacher_assignments g ON g.learner_id=l.id AND g.teacher_id=t.id
   WHERE r.id=NEW.request_id AND l.status='active'
    AND a.status='active' AND a.auth_subject=r.actor_subject
    AND t.status='active' AND t.qualified=1
    AND g.revoked_at_ms IS NULL
    AND g.starts_at_ms<=r.starts_at_ms
    AND g.ends_at_ms>=r.ends_at_ms);
END;
-- Any rejection records only the decision. An approval is a single D1
-- transaction: the #315 trigger inserts the lesson and exactly one spend.
-- A concurrent booking, revoked assignment or depleted balance aborts the
-- entire decision, leaving the guardian request pending for staff review.
CREATE TRIGGER academy_paid_slot_decision_apply
AFTER INSERT ON academy_paid_slot_decision_events
WHEN NEW.decision='approved' BEGIN
 INSERT INTO academy_paid_booking_events
 (id,operation_id,lesson_id,learner_id,teacher_id,cycle_id,actor_subject,
  starts_at_ms,ends_at_ms,reason,at_ms)
 SELECT lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-4'||
  substr(hex(randomblob(2)),2,3)||'-a'||substr(hex(randomblob(2)),2,3)||
  '-'||hex(randomblob(6))),
  NEW.operation_id,NEW.lesson_id,r.learner_id,r.teacher_id,r.cycle_id,
  NEW.actor_subject,r.starts_at_ms,r.ends_at_ms,NEW.reason,NEW.at_ms
 FROM academy_paid_slot_request_events r WHERE r.id=NEW.request_id;
END;
CREATE TRIGGER academy_paid_slot_request_no_update
 BEFORE UPDATE ON academy_paid_slot_request_events
 BEGIN SELECT RAISE(ABORT,'ACADEMY_IMMUTABLE'); END;
CREATE TRIGGER academy_paid_slot_request_no_delete
 BEFORE DELETE ON academy_paid_slot_request_events
 BEGIN SELECT RAISE(ABORT,'ACADEMY_IMMUTABLE'); END;
CREATE TRIGGER academy_paid_slot_decision_no_update
 BEFORE UPDATE ON academy_paid_slot_decision_events
 BEGIN SELECT RAISE(ABORT,'ACADEMY_IMMUTABLE'); END;
CREATE TRIGGER academy_paid_slot_decision_no_delete
 BEFORE DELETE ON academy_paid_slot_decision_events
 BEGIN SELECT RAISE(ABORT,'ACADEMY_IMMUTABLE'); END;
INSERT INTO noor_schema_meta(component,version)
 VALUES('academy_paid_slot_requests',1);
