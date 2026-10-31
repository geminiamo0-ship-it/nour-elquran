-- #286: native Wrangler D1 must deny a Sheikh's ink draft for an unassigned
-- sibling in the same household. Disposable synthetic-only database.
-- Run after teacher-draft-native-d1.sql has seeded two siblings, but only
-- granted this teacher access to draft-test-learner (not draft-test-sibling).
-- Expected: DRAFT_ACCESS_DENIED and no persisted draft row.
INSERT INTO teacher_assignment_draft_versions(
 draft_id,revision,learner_id,teacher_subject,kind,edition_id,surah,
 from_ayah,to_ayah,due_at_ms,instructions,marks_json,at_ms)
 VALUES(
 'd145a6fa-1d94-4994-91e7-5819692ba3b6',1,
 'draft-test-sibling','draft-test-teacher','revision','hafs-kfqc:v1.1.1',
 1,1,7,5000,'Synthetic unauthorized sibling ink must be denied',
 '[{"id":"mk-sibling-highlight","kind":"highlight","page":1,"surah":1,"ayah":1,"payload":{"color":"#d0a94c"}}]',
 2600);
