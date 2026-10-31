-- #286: missing JSON color is SQL NULL, not a valid #RRGGBB value.
-- Disposable native local D1 only, after teacher-draft-native-d1.sql.
-- Expected: DRAFT_MARKS_INVALID; no draft row must be committed.
INSERT INTO teacher_assignment_draft_versions(
 draft_id,revision,learner_id,teacher_subject,kind,edition_id,surah,
 from_ayah,to_ayah,due_at_ms,instructions,marks_json,at_ms)
 VALUES(
 'e145a6fa-1d94-4994-91e7-5819692ba3b6',1,
 'draft-test-learner','draft-test-teacher','revision','hafs-kfqc:v1.1.1',
 1,1,7,5000,'Synthetic missing color must be denied',
 '[{"id":"mk-missing-color-0001","kind":"highlight","page":1,"surah":1,"ayah":1,"payload":{}}]',
 3200);
