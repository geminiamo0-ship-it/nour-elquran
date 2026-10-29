-- Teacher B2: append-only, staff-authorized commands with atomic state transitions.
-- The first roles.manage staff grant is provisioned by a trusted D1 operator,
-- never through this API. No routine teacher record is created by signup.
CREATE TABLE teacher_role_events (
  id TEXT NOT NULL PRIMARY KEY,
  operation_id TEXT NOT NULL UNIQUE CHECK(length(operation_id) BETWEEN 8 AND 128),
  teacher_id TEXT NOT NULL,
  actor_auth_subject TEXT NOT NULL REFERENCES auth_users(id) ON DELETE RESTRICT,
  target_auth_subject TEXT NOT NULL REFERENCES auth_users(id) ON DELETE RESTRICT,
  action TEXT NOT NULL CHECK(action IN ('provision','qualify','activate','suspend','revoke_qualification')),
  reason TEXT NOT NULL CHECK(length(trim(reason)) BETWEEN 8 AND 500),
  at_ms INTEGER NOT NULL CHECK(at_ms >= 0)
) STRICT;
CREATE INDEX teacher_role_events_subject ON teacher_role_events(target_auth_subject,at_ms DESC,id);

CREATE TRIGGER teacher_role_event_validate BEFORE INSERT ON teacher_role_events
BEGIN
  SELECT RAISE(ABORT,'staff grant not active or identity not verified')
  WHERE NOT EXISTS (
    SELECT 1 FROM staff_grants grant_row
    JOIN auth_users actor ON actor.id=grant_row.auth_subject
    JOIN accounts actor_account ON actor_account.auth_subject=actor.id
    WHERE grant_row.auth_subject=NEW.actor_auth_subject
      AND grant_row.permission='roles.manage' AND grant_row.revoked_at_ms IS NULL
      AND actor.phone_number_verified=1 AND actor_account.status='active'
  );
  SELECT RAISE(ABORT,'staff cannot manage own teacher role')
    WHERE NEW.actor_auth_subject=NEW.target_auth_subject;
  SELECT RAISE(ABORT,'target account requires verified identity')
  WHERE NEW.action IN ('provision','qualify','activate') AND NOT EXISTS (
    SELECT 1 FROM auth_users target
    JOIN accounts target_account ON target_account.auth_subject=target.id
    WHERE target.id=NEW.target_auth_subject
      AND target.phone_number_verified=1 AND target_account.status='active'
  );
  SELECT RAISE(ABORT,'teacher role already provisioned')
  WHERE NEW.action='provision' AND (
    EXISTS(SELECT 1 FROM teachers t WHERE t.auth_subject=NEW.target_auth_subject)
    OR EXISTS(SELECT 1 FROM teachers t WHERE t.id=NEW.teacher_id)
  );
  SELECT RAISE(ABORT,'teacher identity mismatch or missing')
  WHERE NEW.action<>'provision' AND NOT EXISTS(
    SELECT 1 FROM teachers t WHERE t.id=NEW.teacher_id AND t.auth_subject=NEW.target_auth_subject
  );
  SELECT RAISE(ABORT,'qualification transition denied')
  WHERE NEW.action='qualify' AND NOT EXISTS(
    SELECT 1 FROM teachers t WHERE t.id=NEW.teacher_id AND t.qualified=0 AND t.status='disabled'
  );
  SELECT RAISE(ABORT,'activation transition denied')
  WHERE NEW.action='activate' AND NOT EXISTS(
    SELECT 1 FROM teachers t WHERE t.id=NEW.teacher_id AND t.qualified=1 AND t.status='disabled'
  );
  SELECT RAISE(ABORT,'suspension transition denied')
  WHERE NEW.action='suspend' AND NOT EXISTS(
    SELECT 1 FROM teachers t WHERE t.id=NEW.teacher_id AND t.status='active'
  );
  SELECT RAISE(ABORT,'qualification revocation denied')
  WHERE NEW.action='revoke_qualification' AND NOT EXISTS(
    SELECT 1 FROM teachers t WHERE t.id=NEW.teacher_id AND t.qualified=1
  );
END;

CREATE TRIGGER teacher_role_event_apply AFTER INSERT ON teacher_role_events
BEGIN
  INSERT INTO teachers(id,auth_subject,qualified,status)
  SELECT NEW.teacher_id,NEW.target_auth_subject,0,'disabled' WHERE NEW.action='provision';
  UPDATE teachers SET qualified=1 WHERE id=NEW.teacher_id AND NEW.action='qualify';
  UPDATE teachers SET status='active' WHERE id=NEW.teacher_id AND NEW.action='activate';
  UPDATE teachers SET status='disabled' WHERE id=NEW.teacher_id AND NEW.action='suspend';
  UPDATE teachers SET qualified=0,status='disabled'
    WHERE id=NEW.teacher_id AND NEW.action='revoke_qualification';
END;
CREATE TRIGGER teacher_role_events_immutable_update BEFORE UPDATE ON teacher_role_events
BEGIN
  SELECT RAISE(ABORT,'teacher role audit immutable');
END;
CREATE TRIGGER teacher_role_events_immutable_delete BEFORE DELETE ON teacher_role_events
BEGIN
  SELECT RAISE(ABORT,'teacher role audit immutable');
END;
INSERT INTO noor_schema_meta(component,version) VALUES('teacher_roles',1);
