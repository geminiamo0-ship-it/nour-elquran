-- #309: Prevent orphaning a future/live lesson when an operator suspends or
-- de-qualifies its Sheikh. This guard runs INSIDE the same D1 transaction as
-- the immutable teacher_role_events write, closing the read/write race.
-- It also secures legacy /v1/staff/teacher-actions, not just new Admin UI.
CREATE TRIGGER teacher_role_active_lesson_guard
BEFORE INSERT ON teacher_role_events
WHEN NEW.action IN ('suspend','revoke_qualification')
BEGIN
 SELECT RAISE(ABORT,'active classes block teacher transition')
 WHERE EXISTS(
  SELECT 1 FROM teachers teacher
  JOIN lessons lesson ON lesson.actual_teacher_id=teacher.id
  WHERE teacher.id=NEW.teacher_id
    AND teacher.auth_subject=NEW.target_auth_subject
    AND (lesson.status='live'
      OR (lesson.status='scheduled' AND lesson.ends_at_ms>NEW.at_ms))
 );
END;
INSERT INTO noor_schema_meta(component,version)
 VALUES('teacher_role_active_lesson_guard',1);
