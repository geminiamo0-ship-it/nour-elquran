-- #244 / 0026: append-only monthly entitlement and compensation LEDGER FOUNDATION.
-- SOURCE-ONLY. No paid booking, payment receipt, financial claim or staff
-- activation API is enabled by this migration. All mutations require verified
-- D1 staff authority; the public API in this phase is read-only.
-- Credits are academic units (one 40-minute reserved lesson), never currency.
CREATE TABLE subscription_cycles (
 id TEXT NOT NULL PRIMARY KEY CHECK(length(id)=36),
 operation_id TEXT NOT NULL UNIQUE CHECK(length(operation_id)=36),
 learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE RESTRICT,
 actor_subject TEXT NOT NULL REFERENCES auth_users(id) ON DELETE RESTRICT,
 previous_cycle_id TEXT UNIQUE REFERENCES subscription_cycles(id) ON DELETE RESTRICT,
 starts_at_ms INTEGER NOT NULL CHECK(starts_at_ms>=0),
 ends_at_ms INTEGER NOT NULL CHECK(ends_at_ms>starts_at_ms),
 base_sessions INTEGER NOT NULL CHECK(base_sessions BETWEEN 1 AND 60),
 rollover_sessions INTEGER NOT NULL CHECK(rollover_sessions BETWEEN 0 AND 60),
 reason TEXT NOT NULL CHECK(length(trim(reason)) BETWEEN 10 AND 500),
 at_ms INTEGER NOT NULL CHECK(at_ms>=0),
 -- A calendar month (not 30 fixed days) must be calculated by a future
 -- server-side Africa/Cairo policy and verified before any write API.
 -- 27-32-day D1 range only catches obviously invalid/corrupt timestamps.
 CHECK(ends_at_ms-starts_at_ms BETWEEN 2332800000 AND 2764800000),
 CHECK(base_sessions+rollover_sessions<=120),
 CHECK(at_ms=starts_at_ms),
 CHECK((previous_cycle_id IS NOT NULL) OR rollover_sessions=0)
) STRICT;
CREATE INDEX subscription_cycles_learner ON subscription_cycles(learner_id,starts_at_ms DESC,id);

CREATE TABLE subscription_compensation_grants (
 id TEXT NOT NULL PRIMARY KEY CHECK(length(id)=36),
 operation_id TEXT NOT NULL UNIQUE CHECK(length(operation_id)=36),
 learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE RESTRICT,
 lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE RESTRICT,
 actor_subject TEXT NOT NULL REFERENCES auth_users(id) ON DELETE RESTRICT,
 fault_kind TEXT NOT NULL CHECK(fault_kind IN ('teacher','academy')),
 sessions INTEGER NOT NULL CHECK(sessions BETWEEN 1 AND 4),
 reason TEXT NOT NULL CHECK(length(trim(reason)) BETWEEN 10 AND 500),
 issued_at_ms INTEGER NOT NULL CHECK(issued_at_ms>=0),
 UNIQUE(lesson_id,fault_kind)
) STRICT;
CREATE INDEX subscription_compensation_by_child ON subscription_compensation_grants(learner_id,issued_at_ms DESC,id);

CREATE TABLE subscription_spend_events (
 id TEXT NOT NULL PRIMARY KEY CHECK(length(id)=36),
 operation_id TEXT NOT NULL UNIQUE CHECK(length(operation_id)=36),
 learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE RESTRICT,
 lesson_id TEXT NOT NULL UNIQUE REFERENCES lessons(id) ON DELETE RESTRICT,
 actor_subject TEXT NOT NULL REFERENCES auth_users(id) ON DELETE RESTRICT,
 source_kind TEXT NOT NULL CHECK(source_kind IN ('cycle','compensation')),
 source_id TEXT NOT NULL CHECK(length(source_id)=36),
 at_ms INTEGER NOT NULL CHECK(at_ms>=0)
) STRICT;
CREATE INDEX subscription_spend_by_source ON subscription_spend_events(source_kind,source_id);
CREATE INDEX subscription_spend_by_child ON subscription_spend_events(learner_id,at_ms DESC);

-- Verification at INSERT time, not only earlier Worker authorization checks.
-- A role revoked between validation and commit cannot issue/spend credits.
CREATE TRIGGER subscription_cycle_guard BEFORE INSERT ON subscription_cycles
BEGIN
 SELECT RAISE(ABORT,'SUBSCRIPTION_STAFF_DENIED') WHERE NOT EXISTS(
   SELECT 1 FROM staff_grants g JOIN auth_users u ON u.id=g.auth_subject
   JOIN accounts staff ON staff.auth_subject=u.id
   WHERE g.auth_subject=NEW.actor_subject AND g.permission='roles.manage'
    AND g.revoked_at_ms IS NULL AND u.phone_number_verified=1
    AND staff.status='active'
 );
 SELECT RAISE(ABORT,'SUBSCRIPTION_LEARNER_DENIED') WHERE NOT EXISTS(
   SELECT 1 FROM learners l JOIN accounts owner ON owner.id=l.account_id
   WHERE l.id=NEW.learner_id AND l.status='active' AND owner.status='active'
 );
 SELECT RAISE(ABORT,'SUBSCRIPTION_CYCLE_OVERLAP') WHERE EXISTS(
   SELECT 1 FROM subscription_cycles c WHERE c.learner_id=NEW.learner_id
    AND c.starts_at_ms<NEW.ends_at_ms AND NEW.starts_at_ms<c.ends_at_ms
 );
 SELECT RAISE(ABORT,'SUBSCRIPTION_RENEWAL_CHAIN_INVALID') WHERE (
   (NEW.previous_cycle_id IS NULL AND EXISTS(
      SELECT 1 FROM subscription_cycles c WHERE c.learner_id=NEW.learner_id))
   OR (NEW.previous_cycle_id IS NOT NULL AND NOT EXISTS(
      SELECT 1 FROM subscription_cycles prior
      WHERE prior.id=NEW.previous_cycle_id AND prior.learner_id=NEW.learner_id
       AND prior.ends_at_ms<=NEW.starts_at_ms
       AND NOT EXISTS(
         SELECT 1 FROM subscription_cycles later
         WHERE later.learner_id=NEW.learner_id
           AND later.ends_at_ms>prior.ends_at_ms)))
 );
 -- Renew within 3 days after expiration to carry unused BASE units once.
 -- Previous carried units expire and cannot carry forward a second time.
 -- Spend order is rolled units first, then base units (implicitly used for
 -- determining what part of previous base remains).
 SELECT RAISE(ABORT,'SUBSCRIPTION_ROLLOVER_MISMATCH')
 WHERE NEW.previous_cycle_id IS NOT NULL AND NEW.rollover_sessions<>(
   SELECT CASE WHEN NEW.starts_at_ms>prev.ends_at_ms+259200000 THEN 0 ELSE
     MIN(prev.base_sessions,MAX(0,
       prev.base_sessions+prev.rollover_sessions-
       (SELECT COUNT(*) FROM subscription_spend_events e
        WHERE e.source_kind='cycle' AND e.source_id=prev.id)))
     END FROM subscription_cycles prev WHERE prev.id=NEW.previous_cycle_id
 );
END;

CREATE TRIGGER subscription_compensation_guard BEFORE INSERT ON subscription_compensation_grants
BEGIN
 SELECT RAISE(ABORT,'SUBSCRIPTION_STAFF_DENIED') WHERE NOT EXISTS(
   SELECT 1 FROM staff_grants g JOIN auth_users u ON u.id=g.auth_subject
   JOIN accounts staff ON staff.auth_subject=u.id
   WHERE g.auth_subject=NEW.actor_subject AND g.permission='roles.manage'
    AND g.revoked_at_ms IS NULL AND u.phone_number_verified=1
    AND staff.status='active'
 );
 SELECT RAISE(ABORT,'SUBSCRIPTION_COMPENSATION_NOT_VERIFIED') WHERE NOT EXISTS(
   SELECT 1 FROM lessons lesson
   JOIN learners l ON l.id=lesson.learner_id
   JOIN accounts owner ON owner.id=l.account_id
   WHERE lesson.id=NEW.lesson_id AND lesson.learner_id=NEW.learner_id
    AND lesson.status IN ('cancelled','completed')
    AND l.status='active' AND owner.status='active'
    AND NEW.issued_at_ms>=lesson.starts_at_ms
 );
END;

CREATE TRIGGER subscription_spend_guard BEFORE INSERT ON subscription_spend_events
BEGIN
 SELECT RAISE(ABORT,'SUBSCRIPTION_STAFF_DENIED') WHERE NOT EXISTS(
   SELECT 1 FROM staff_grants g JOIN auth_users u ON u.id=g.auth_subject
   JOIN accounts staff ON staff.auth_subject=u.id
   WHERE g.auth_subject=NEW.actor_subject AND g.permission='roles.manage'
    AND g.revoked_at_ms IS NULL AND u.phone_number_verified=1
    AND staff.status='active'
 );
 SELECT RAISE(ABORT,'SUBSCRIPTION_LESSON_INELIGIBLE') WHERE NOT EXISTS(
   SELECT 1 FROM lessons lesson JOIN learners l ON l.id=lesson.learner_id
    JOIN accounts owner ON owner.id=l.account_id
   WHERE lesson.id=NEW.lesson_id AND lesson.learner_id=NEW.learner_id
    AND lesson.kind IN ('standard','makeup')
    AND lesson.status IN ('scheduled','live','completed')
    AND l.status='active' AND owner.status='active'
 );
 SELECT RAISE(ABORT,'SUBSCRIPTION_CYCLE_NO_CREDIT') WHERE
  NEW.source_kind='cycle' AND NOT EXISTS(
   SELECT 1 FROM subscription_cycles c
   JOIN lessons lesson ON lesson.id=NEW.lesson_id
   WHERE c.id=NEW.source_id AND c.learner_id=NEW.learner_id
    AND NEW.at_ms>=c.starts_at_ms AND NEW.at_ms<c.ends_at_ms
    AND NEW.at_ms<=lesson.starts_at_ms
    AND lesson.starts_at_ms>=c.starts_at_ms
    AND lesson.starts_at_ms<c.ends_at_ms
    AND NOT EXISTS(SELECT 1 FROM subscription_cycles next
       WHERE next.previous_cycle_id=c.id)
    AND (SELECT COUNT(*) FROM subscription_spend_events e
      WHERE e.source_kind='cycle' AND e.source_id=c.id)
       <c.base_sessions+c.rollover_sessions
 );
 SELECT RAISE(ABORT,'SUBSCRIPTION_COMPENSATION_NO_CREDIT') WHERE
  NEW.source_kind='compensation' AND NOT EXISTS(
   SELECT 1 FROM subscription_compensation_grants g
   JOIN lessons lesson ON lesson.id=NEW.lesson_id
   WHERE g.id=NEW.source_id AND g.learner_id=NEW.learner_id
    AND NEW.at_ms>=g.issued_at_ms
    -- Compensation may only reserve a future lesson. Never debit a grant
    -- against a lesson already started or before the grant was issued.
    AND NEW.at_ms<=lesson.starts_at_ms
    AND lesson.starts_at_ms>=g.issued_at_ms
    AND (SELECT COUNT(*) FROM subscription_spend_events e
       WHERE e.source_kind='compensation' AND e.source_id=g.id)<g.sessions
 );
END;

-- No mutation, deletion, cancellation-as-refund, or balance reset.
-- Future approved operations must be new auditable events, not UPDATEs.
CREATE TRIGGER subscription_cycle_no_update BEFORE UPDATE ON subscription_cycles
BEGIN SELECT RAISE(ABORT,'SUBSCRIPTION_IMMUTABLE'); END;
CREATE TRIGGER subscription_cycle_no_delete BEFORE DELETE ON subscription_cycles
BEGIN SELECT RAISE(ABORT,'SUBSCRIPTION_IMMUTABLE'); END;
CREATE TRIGGER subscription_compensation_no_update BEFORE UPDATE ON subscription_compensation_grants
BEGIN SELECT RAISE(ABORT,'SUBSCRIPTION_IMMUTABLE'); END;
CREATE TRIGGER subscription_compensation_no_delete BEFORE DELETE ON subscription_compensation_grants
BEGIN SELECT RAISE(ABORT,'SUBSCRIPTION_IMMUTABLE'); END;
CREATE TRIGGER subscription_spend_no_update BEFORE UPDATE ON subscription_spend_events
BEGIN SELECT RAISE(ABORT,'SUBSCRIPTION_IMMUTABLE'); END;
CREATE TRIGGER subscription_spend_no_delete BEFORE DELETE ON subscription_spend_events
BEGIN SELECT RAISE(ABORT,'SUBSCRIPTION_IMMUTABLE'); END;

INSERT INTO noor_schema_meta(component,version) VALUES('subscription_ledger',1);
