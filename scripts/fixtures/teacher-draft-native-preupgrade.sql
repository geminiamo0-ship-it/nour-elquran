-- Issue #286: disposable synthetic-only native Wrangler D1 reproduction.
-- No real student data, credentials, production binding, or remote operations.
INSERT INTO auth_users(id,name,email,created_at,updated_at)
 VALUES('draft-test-owner','Synthetic Owner','owner@synthetic.invalid',0,0),
       ('draft-test-teacher','Synthetic Teacher','teacher@synthetic.invalid',0,0);
INSERT INTO accounts(id,auth_subject,created_at_ms)
 VALUES('draft-test-account','draft-test-owner',0);
INSERT INTO learners(id,account_id,display_name,learner_type,created_at_ms)
 VALUES('draft-test-learner','draft-test-account','Synthetic Learner','child',0),
       ('draft-test-sibling','draft-test-account','Synthetic Sibling','child',0);
INSERT INTO teachers(id,auth_subject,qualified,status)
 VALUES('draft-test-teacher-id','draft-test-teacher',1,'active');
INSERT INTO teacher_assignments(id,learner_id,teacher_id,starts_at_ms,ends_at_ms)
 VALUES('draft-test-grant','draft-test-learner','draft-test-teacher-id',0,100000);
INSERT INTO quran_editions(id,riwayah,page_count,manifest_sha256)
 VALUES('hafs-kfqc:v1.1.1','hafs',604,'0000000000000000000000000000000000000000000000000000000000000000');
INSERT INTO quran_ayah_anchors(edition_id,surah,ayah,page,word_count)
 VALUES('hafs-kfqc:v1.1.1',1,1,1,8),
       ('hafs-kfqc:v1.1.1',1,2,1,8),
       ('hafs-kfqc:v1.1.1',1,3,1,8),
       ('hafs-kfqc:v1.1.1',1,4,1,8),
       ('hafs-kfqc:v1.1.1',1,5,1,8),
       ('hafs-kfqc:v1.1.1',1,6,1,8),
       ('hafs-kfqc:v1.1.1',1,7,1,8);
-- Existing pre-0023 data: valid historical UNPUBLISHED revision with no marks.
INSERT INTO teacher_assignment_draft_versions(
 draft_id,revision,learner_id,teacher_subject,kind,edition_id,surah,
 from_ayah,to_ayah,due_at_ms,instructions,marks_json,at_ms)
 VALUES('c145a6fa-1d94-4994-91e7-5819692ba3b6',1,
 'draft-test-learner','draft-test-teacher','revision','hafs-kfqc:v1.1.1',
 1,1,7,5000,'Synthetic historical draft before 0023', '[]', 2000);
SELECT CASE WHEN
 (SELECT COUNT(*) FROM teacher_assignment_draft_versions
  WHERE draft_id='c145a6fa-1d94-4994-91e7-5819692ba3b6' AND revision=1
   AND marks_json='[]')=1
 AND (SELECT COUNT(*) FROM learner_quran_events WHERE learner_id='draft-test-learner')=0
 THEN 'NATIVE_UPGRADE_PRESTATE_OK' ELSE 'NATIVE_UPGRADE_PRESTATE_MISSING' END AS result;
