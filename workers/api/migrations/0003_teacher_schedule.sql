-- Classroom schedule rule from #120: each lesson reserves exactly 40 minutes.
-- Earlier rows, if any, are preserved without destructive rewriting.
-- The instructional target is separately 30 minutes; no timer may auto-end a class.
--
-- Slot limits and conflicts are enforced by D1/SQLite statements, not client state.
-- Intervals are half-open: [starts_at_ms, ends_at_ms), so adjacent slots are valid.

CREATE TRIGGER lessons_40m_insert
BEFORE INSERT ON lessons
WHEN NEW.ends_at_ms - NEW.starts_at_ms != 2400000
BEGIN
  SELECT RAISE(ABORT, 'lesson booking must reserve 40 minutes');
END;

CREATE TRIGGER lessons_40m_reschedule
BEFORE UPDATE OF starts_at_ms, ends_at_ms ON lessons
WHEN NEW.ends_at_ms - NEW.starts_at_ms != 2400000
BEGIN
  SELECT RAISE(ABORT, 'lesson booking must reserve 40 minutes');
END;

-- Booking must not assign an unqualified or disabled teacher. Existing historical
-- records are left unchanged; status transitions to live/completed are governed
-- by the later authenticated classroom lifecycle, not this booking constraint.
CREATE TRIGGER lessons_qualified_teacher_insert
BEFORE INSERT ON lessons
WHEN NEW.status = 'scheduled'
BEGIN
  SELECT RAISE(ABORT, 'booking requires an active qualified teacher')
  WHERE NOT EXISTS (
    SELECT 1 FROM teachers t
    WHERE t.id = NEW.actual_teacher_id AND t.status = 'active' AND t.qualified = 1
  );
END;

CREATE TRIGGER lessons_qualified_teacher_update
BEFORE UPDATE OF actual_teacher_id, status, starts_at_ms, ends_at_ms ON lessons
WHEN NEW.status = 'scheduled'
BEGIN
  SELECT RAISE(ABORT, 'booking requires an active qualified teacher')
  WHERE NOT EXISTS (
    SELECT 1 FROM teachers t
    WHERE t.id = NEW.actual_teacher_id AND t.status = 'active' AND t.qualified = 1
  );
END;

-- New or reactivated reservations require an active learner whose owning account
-- is also active. This is a relational guard only: the API must still authenticate
-- the actor and authorize the learner, lesson and teacher before any mutation.
-- Archiving a learner or disabling an account never rewrites existing history.
CREATE TRIGGER lessons_active_learner_insert
BEFORE INSERT ON lessons
WHEN NEW.status = 'scheduled'
BEGIN
  SELECT RAISE(ABORT, 'booking requires an active learner and account')
  WHERE NOT EXISTS (
    SELECT 1 FROM learners l
    JOIN accounts a ON a.id = l.account_id
    WHERE l.id = NEW.learner_id AND l.status = 'active' AND a.status = 'active'
  );
END;

CREATE TRIGGER lessons_active_learner_update
BEFORE UPDATE OF status, starts_at_ms, ends_at_ms, actual_teacher_id ON lessons
WHEN NEW.status = 'scheduled'
BEGIN
  SELECT RAISE(ABORT, 'booking requires an active learner and account')
  WHERE NOT EXISTS (
    SELECT 1 FROM learners l
    JOIN accounts a ON a.id = l.account_id
    WHERE l.id = NEW.learner_id AND l.status = 'active' AND a.status = 'active'
  );
END;

-- The core migration already makes lesson learner identity immutable. Likewise,
-- once a lesson is live or completed, the recorded acting teacher cannot be
-- silently replaced. A substitute can be assigned before Start while scheduled.
-- This does not implement or authorize classroom Start/End transitions.
CREATE TRIGGER lessons_teacher_immutable_after_start
BEFORE UPDATE OF actual_teacher_id ON lessons
WHEN (OLD.status IN ('live','completed') OR NEW.status IN ('live','completed'))
  AND NEW.actual_teacher_id != OLD.actual_teacher_id
BEGIN
  SELECT RAISE(ABORT, 'acting teacher is immutable after start');
END;

-- A live class can only become completed, never silently revert to a
-- scheduled/cancelled slot to evade the single-live guard. Completed history
-- cannot be resurrected into another live room. Same-status retries are safe.
-- This protects stored state only: it does NOT authenticate the actor or
-- verify two-person presence; those belong to the classroom use case.
CREATE TRIGGER lessons_terminal_lifecycle_guard
BEFORE UPDATE OF status ON lessons
WHEN (OLD.status = 'live' AND NEW.status NOT IN ('live', 'completed'))
  OR (OLD.status = 'completed' AND NEW.status != 'completed')
BEGIN
  SELECT RAISE(ABORT, 'live or completed lesson cannot be reopened');
END;

-- Adjacent 40-minute reservations do not permit two simultaneously live rooms.
-- A teacher overrun must block a second Start until the first is explicitly Ended;
-- the same learner cannot be live in two rooms either. These are D1 integrity
-- backstops only, NOT proof of authenticated teacher action or two-party presence.
-- No clock-driven trigger changes a live lesson to completed.
CREATE TRIGGER lessons_single_live_insert
BEFORE INSERT ON lessons
WHEN NEW.status = 'live'
BEGIN
  SELECT RAISE(ABORT, 'teacher already has a live lesson')
  WHERE EXISTS (
    SELECT 1 FROM lessons other
    WHERE other.actual_teacher_id = NEW.actual_teacher_id AND other.status = 'live'
  );
  SELECT RAISE(ABORT, 'learner already has a live lesson')
  WHERE EXISTS (
    SELECT 1 FROM lessons other
    WHERE other.learner_id = NEW.learner_id AND other.status = 'live'
  );
END;

CREATE TRIGGER lessons_single_live_update
BEFORE UPDATE OF status, actual_teacher_id, learner_id ON lessons
WHEN NEW.status = 'live'
BEGIN
  SELECT RAISE(ABORT, 'teacher already has a live lesson')
  WHERE EXISTS (
    SELECT 1 FROM lessons other
    WHERE other.id != OLD.id
      AND other.actual_teacher_id = NEW.actual_teacher_id AND other.status = 'live'
  );
  SELECT RAISE(ABORT, 'learner already has a live lesson')
  WHERE EXISTS (
    SELECT 1 FROM lessons other
    WHERE other.id != OLD.id
      AND other.learner_id = NEW.learner_id AND other.status = 'live'
  );
END;

-- A canceled appointment releases both teacher and learner calendar capacity.
-- Completed bookings still occupy their original historical interval.
CREATE TRIGGER lessons_teacher_conflict_insert
BEFORE INSERT ON lessons
WHEN NEW.status != 'cancelled'
BEGIN
  SELECT RAISE(ABORT, 'teacher has a conflicting lesson')
  WHERE EXISTS (
    SELECT 1 FROM lessons booked
    WHERE booked.actual_teacher_id = NEW.actual_teacher_id
      AND booked.status != 'cancelled'
      AND booked.starts_at_ms < NEW.ends_at_ms
      AND NEW.starts_at_ms < booked.ends_at_ms
  );
END;

CREATE TRIGGER lessons_teacher_conflict_update
BEFORE UPDATE OF actual_teacher_id, starts_at_ms, ends_at_ms, status ON lessons
WHEN NEW.status != 'cancelled'
BEGIN
  SELECT RAISE(ABORT, 'teacher has a conflicting lesson')
  WHERE EXISTS (
    SELECT 1 FROM lessons booked
    WHERE booked.id != OLD.id
      AND booked.actual_teacher_id = NEW.actual_teacher_id
      AND booked.status != 'cancelled'
      AND booked.starts_at_ms < NEW.ends_at_ms
      AND NEW.starts_at_ms < booked.ends_at_ms
  );
END;

CREATE TRIGGER lessons_learner_conflict_insert
BEFORE INSERT ON lessons
WHEN NEW.status != 'cancelled'
BEGIN
  SELECT RAISE(ABORT, 'learner has a conflicting lesson')
  WHERE EXISTS (
    SELECT 1 FROM lessons booked
    WHERE booked.learner_id = NEW.learner_id
      AND booked.status != 'cancelled'
      AND booked.starts_at_ms < NEW.ends_at_ms
      AND NEW.starts_at_ms < booked.ends_at_ms
  );
END;

CREATE TRIGGER lessons_learner_conflict_update
BEFORE UPDATE OF learner_id, starts_at_ms, ends_at_ms, status ON lessons
WHEN NEW.status != 'cancelled'
BEGIN
  SELECT RAISE(ABORT, 'learner has a conflicting lesson')
  WHERE EXISTS (
    SELECT 1 FROM lessons booked
    WHERE booked.id != OLD.id
      AND booked.learner_id = NEW.learner_id
      AND booked.status != 'cancelled'
      AND booked.starts_at_ms < NEW.ends_at_ms
      AND NEW.starts_at_ms < booked.ends_at_ms
  );
END;

-- Initial records are reservations, never already-live or delivered lessons.
-- Existing historical rows are untouched when this additive migration is applied.
-- Actor authorization and two-person presence MUST be enforced in the Worker/DO;
-- these triggers only reject state-machine shortcuts in the persisted D1 row.
CREATE TRIGGER lessons_initial_lifecycle_guard
BEFORE INSERT ON lessons
WHEN NEW.status IN ('live', 'completed')
BEGIN
  SELECT RAISE(ABORT, 'new lesson must begin scheduled or cancelled');
END;

-- A cancelled reservation must be reactivated and revalidated before Start.
-- Completion cannot skip a prior explicit Start. This does not itself prove
-- the Start/End was made by the verified acting teacher.
CREATE TRIGGER lessons_prestart_lifecycle_guard
BEFORE UPDATE OF status ON lessons
WHEN (OLD.status = 'scheduled' AND NEW.status = 'completed')
  OR (OLD.status = 'cancelled' AND NEW.status IN ('live', 'completed'))
BEGIN
  SELECT RAISE(ABORT, 'lesson requires a scheduled Start before completion');
END;

INSERT INTO noor_schema_meta(component, version) VALUES ('teacher_schedule', 1);
