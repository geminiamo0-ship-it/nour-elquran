-- #244: synthetic booked trial on populated native D1 AFTER 0023, BEFORE 0024.
-- Disposable local Wrangler fixture only; no real identities or credentials.
-- The original 0021 close guard permits withdrawal of this booked slot.
INSERT INTO auth_users(
 id,name,email,phone_number_verified,created_at,updated_at)
 VALUES('trial-test-staff','Synthetic Staff','staff@synthetic.invalid',1,0,0);
INSERT INTO accounts(id,auth_subject,created_at_ms)
 VALUES('trial-test-staff-account','trial-test-staff',0);
INSERT INTO staff_grants(auth_subject,permission)
 VALUES('trial-test-staff','roles.manage');
INSERT INTO trial_open_slot_events(
 id,operation_id,actor_subject,teacher_id,starts_at_ms,ends_at_ms,published_at_ms)
 VALUES('b145a6fa-1d94-4994-91e7-5819692ba3b6',
 'b245a6fa-1d94-4994-91e7-5819692ba3b6',
 'trial-test-staff','draft-test-teacher-id',28800000,31200000,0);
INSERT INTO trial_booking_events(
 id,operation_id,lesson_id,slot_id,learner_id,actor_subject,booked_at_ms)
 VALUES('b345a6fa-1d94-4994-91e7-5819692ba3b6',
 'b445a6fa-1d94-4994-91e7-5819692ba3b6',
 'b545a6fa-1d94-4994-91e7-5819692ba3b6',
 'b145a6fa-1d94-4994-91e7-5819692ba3b6',
 'draft-test-learner','draft-test-owner',0);
SELECT CASE WHEN
 (SELECT COUNT(*) FROM lessons WHERE id='b545a6fa-1d94-4994-91e7-5819692ba3b6'
  AND kind='trial' AND status='scheduled' AND starts_at_ms=28800000
  AND ends_at_ms=31200000)=1
 AND (SELECT COUNT(*) FROM trial_slot_closure_events
  WHERE slot_id='b145a6fa-1d94-4994-91e7-5819692ba3b6')=0
 AND (SELECT COUNT(*) FROM trial_booking_events
  WHERE slot_id='b145a6fa-1d94-4994-91e7-5819692ba3b6')=1
 THEN 'NATIVE_TRIAL_BOOKED_PRE0024_OK'
 ELSE 'NATIVE_TRIAL_BOOKED_PRE0024_MISSING' END AS result;
