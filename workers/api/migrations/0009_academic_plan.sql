-- #162: teacher-authored academic plan, visible to its owner after save.
-- Never replaces learner-private Quran notes, assignments or classroom history.
CREATE TABLE learner_academic_plans (
 learner_id TEXT NOT NULL PRIMARY KEY REFERENCES learners(id) ON DELETE RESTRICT,
 level TEXT NOT NULL CHECK(level IN ('beginner','intermediate','advanced')),
 next_wird TEXT NOT NULL CHECK(length(trim(next_wird)) BETWEEN 1 AND 300),
 revision_wird TEXT NOT NULL CHECK(length(trim(revision_wird)) BETWEEN 1 AND 500),
 focus TEXT NOT NULL CHECK(length(trim(focus)) BETWEEN 1 AND 500),
 revision INTEGER NOT NULL CHECK(revision>=1),
 updated_by TEXT NOT NULL,
 updated_at_ms INTEGER NOT NULL CHECK(updated_at_ms>=0)
) STRICT;

CREATE TABLE academic_plan_events (
 operation_id TEXT NOT NULL PRIMARY KEY CHECK(length(operation_id)=36),
 learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE RESTRICT,
 actor_auth_subject TEXT NOT NULL,
 expected_revision INTEGER NOT NULL CHECK(expected_revision>=0),
 level TEXT NOT NULL CHECK(level IN ('beginner','intermediate','advanced')),
 next_wird TEXT NOT NULL CHECK(length(trim(next_wird)) BETWEEN 1 AND 300),
 revision_wird TEXT NOT NULL CHECK(length(trim(revision_wird)) BETWEEN 1 AND 500),
 focus TEXT NOT NULL CHECK(length(trim(focus)) BETWEEN 1 AND 500),
 at_ms INTEGER NOT NULL CHECK(at_ms>=0)
) STRICT;
CREATE INDEX academic_plan_events_learner ON academic_plan_events(learner_id,at_ms,operation_id);

CREATE TABLE academic_plan_audit (
 operation_id TEXT PRIMARY KEY NOT NULL REFERENCES academic_plan_events(operation_id) ON DELETE RESTRICT,
 learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE RESTRICT,
 previous_level TEXT, previous_next_wird TEXT, previous_revision_wird TEXT, previous_focus TEXT,
 previous_revision INTEGER NOT NULL CHECK(previous_revision>=0),
 new_revision INTEGER NOT NULL CHECK(new_revision=previous_revision+1)
) STRICT;

CREATE TRIGGER academic_plan_event_guard BEFORE INSERT ON academic_plan_events
BEGIN
 SELECT RAISE(ABORT,'PLAN_ACCESS_DENIED') WHERE NOT EXISTS (
  SELECT 1 FROM learners l
  JOIN accounts owner ON owner.id=l.account_id
  JOIN teacher_assignments assignment ON assignment.learner_id=l.id
  JOIN teachers teacher ON teacher.id=assignment.teacher_id
  WHERE l.id=NEW.learner_id AND l.status='active' AND owner.status='active'
   AND teacher.auth_subject=NEW.actor_auth_subject AND teacher.status='active'
   AND teacher.qualified=1 AND assignment.revoked_at_ms IS NULL
   AND assignment.starts_at_ms<=NEW.at_ms AND assignment.ends_at_ms>NEW.at_ms
 );
 SELECT RAISE(ABORT,'PLAN_REVISION_CONFLICT') WHERE
   (NEW.expected_revision=0 AND EXISTS(
      SELECT 1 FROM learner_academic_plans WHERE learner_id=NEW.learner_id))
   OR (NEW.expected_revision>0 AND NOT EXISTS(
      SELECT 1 FROM learner_academic_plans
      WHERE learner_id=NEW.learner_id AND revision=NEW.expected_revision));
END;

CREATE TRIGGER academic_plan_event_apply AFTER INSERT ON academic_plan_events
BEGIN
 INSERT INTO academic_plan_audit
  (operation_id,learner_id,previous_level,previous_next_wird,previous_revision_wird,
   previous_focus,previous_revision,new_revision)
 SELECT NEW.operation_id,NEW.learner_id,p.level,p.next_wird,p.revision_wird,
  p.focus,COALESCE(p.revision,0),NEW.expected_revision+1
 FROM learners l LEFT JOIN learner_academic_plans p ON p.learner_id=l.id
 WHERE l.id=NEW.learner_id;

 INSERT INTO learner_academic_plans
  (learner_id,level,next_wird,revision_wird,focus,revision,updated_by,updated_at_ms)
 VALUES(NEW.learner_id,NEW.level,trim(NEW.next_wird),trim(NEW.revision_wird),
        trim(NEW.focus),NEW.expected_revision+1,NEW.actor_auth_subject,NEW.at_ms)
 ON CONFLICT(learner_id) DO UPDATE SET
  level=excluded.level,next_wird=excluded.next_wird,revision_wird=excluded.revision_wird,
  focus=excluded.focus,revision=excluded.revision,
  updated_by=excluded.updated_by,updated_at_ms=excluded.updated_at_ms;
END;
CREATE TRIGGER academic_plan_events_no_update BEFORE UPDATE ON academic_plan_events
BEGIN SELECT RAISE(ABORT,'PLAN_AUDIT_IMMUTABLE'); END;
CREATE TRIGGER academic_plan_events_no_delete BEFORE DELETE ON academic_plan_events
BEGIN SELECT RAISE(ABORT,'PLAN_AUDIT_IMMUTABLE'); END;
CREATE TRIGGER academic_plan_audit_no_update BEFORE UPDATE ON academic_plan_audit
BEGIN SELECT RAISE(ABORT,'PLAN_AUDIT_IMMUTABLE'); END;
CREATE TRIGGER academic_plan_audit_no_delete BEFORE DELETE ON academic_plan_audit
BEGIN SELECT RAISE(ABORT,'PLAN_AUDIT_IMMUTABLE'); END;

INSERT INTO noor_schema_meta(component,version) VALUES('academic_plan',1);
