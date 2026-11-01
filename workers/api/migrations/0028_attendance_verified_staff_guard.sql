-- #309: supplemental atomic D1 authorization guard for existing attendance
-- review inserts. Preserve the original 0020 trigger and immutable audit.
-- The original trigger continues to own unauthorised/disabled/revoked denial.
-- This new guard distinguishes an otherwise active reviewer who has not
-- verified their identity, including a subsequent verification revocation.
CREATE TRIGGER attendance_review_verified_actor_guard
BEFORE INSERT ON attendance_review_events
BEGIN
 SELECT RAISE(ABORT,'ATTENDANCE_STAFF_UNVERIFIED')
 WHERE EXISTS (
  SELECT 1 FROM staff_grants g
  JOIN accounts a ON a.auth_subject=g.auth_subject
  WHERE g.auth_subject=NEW.actor_subject
    AND g.permission='attendance.review'
    AND g.revoked_at_ms IS NULL AND a.status='active'
 ) AND NOT EXISTS (
  SELECT 1 FROM auth_users u
  WHERE u.id=NEW.actor_subject AND u.phone_number_verified=1
 );
END;
INSERT INTO noor_schema_meta(component,version)
 VALUES('attendance_review_verified_actor_guard',1);
