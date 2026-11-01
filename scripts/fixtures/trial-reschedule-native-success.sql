-- #244: after the failed occupied-slot attempt, prove native D1 rollback
-- and a genuinely atomic successful replacement to a different open slot.
SELECT CASE WHEN
 (SELECT status FROM lessons WHERE id='a645a6fa-1d94-4994-91e7-5819692ba3b6')='scheduled'
 AND (SELECT status FROM lessons WHERE id='a945a6fa-1d94-4994-91e7-5819692ba3b6')='scheduled'
 AND (SELECT COUNT(*) FROM trial_owner_reschedule_events)=0
 AND (SELECT COUNT(*) FROM trial_booking_events)=2
 AND (SELECT COUNT(*) FROM teacher_assignments
   WHERE learner_id='native-slot-child-a' AND revoked_at_ms IS NULL)=1
 THEN 'NATIVE_TRIAL_RESCHEDULE_CONFLICT_ATOMIC'
 ELSE 'NATIVE_TRIAL_RESCHEDULE_CONFLICT_LEAK' END AS result;

INSERT INTO trial_owner_reschedule_events(id,operation_id,old_lesson_id,
 new_lesson_id,new_slot_id,learner_id,actor_subject,at_ms)
 VALUES('ad45a6fa-1d94-4994-91e7-5819692ba3b6',
 'ae45a6fa-1d94-4994-91e7-5819692ba3b6',
 'a645a6fa-1d94-4994-91e7-5819692ba3b6',
 'af45a6fa-1d94-4994-91e7-5819692ba3b6',
 'a345a6fa-1d94-4994-91e7-5819692ba3b6',
 'native-slot-child-a','native-slot-owner',0);

SELECT CASE WHEN
 (SELECT status FROM lessons WHERE id='a645a6fa-1d94-4994-91e7-5819692ba3b6')='cancelled'
 AND (SELECT status FROM lessons WHERE id='af45a6fa-1d94-4994-91e7-5819692ba3b6'
   AND learner_id='native-slot-child-a' AND kind='trial'
   AND starts_at_ms=43200000 AND ends_at_ms=45600000)='scheduled'
 AND (SELECT status FROM lessons WHERE id='a945a6fa-1d94-4994-91e7-5819692ba3b6')='scheduled'
 AND (SELECT COUNT(*) FROM trial_owner_reschedule_events)=1
 AND (SELECT COUNT(*) FROM trial_booking_events WHERE learner_id='native-slot-child-a')=2
 AND (SELECT COUNT(*) FROM teacher_assignments
   WHERE learner_id='native-slot-child-a' AND revoked_at_ms=0)=1
 AND (SELECT COUNT(*) FROM teacher_assignments
   WHERE learner_id='native-slot-child-a' AND revoked_at_ms IS NULL)=1
 AND NOT EXISTS(SELECT 1 FROM pragma_foreign_key_check)
 THEN 'NATIVE_TRIAL_RESCHEDULE_COMMITTED'
 ELSE 'NATIVE_TRIAL_RESCHEDULE_COMMIT_FAILED' END AS result;
