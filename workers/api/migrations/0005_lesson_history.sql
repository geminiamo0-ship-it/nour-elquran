-- #120: Preserve the original booked interval, entitlement kind and End audit.
-- 0001-0004 are already merged migrations; this is additive, never rewrite them.
-- Historical completed rows (including legacy 30-minute reservations and NULL
-- ended_at_ms) remain unchanged. Repairing history requires a separate audited
-- administrative migration, not a silent UPDATE.
--
-- These constraints are database integrity only. They do NOT authenticate
-- Start/End, prove two-party DO presence, or provide request idempotency.

CREATE TRIGGER lessons_history_immutable_after_start
BEFORE UPDATE OF starts_at_ms, ends_at_ms, kind, ended_at_ms ON lessons
WHEN OLD.status IN ('live', 'completed')
  AND (
    NEW.starts_at_ms IS NOT OLD.starts_at_ms
    OR NEW.ends_at_ms IS NOT OLD.ends_at_ms
    OR NEW.kind IS NOT OLD.kind
    OR (OLD.status = 'completed' AND NEW.ended_at_ms IS NOT OLD.ended_at_ms)
    OR (OLD.status = 'live' AND NEW.status = 'live'
        AND NEW.ended_at_ms IS NOT OLD.ended_at_ms)
  )
BEGIN
  SELECT RAISE(ABORT, 'lesson history immutable after start');
END;

-- New completions must have an authoritative End timestamp in the SAME
-- status transition. Existing completed rows with NULL (pre-migration history)
-- are untouched, including harmless completed->completed no-op writes.
-- This is NOT evidence of teacher authentication or DO presence.
CREATE TRIGGER lessons_new_completion_requires_end_time
BEFORE UPDATE OF status ON lessons
WHEN OLD.status = 'live' AND NEW.status = 'completed'
  AND NEW.ended_at_ms IS NULL
BEGIN
  SELECT RAISE(ABORT, 'lesson End requires recorded timestamp');
END;

INSERT INTO noor_schema_meta(component, version)
VALUES ('lesson_history', 1);
