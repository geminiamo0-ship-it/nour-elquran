-- #244 follow-up migration 0024; sequence after #286 ink compatibility 0023.
-- Do not deploy this branch before #288 is merged and Dev 0023 is verified.
-- #244: A staff slot withdrawal is only for UNBOOKED future availability.
-- A booked trial remains a real lesson; withdrawing its advertised slot
-- must not silently hide that commitment or pretend to cancel it.
-- Replace the trigger without mutating existing bookings/closures.
DROP TRIGGER trial_slot_close_guard;
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
 SELECT RAISE(ABORT,'TRIAL_SLOT_ALREADY_BOOKED') WHERE EXISTS(
  SELECT 1 FROM trial_booking_events b
  JOIN lessons l ON l.id=b.lesson_id
  WHERE b.slot_id=NEW.slot_id AND l.status<>'cancelled');
END;

INSERT INTO noor_schema_meta(component,version)
VALUES('trial_slot_close_booking_guard',1);
