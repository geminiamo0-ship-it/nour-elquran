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
-- Reassigning a scheduled lesson to another learner must also recheck eligibility.
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
BEFORE UPDATE OF status, starts_at_ms, ends_at_ms, actual_teacher_id, learner_id ON lessons
WHEN NEW.status = 'scheduled'
BEGIN
  SELECT RAISE(ABORT, 'booking requires an active learner and account')
  WHERE NOT EXISTS (
    SELECT 1 FROM learners l
    JOIN accounts a ON a.id = l.account_id
    WHERE l.id = NEW.learner_id AND l.status = 'active' AND a.status = 'active'
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

INSERT INTO noor_schema_meta(component, version) VALUES ('teacher_schedule', 1);
