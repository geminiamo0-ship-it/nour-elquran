-- #246: immutable audit of preliminary attendance incidents and owner appeals.
-- No billable absence, session debit, automatic compensation, or guilt presumption.
-- Teacher no-show requires separate verified live DO presence at the Worker edge.
CREATE TABLE attendance_incident_events (
 id TEXT NOT NULL PRIMARY KEY CHECK(length(id)=36),
 operation_id TEXT NOT NULL UNIQUE CHECK(length(operation_id)=36),
 lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE RESTRICT,
 learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE RESTRICT,
 actor_subject TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('student_no_show','connection_interruption')),
 reason TEXT NOT NULL CHECK(length(trim(reason)) BETWEEN 10 AND 500),
 reported_at_ms INTEGER NOT NULL CHECK(reported_at_ms>=0)
) STRICT;
CREATE INDEX attendance_incident_lesson ON attendance_incident_events(lesson_id,reported_at_ms DESC);
CREATE INDEX attendance_incident_learner ON attendance_incident_events(learner_id,reported_at_ms DESC);
CREATE UNIQUE INDEX attendance_once_per_lesson_no_show ON attendance_incident_events(lesson_id)
 WHERE kind='student_no_show';
CREATE TRIGGER attendance_incident_guard BEFORE INSERT ON attendance_incident_events
BEGIN
 SELECT RAISE(ABORT,'ATTENDANCE_TEACHER_DENIED') WHERE NOT EXISTS (
  SELECT 1 FROM lessons l
  JOIN learners child ON child.id=l.learner_id
  JOIN accounts owner ON owner.id=child.account_id
  JOIN teachers t ON t.id=l.actual_teacher_id
  WHERE l.id=NEW.lesson_id AND child.id=NEW.learner_id
    AND child.status='active' AND owner.status='active'
    AND t.auth_subject=NEW.actor_subject AND t.qualified=1 AND t.status='active'
    AND (EXISTS (
      SELECT 1 FROM teacher_assignments g
      WHERE g.teacher_id=t.id AND g.learner_id=child.id
       AND g.revoked_at_ms IS NULL AND g.starts_at_ms<=l.starts_at_ms
       AND g.ends_at_ms>=l.ends_at_ms
    ) OR EXISTS(
      SELECT 1 FROM lesson_access_grants g
      WHERE g.teacher_id=t.id AND g.lesson_id=l.id AND g.learner_id=child.id
       AND g.revoked_at_ms IS NULL AND g.starts_at_ms<=l.starts_at_ms
       AND g.ends_at_ms>=l.ends_at_ms
       AND (g.kind='primary' OR (g.kind='substitute'
         AND g.accepted_at_ms IS NOT NULL AND g.consent_deadline_ms IS NOT NULL
         AND g.accepted_at_ms<=g.consent_deadline_ms
         AND g.accepted_at_ms<=NEW.reported_at_ms))
    ))
 );
 SELECT RAISE(ABORT,'ATTENDANCE_NO_SHOW_NOT_ELIGIBLE') WHERE NEW.kind='student_no_show' AND NOT EXISTS(
  SELECT 1 FROM lessons l WHERE l.id=NEW.lesson_id AND l.learner_id=NEW.learner_id
   AND l.status='scheduled' AND NEW.reported_at_ms>=l.starts_at_ms+900000
   AND NEW.reported_at_ms<=l.starts_at_ms+86400000
   AND NOT EXISTS(SELECT 1 FROM lesson_lifecycle_events s
    WHERE s.lesson_id=l.id AND s.action='start')
 );
 SELECT RAISE(ABORT,'ATTENDANCE_CONNECTION_NOT_LIVE') WHERE
  NEW.kind='connection_interruption' AND NOT EXISTS (
   SELECT 1 FROM lessons l WHERE l.id=NEW.lesson_id AND l.learner_id=NEW.learner_id
   AND l.status='live');
END;
CREATE TRIGGER attendance_incident_no_update BEFORE UPDATE ON attendance_incident_events
BEGIN SELECT RAISE(ABORT,'ATTENDANCE_IMMUTABLE'); END;
CREATE TRIGGER attendance_incident_no_delete BEFORE DELETE ON attendance_incident_events
BEGIN SELECT RAISE(ABORT,'ATTENDANCE_IMMUTABLE'); END;

CREATE TABLE attendance_appeal_events (
 id TEXT NOT NULL PRIMARY KEY CHECK(length(id)=36),
 operation_id TEXT NOT NULL UNIQUE CHECK(length(operation_id)=36),
 incident_id TEXT NOT NULL UNIQUE REFERENCES attendance_incident_events(id) ON DELETE RESTRICT,
 learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE RESTRICT,
 actor_subject TEXT NOT NULL,
 reason TEXT NOT NULL CHECK(length(trim(reason)) BETWEEN 10 AND 1000),
 submitted_at_ms INTEGER NOT NULL CHECK(submitted_at_ms>=0)
) STRICT;
CREATE INDEX attendance_appeal_learner ON attendance_appeal_events(learner_id,submitted_at_ms DESC);
CREATE TRIGGER attendance_appeal_guard BEFORE INSERT ON attendance_appeal_events
BEGIN
 SELECT RAISE(ABORT,'ATTENDANCE_APPEAL_DENIED') WHERE NOT EXISTS(
  SELECT 1 FROM attendance_incident_events incident
  JOIN learners child ON child.id=incident.learner_id
  JOIN accounts owner ON owner.id=child.account_id
  WHERE incident.id=NEW.incident_id AND incident.learner_id=NEW.learner_id
    AND incident.kind='student_no_show'
    AND child.status='active' AND owner.status='active'
    AND owner.auth_subject=NEW.actor_subject
    AND NEW.submitted_at_ms>=incident.reported_at_ms
    AND NEW.submitted_at_ms<=incident.reported_at_ms+604800000
 );
END;
CREATE TRIGGER attendance_appeal_no_update BEFORE UPDATE ON attendance_appeal_events
BEGIN SELECT RAISE(ABORT,'ATTENDANCE_APPEAL_IMMUTABLE'); END;
CREATE TRIGGER attendance_appeal_no_delete BEFORE DELETE ON attendance_appeal_events
BEGIN SELECT RAISE(ABORT,'ATTENDANCE_APPEAL_IMMUTABLE'); END;

CREATE TABLE attendance_review_events (
 id TEXT NOT NULL PRIMARY KEY CHECK(length(id)=36),
 operation_id TEXT NOT NULL UNIQUE CHECK(length(operation_id)=36),
 appeal_id TEXT NOT NULL UNIQUE REFERENCES attendance_appeal_events(id) ON DELETE RESTRICT,
 actor_subject TEXT NOT NULL,
 decision TEXT NOT NULL CHECK(decision IN ('accepted','rejected')),
 reason TEXT NOT NULL CHECK(length(trim(reason)) BETWEEN 10 AND 500),
 reviewed_at_ms INTEGER NOT NULL CHECK(reviewed_at_ms>=0)
) STRICT;
CREATE TRIGGER attendance_review_guard BEFORE INSERT ON attendance_review_events
BEGIN
 SELECT RAISE(ABORT,'ATTENDANCE_STAFF_DENIED') WHERE NOT EXISTS(
  SELECT 1 FROM staff_grants g JOIN accounts a ON a.auth_subject=g.auth_subject
  WHERE g.auth_subject=NEW.actor_subject AND g.permission='attendance.review'
   AND g.revoked_at_ms IS NULL AND a.status='active'
 );
 SELECT RAISE(ABORT,'ATTENDANCE_REVIEW_TIME_INVALID') WHERE NOT EXISTS(
  SELECT 1 FROM attendance_appeal_events a
  WHERE a.id=NEW.appeal_id AND NEW.reviewed_at_ms>=a.submitted_at_ms
 );
END;
CREATE TRIGGER attendance_review_no_update BEFORE UPDATE ON attendance_review_events
BEGIN SELECT RAISE(ABORT,'ATTENDANCE_REVIEW_IMMUTABLE'); END;
CREATE TRIGGER attendance_review_no_delete BEFORE DELETE ON attendance_review_events
BEGIN SELECT RAISE(ABORT,'ATTENDANCE_REVIEW_IMMUTABLE'); END;
INSERT INTO noor_schema_meta(component,version) VALUES('attendance_cases',1);
