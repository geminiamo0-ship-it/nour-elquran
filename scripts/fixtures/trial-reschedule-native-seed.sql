-- #244: disposable NATIVE Wrangler/D1 fixture, no real accounts or media.
-- Start with 0025 installed; CREATE real confirmed trials for owner A and B.
INSERT INTO auth_users(id,name,email,created_at,updated_at,phone_number_verified)
 VALUES('native-slot-staff','Synthetic Staff','native-slot-staff@synthetic.invalid',0,0,1),
       ('native-slot-owner','Synthetic Owner','native-slot-owner@synthetic.invalid',0,0,1),
       ('native-slot-other','Synthetic Other','native-slot-other@synthetic.invalid',0,0,1),
       ('native-slot-teacher','Synthetic Sheikh','native-slot-teacher@synthetic.invalid',0,0,1);
INSERT INTO accounts(id,auth_subject,created_at_ms)
 VALUES('native-slot-staff-account','native-slot-staff',0),
       ('native-slot-owner-account','native-slot-owner',0),
       ('native-slot-other-account','native-slot-other',0);
INSERT INTO staff_grants(auth_subject,permission) VALUES('native-slot-staff','roles.manage');
INSERT INTO learners(id,account_id,display_name,learner_type,created_at_ms)
 VALUES('native-slot-child-a','native-slot-owner-account','Synthetic A','child',0),
       ('native-slot-child-b','native-slot-other-account','Synthetic B','child',0);
INSERT INTO teachers(id,auth_subject,qualified,status)
 VALUES('native-slot-teacher-id','native-slot-teacher',1,'active');
INSERT INTO trial_open_slot_events(id,operation_id,actor_subject,teacher_id,
 starts_at_ms,ends_at_ms,published_at_ms)
 VALUES('a145a6fa-1d94-4994-91e7-5819692ba3b6','a115a6fa-1d94-4994-91e7-5819692ba3b6',
 'native-slot-staff','native-slot-teacher-id',28800000,31200000,0),
 ('a245a6fa-1d94-4994-91e7-5819692ba3b6','a215a6fa-1d94-4994-91e7-5819692ba3b6',
 'native-slot-staff','native-slot-teacher-id',36000000,38400000,0),
 ('a345a6fa-1d94-4994-91e7-5819692ba3b6','a315a6fa-1d94-4994-91e7-5819692ba3b6',
 'native-slot-staff','native-slot-teacher-id',43200000,45600000,0);
INSERT INTO trial_booking_events(id,operation_id,lesson_id,slot_id,
 learner_id,actor_subject,booked_at_ms)
 VALUES('a445a6fa-1d94-4994-91e7-5819692ba3b6','a545a6fa-1d94-4994-91e7-5819692ba3b6',
 'a645a6fa-1d94-4994-91e7-5819692ba3b6','a145a6fa-1d94-4994-91e7-5819692ba3b6',
 'native-slot-child-a','native-slot-owner',0),
 ('a745a6fa-1d94-4994-91e7-5819692ba3b6','a845a6fa-1d94-4994-91e7-5819692ba3b6',
 'a945a6fa-1d94-4994-91e7-5819692ba3b6','a245a6fa-1d94-4994-91e7-5819692ba3b6',
 'native-slot-child-b','native-slot-other',0);
SELECT CASE WHEN
 (SELECT COUNT(*) FROM lessons WHERE kind='trial' AND status='scheduled')=2
 AND (SELECT COUNT(*) FROM trial_booking_auto_grants)=2
 AND (SELECT version FROM noor_schema_meta WHERE component='trial_owner_reschedule')=1
 THEN 'NATIVE_TRIAL_RESCHEDULE_SEEDED' ELSE 'NATIVE_TRIAL_RESCHEDULE_SEED_FAILED'
 END AS result;
