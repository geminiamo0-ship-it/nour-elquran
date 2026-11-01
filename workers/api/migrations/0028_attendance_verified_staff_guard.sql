-- #309: supplemental atomic D1 authorization guard for existing attendance
-- review inserts. Preserve the original 0020 trigger and immutable audit.
-- Active attendance.review alone is not enough without VERIFIED identity.
CREATE TRIGGER attendance_review_verified_actor_guard
BEFORE INSERT ON attendance_review_events
BEGIN
 SELECT RAISE(ABORT,'ATTENDANCE_STAFF_UNVERIFIED') WHERE NOT EXISTS (
  SELECT 1 FROM staff_grants grant_row
  JOIN auth_users user ON user.id=grant_row.auth_subject
  JOIN accounts account ON account.auth_subject=user.id
  WHERE grant_row.auth_subject=NEW.actor_subject
    AND grant_row.permission='attendance.review'
    AND grant_row.revoked_at_ms IS NULL
    AND account.status='active'
    AND user.phone_number_verified=1
 );
END;
INSERT INTO noor_schema_meta(component,version)
 VALUES('attendance_review_verified_actor_guard',1);
