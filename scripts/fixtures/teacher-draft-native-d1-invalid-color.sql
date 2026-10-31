-- #286: expected-to-fail native D1 guard regression, synthetic IDs only.
-- Run AFTER teacher-draft-native-d1.sql seeded the disposable local database.
-- A malformed color must raise DRAFT_MARKS_INVALID without persisting a draft.
INSERT INTO teacher_assignment_draft_versions(
 draft_id,revision,learner_id,teacher_subject,kind,edition_id,surah,
 from_ayah,to_ayah,due_at_ms,instructions,marks_json,at_ms)
 VALUES(
 'f145a6fa-1d94-4994-91e7-5819692ba3b6',1,
 'draft-test-learner','draft-test-teacher','revision','hafs-kfqc:v1.1.1',
 1,1,7,5000,'Synthetic invalid color must be denied',
 '[{"id":"mk-invalid-0001","kind":"highlight","page":1,"surah":1,"ayah":1,"payload":{"color":"#gg0000"}}]',
 3000);
