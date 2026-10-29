-- Phase 05B: append-only student submissions and teacher reviews.
-- No child audio or scores; all rows keyed by existing published assignment.
CREATE TABLE assignment_submission_events (
  operation_id TEXT NOT NULL PRIMARY KEY CHECK(length(operation_id)=36),
  id TEXT NOT NULL UNIQUE CHECK(length(id)=36),
  assignment_id TEXT NOT NULL REFERENCES learner_assignments(id) ON DELETE RESTRICT,
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE RESTRICT,
  actor_auth_subject TEXT NOT NULL,
  attempt INTEGER NOT NULL CHECK(attempt BETWEEN 1 AND 5),
  note TEXT NOT NULL CHECK(length(note)<=500),
  submitted_at_ms INTEGER NOT NULL CHECK(submitted_at_ms>=0),
  UNIQUE(assignment_id,attempt)
) STRICT;
CREATE INDEX assignment_submission_lookup ON assignment_submission_events(assignment_id,attempt DESC);

CREATE TABLE assignment_review_events (
  operation_id TEXT NOT NULL PRIMARY KEY CHECK(length(operation_id)=36),
  id TEXT NOT NULL UNIQUE CHECK(length(id)=36),
  submission_id TEXT NOT NULL UNIQUE REFERENCES assignment_submission_events(id) ON DELETE RESTRICT,
  assignment_id TEXT NOT NULL REFERENCES learner_assignments(id) ON DELETE RESTRICT,
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE RESTRICT,
  actor_auth_subject TEXT NOT NULL,
  decision TEXT NOT NULL CHECK(decision IN ('accepted','retry_requested')),
  feedback TEXT NOT NULL CHECK(length(trim(feedback)) BETWEEN 1 AND 1000),
  reviewed_at_ms INTEGER NOT NULL CHECK(reviewed_at_ms>=0)
) STRICT;
CREATE INDEX assignment_review_assignment ON assignment_review_events(assignment_id,reviewed_at_ms DESC);

CREATE TRIGGER submission_insert_guard BEFORE INSERT ON assignment_submission_events BEGIN
  SELECT RAISE(ABORT,'SUBMISSION_OWNER_DENIED') WHERE NOT EXISTS (
    SELECT 1 FROM learner_assignments task
    JOIN learners student ON student.id=task.learner_id
    JOIN accounts owner ON owner.id=student.account_id
    WHERE task.id=NEW.assignment_id AND task.learner_id=NEW.learner_id
      AND task.status='assigned' AND student.status='active' AND owner.status='active'
      AND owner.auth_subject=NEW.actor_auth_subject
  );
  SELECT RAISE(ABORT,'SUBMISSION_INVALID_ATTEMPT') WHERE NEW.attempt !=
    COALESCE((SELECT MAX(attempt) FROM assignment_submission_events WHERE assignment_id=NEW.assignment_id),0)+1;
  SELECT RAISE(ABORT,'SUBMISSION_NOT_RETRYABLE') WHERE EXISTS (
    SELECT 1 FROM assignment_submission_events prev
    WHERE prev.assignment_id=NEW.assignment_id
      AND prev.attempt=(SELECT MAX(attempt) FROM assignment_submission_events WHERE assignment_id=NEW.assignment_id)
      AND NOT EXISTS (
        SELECT 1 FROM assignment_review_events review
        WHERE review.submission_id=prev.id AND review.decision='retry_requested'
      )
  );
END;
CREATE TRIGGER review_insert_guard BEFORE INSERT ON assignment_review_events BEGIN
  SELECT RAISE(ABORT,'REVIEW_TARGET_DENIED') WHERE NOT EXISTS (
    SELECT 1 FROM assignment_submission_events submission
    JOIN learner_assignments task ON task.id=submission.assignment_id
    WHERE submission.id=NEW.submission_id
      AND submission.assignment_id=NEW.assignment_id
      AND submission.learner_id=NEW.learner_id
      AND task.learner_id=NEW.learner_id
  );
  SELECT RAISE(ABORT,'REVIEW_TEACHER_DENIED') WHERE NOT EXISTS (
    SELECT 1 FROM learners student
    JOIN accounts owner ON owner.id=student.account_id
    JOIN teacher_assignments active_assignment ON active_assignment.learner_id=student.id
    JOIN teachers teacher ON teacher.id=active_assignment.teacher_id
    WHERE student.id=NEW.learner_id AND student.status='active' AND owner.status='active'
      AND teacher.auth_subject=NEW.actor_auth_subject
      AND teacher.status='active' AND teacher.qualified=1
      AND active_assignment.revoked_at_ms IS NULL
      AND active_assignment.starts_at_ms<=NEW.reviewed_at_ms
      AND active_assignment.ends_at_ms>NEW.reviewed_at_ms
  );
  SELECT RAISE(ABORT,'REVIEW_NOT_LATEST_ATTEMPT') WHERE EXISTS (
    SELECT 1 FROM assignment_submission_events newer
    WHERE newer.assignment_id=NEW.assignment_id AND newer.attempt>
     (SELECT attempt FROM assignment_submission_events WHERE id=NEW.submission_id)
  );
END;
CREATE TRIGGER submission_immutable_update BEFORE UPDATE ON assignment_submission_events
 BEGIN SELECT RAISE(ABORT,'SUBMISSION_IMMUTABLE'); END;
CREATE TRIGGER submission_immutable_delete BEFORE DELETE ON assignment_submission_events
 BEGIN SELECT RAISE(ABORT,'SUBMISSION_IMMUTABLE'); END;
CREATE TRIGGER review_immutable_update BEFORE UPDATE ON assignment_review_events
 BEGIN SELECT RAISE(ABORT,'REVIEW_IMMUTABLE'); END;
CREATE TRIGGER review_immutable_delete BEFORE DELETE ON assignment_review_events
 BEGIN SELECT RAISE(ABORT,'REVIEW_IMMUTABLE'); END;
INSERT INTO noor_schema_meta(component,version) VALUES('assignment_submissions',1);
