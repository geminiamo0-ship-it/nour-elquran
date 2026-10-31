-- IMPORTANT: Same valid revision-2 write should fail on OLD native GLOB,
-- and succeed only AFTER 0023 applied forward with existing private revision 1.
-- Matches Santoreno #304/#305: first signed teacher revision with highlight+pen.
INSERT INTO teacher_assignment_draft_versions(
 draft_id,revision,learner_id,teacher_subject,kind,edition_id,surah,
 from_ayah,to_ayah,due_at_ms,instructions,marks_json,at_ms)
 VALUES(
 'c145a6fa-1d94-4994-91e7-5819692ba3b6',2,
 'draft-test-learner','draft-test-teacher','revision','hafs-kfqc:v1.1.1',
 1,1,7,5000,'Synthetic marked Quran review, no child data',
 '[{"id":"mk-highlight-0001","kind":"highlight","page":1,"surah":1,"ayah":1,"payload":{"color":"#d0a94c"}},{"id":"mk-pen-0001","kind":"pen","page":1,"surah":null,"ayah":null,"payload":{"color":"#d0a94c","width":3,"points":[{"x":120,"y":220},{"x":140,"y":235}]}}]',
 2000);
SELECT CASE WHEN (SELECT count(*) FROM teacher_assignment_draft_versions
 WHERE draft_id='c145a6fa-1d94-4994-91e7-5819692ba3b6')=2
 AND (SELECT marks_json FROM teacher_assignment_draft_versions
      WHERE draft_id='c145a6fa-1d94-4994-91e7-5819692ba3b6' AND revision=1)='[]'
 THEN 'NATIVE_UPGRADE_REVISION_2_OK' ELSE 'NATIVE_UPGRADE_REVISION_2_MISSING' END AS result;
-- A private Sheikh draft must not become a learner-visible Quran event.
-- The same synthetic learner is checked before any publication event exists.
SELECT CASE WHEN
 (SELECT count(*) FROM learner_quran_events
  WHERE learner_id='draft-test-learner')=0
 AND (SELECT count(*) FROM learner_quran_current
  WHERE learner_id='draft-test-learner')=0
 THEN 'NATIVE_UPGRADE_PRIVATE_OK' ELSE 'NATIVE_UPGRADE_PRIVATE_LEAK' END AS result;
-- Publication must project both marks into the owner-only cumulative ledger.
INSERT INTO teacher_assignment_draft_publications(
 draft_id,operation_id,revision,learner_id,teacher_subject,at_ms)
 VALUES('c145a6fa-1d94-4994-91e7-5819692ba3b6',
 '00000000-0000-4000-8000-000000000001',2,
 'draft-test-learner','draft-test-teacher',3500);
INSERT INTO assignment_publish_events(
 operation_id,assignment_id,learner_id,actor_auth_subject,kind,edition_id,
 surah,from_ayah,to_ayah,due_at_ms,instructions,published_at_ms)
 VALUES('00000000-0000-4000-8000-000000000001',
 '10000000-0000-4000-8000-000000000001','draft-test-learner',
 'draft-test-teacher','revision','hafs-kfqc:v1.1.1',1,1,7,5000,
 'Synthetic marked Quran review, no child data',3500);
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
 THEN 'NATIVE_UPGRADE_PUBLICATION_OK' ELSE 'NATIVE_UPGRADE_PUBLICATION_MISSING' END AS result;
-- Same-account siblings are distinct authorization scopes: publishing one learner's
-- teacher draft must never project events or marks into the sibling's Mushaf.
SELECT CASE WHEN
 (SELECT count(*) FROM learner_quran_events WHERE learner_id='draft-test-learner')=2
 AND (SELECT count(*) FROM learner_quran_current WHERE learner_id='draft-test-learner')=2
 AND (SELECT count(*) FROM learner_quran_events WHERE learner_id='draft-test-sibling')=0
 AND (SELECT count(*) FROM learner_quran_current WHERE learner_id='draft-test-sibling')=0
 THEN 'NATIVE_UPGRADE_SIBLING_ISOLATED_OK' ELSE 'NATIVE_UPGRADE_SIBLING_SCOPE_LEAK' END AS result;
