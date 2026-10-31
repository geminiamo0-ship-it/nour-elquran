-- #244 deliberate failure: replacement destination is already booked
-- by another account; original lesson and its grant must remain untouched.
INSERT INTO trial_owner_reschedule_events(id,operation_id,old_lesson_id,
 new_lesson_id,new_slot_id,learner_id,actor_subject,at_ms)
 VALUES('aa45a6fa-1d94-4994-91e7-5819692ba3b6',
 'ab45a6fa-1d94-4994-91e7-5819692ba3b6',
 'a645a6fa-1d94-4994-91e7-5819692ba3b6',
 'ac45a6fa-1d94-4994-91e7-5819692ba3b6',
 'a245a6fa-1d94-4994-91e7-5819692ba3b6',
 'native-slot-child-a','native-slot-owner',0);
