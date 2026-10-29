-- #157: only the verified account owner may rename/archive an active learner.
-- No hard delete: historical lessons/annotations retain their learner FK.
ALTER TABLE learners ADD COLUMN revision INTEGER NOT NULL DEFAULT 1 CHECK(revision > 0);

CREATE TABLE learner_profile_events (
  operation_id TEXT NOT NULL PRIMARY KEY CHECK(length(operation_id)=36),
  learner_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  actor_auth_subject TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('rename','archive')),
  expected_revision INTEGER NOT NULL CHECK(expected_revision>0),
  new_name TEXT,
  at_ms INTEGER NOT NULL CHECK(at_ms>=0),
  FOREIGN KEY(learner_id,account_id) REFERENCES learners(id,account_id) ON DELETE RESTRICT,
  CHECK((action='rename' AND new_name IS NOT NULL AND length(trim(new_name)) BETWEEN 1 AND 50)
      OR (action='archive' AND new_name IS NULL))
) STRICT;
CREATE INDEX learner_profile_events_learner ON learner_profile_events(learner_id,at_ms,operation_id);

-- Immutable snapshot of the exact before/after state at application time.
CREATE TABLE learner_profile_audit (
  operation_id TEXT NOT NULL PRIMARY KEY REFERENCES learner_profile_events(operation_id) ON DELETE RESTRICT,
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE RESTRICT,
  previous_name TEXT NOT NULL,
  updated_name TEXT NOT NULL,
  previous_status TEXT NOT NULL CHECK(previous_status='active'),
  updated_status TEXT NOT NULL CHECK(updated_status IN ('active','archived')),
  previous_revision INTEGER NOT NULL CHECK(previous_revision>0),
  updated_revision INTEGER NOT NULL CHECK(updated_revision=previous_revision+1)
) STRICT;
CREATE TRIGGER learner_profile_audit_immutable_update BEFORE UPDATE ON learner_profile_audit
BEGIN SELECT RAISE(ABORT,'PROFILE_AUDIT_IMMUTABLE'); END;
CREATE TRIGGER learner_profile_audit_immutable_delete BEFORE DELETE ON learner_profile_audit
BEGIN SELECT RAISE(ABORT,'PROFILE_AUDIT_IMMUTABLE'); END;

-- Recheck ownership, revocation and CAS *inside* the database write transaction.
CREATE TRIGGER learner_profile_event_validate BEFORE INSERT ON learner_profile_events
BEGIN
  SELECT RAISE(ABORT,'PROFILE_STALE_OR_FORBIDDEN') WHERE NOT EXISTS(
    SELECT 1 FROM learners learner
    JOIN accounts owner ON owner.id=learner.account_id
    WHERE learner.id=NEW.learner_id AND owner.id=NEW.account_id
      AND owner.auth_subject=NEW.actor_auth_subject AND owner.status='active'
      AND learner.status='active' AND learner.revision=NEW.expected_revision
  );
  SELECT RAISE(ABORT,'PROFILE_NO_CHANGE')
  WHERE NEW.action='rename' AND EXISTS(
    SELECT 1 FROM learners WHERE id=NEW.learner_id AND display_name=trim(NEW.new_name)
  );
END;
CREATE TRIGGER learner_profile_event_apply AFTER INSERT ON learner_profile_events
BEGIN
  INSERT INTO learner_profile_audit
    (operation_id,learner_id,previous_name,updated_name,previous_status,updated_status,previous_revision,updated_revision)
  SELECT NEW.operation_id,id,display_name,
    CASE WHEN NEW.action='rename' THEN trim(NEW.new_name) ELSE display_name END,
    status,CASE WHEN NEW.action='archive' THEN 'archived' ELSE status END,
    revision,revision+1
  FROM learners WHERE id=NEW.learner_id AND account_id=NEW.account_id;
  UPDATE learners
  SET display_name=CASE WHEN NEW.action='rename' THEN trim(NEW.new_name) ELSE display_name END,
      status=CASE WHEN NEW.action='archive' THEN 'archived' ELSE status END,
      revision=revision+1
  WHERE id=NEW.learner_id AND account_id=NEW.account_id;
END;
CREATE TRIGGER learner_profile_events_immutable_update BEFORE UPDATE ON learner_profile_events
BEGIN SELECT RAISE(ABORT,'PROFILE_AUDIT_IMMUTABLE'); END;
CREATE TRIGGER learner_profile_events_immutable_delete BEFORE DELETE ON learner_profile_events
BEGIN SELECT RAISE(ABORT,'PROFILE_AUDIT_IMMUTABLE'); END;
INSERT INTO noor_schema_meta(component,version) VALUES('learner_profiles',1);
