-- Issue #286: disposable synthetic-only native Wrangler D1 reproduction.
-- No real student data, credentials, production binding, or remote operations.
INSERT INTO auth_users(id,name,email,created_at,updated_at)
 VALUES('draft-test-owner','Synthetic Owner','owner@synthetic.invalid',0,0),
       ('draft-test-teacher','Synthetic Teacher','teacher@synthetic.invalid',0,0);
INSERT INTO accounts(id,auth_subject,created_at_ms)
 VALUES('draft-test-account','draft-test-owner',0);
INSERT INTO learners(id,account_id,display_name,learner_type,created_at_ms)
 VALUES('draft-test-learner','draft-test-account','Synthetic Learner','child',0);
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
-- Matches Santoreno #304/#305: first signed teacher revision with highlight+pen.
INSERT INTO teacher_assignment_draft_versions(
 draft_id,revision,learner_id,teacher_subject,kind,edition_id,surah,
 from_ayah,to_ayah,due_at_ms,instructions,marks_json,at_ms)
 VALUES(
 '7145a6fa-1d94-4994-91e7-5819692ba3b6',1,
 'draft-test-learner','draft-test-teacher','revision','hafs-kfqc:v1.1.1',
 1,1,7,5000,'Synthetic marked Quran review, no child data',
 '[{"id":"mk-highlight-0001","kind":"highlight","page":1,"surah":1,"ayah":1,"payload":{"color":"#d0a94c"}},{"id":"mk-pen-0001","kind":"pen","page":1,"surah":null,"ayah":null,"payload":{"color":"#d0a94c","width":3,"points":[{"x":120,"y":220},{"x":140,"y":235}]}}]',
 2000);
SELECT CASE WHEN (SELECT count(*) FROM teacher_assignment_draft_versions
 WHERE draft_id='7145a6fa-1d94-4994-91e7-5819692ba3b6')=1
 THEN 'NATIVE_DRAFT_WRITE_OK' ELSE 'NATIVE_DRAFT_WRITE_MISSING' END AS result;
-- A private Sheikh draft must not become a learner-visible Quran event.
-- The same synthetic learner is checked before any publication event exists.
SELECT CASE WHEN
 (SELECT count(*) FROM learner_quran_events
  WHERE learner_id='draft-test-learner')=0
 AND (SELECT count(*) FROM learner_quran_current
  WHERE learner_id='draft-test-learner')=0
 THEN 'NATIVE_DRAFT_PRIVATE_OK' ELSE 'NATIVE_DRAFT_LEAKED' END AS result;
-- Publication must project both marks into the owner-only cumulative ledger.
INSERT INTO teacher_assignment_draft_publications(
 draft_id,operation_id,revision,learner_id,teacher_subject,at_ms)
 VALUES('7145a6fa-1d94-4994-91e7-5819692ba3b6',
 '00000000-0000-4000-8000-000000000001',1,
 'draft-test-learner','draft-test-teacher',2500);
INSERT INTO assignment_publish_events(
 operation_id,assignment_id,learner_id,actor_auth_subject,kind,edition_id,
 surah,from_ayah,to_ayah,due_at_ms,instructions,published_at_ms)
 VALUES('00000000-0000-4000-8000-000000000001',
 '10000000-0000-4000-8000-000000000001','draft-test-learner',
 'draft-test-teacher','revision','hafs-kfqc:v1.1.1',1,1,7,5000,
 'Synthetic marked Quran review, no child data',2500);
SELECT CASE WHEN
 (SELECT count(*) FROM learner_quran_current
  WHERE learner_id='draft-test-learner' AND visible=1
  AND origin_type='assignment' AND audience='shared')=2
 AND EXISTS (SELECT 1 FROM learner_quran_current
  WHERE learner_id='draft-test-learner' AND kind='pen'
    AND author_role='teacher' AND origin_id='10000000-0000-4000-8000-000000000001')
 AND EXISTS (SELECT 1 FROM learner_quran_current
  WHERE learner_id='draft-test-learner' AND kind='highlight'
    AND author_role='teacher' AND origin_id='10000000-0000-4000-8000-000000000001')
 THEN 'NATIVE_DRAFT_PUBLICATION_OK' ELSE 'NATIVE_DRAFT_PUBLICATION_MISSING' END AS result;
