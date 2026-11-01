-- #315: Admin MVP manual academy catalog, requests, invitation and audited settlement.
-- Append-only business events; never imply a WhatsApp click proves payment.
-- Real subscription units continue in subscription_cycles (migration 0026).
CREATE TABLE academy_package_events (
 id TEXT PRIMARY KEY NOT NULL CHECK(length(id)=36),
 operation_id TEXT NOT NULL UNIQUE CHECK(length(operation_id)=36),
 package_id TEXT NOT NULL CHECK(length(package_id)=36),
 actor_subject TEXT NOT NULL REFERENCES auth_users(id),
 title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 2 AND 80),
 price_egp INTEGER NOT NULL CHECK(price_egp BETWEEN 1 AND 100000),
 sessions INTEGER NOT NULL CHECK(sessions BETWEEN 1 AND 60),
 active INTEGER NOT NULL CHECK(active IN (0,1)),
 at_ms INTEGER NOT NULL CHECK(at_ms>=0)
) STRICT;
CREATE INDEX academy_package_versions ON academy_package_events(package_id,at_ms DESC,id DESC);
CREATE TABLE academy_request_events (
 id TEXT NOT NULL PRIMARY KEY CHECK(length(id)=36),
 operation_id TEXT NOT NULL UNIQUE CHECK(length(operation_id)=36),
 learner_id TEXT NOT NULL REFERENCES learners(id),
 actor_subject TEXT NOT NULL REFERENCES auth_users(id),
 package_id TEXT NOT NULL CHECK(length(package_id)=36),
 package_version_id TEXT NOT NULL REFERENCES academy_package_events(id),
 kind TEXT NOT NULL CHECK(kind='subscription'),
 at_ms INTEGER NOT NULL CHECK(at_ms>=0)
) STRICT;
CREATE INDEX academy_requests_learner ON academy_request_events(learner_id,at_ms DESC,id DESC);
CREATE TABLE academy_subscription_activation_events (
 id TEXT NOT NULL PRIMARY KEY CHECK(length(id)=36),
 operation_id TEXT NOT NULL UNIQUE CHECK(length(operation_id)=36),
 actor_subject TEXT NOT NULL REFERENCES auth_users(id),
 learner_id TEXT NOT NULL REFERENCES learners(id),
 request_id TEXT UNIQUE REFERENCES academy_request_events(id),
 package_version_id TEXT NOT NULL REFERENCES academy_package_events(id),
 cycle_id TEXT NOT NULL UNIQUE CHECK(length(cycle_id)=36),
 previous_cycle_id TEXT REFERENCES subscription_cycles(id),
 rollover_sessions INTEGER NOT NULL CHECK(rollover_sessions BETWEEN 0 AND 60),
 starts_at_ms INTEGER NOT NULL,
 ends_at_ms INTEGER NOT NULL,
 note TEXT NOT NULL CHECK(length(trim(note)) BETWEEN 10 AND 500),
 manually_confirmed INTEGER NOT NULL CHECK(manually_confirmed=1),
 at_ms INTEGER NOT NULL CHECK(at_ms=starts_at_ms)
) STRICT;
CREATE TABLE academy_request_rejections (
 id TEXT PRIMARY KEY NOT NULL CHECK(length(id)=36),
 operation_id TEXT NOT NULL UNIQUE CHECK(length(operation_id)=36),
 request_id TEXT NOT NULL UNIQUE REFERENCES academy_request_events(id),
 actor_subject TEXT NOT NULL REFERENCES auth_users(id),
 reason TEXT NOT NULL CHECK(length(trim(reason)) BETWEEN 8 AND 500),
 at_ms INTEGER NOT NULL
) STRICT;
CREATE TABLE academy_contact_events (
 id TEXT PRIMARY KEY NOT NULL CHECK(length(id)=36),
 operation_id TEXT NOT NULL UNIQUE CHECK(length(operation_id)=36),
 actor_subject TEXT NOT NULL REFERENCES auth_users(id),
 whatsapp_number TEXT NOT NULL CHECK(length(whatsapp_number) BETWEEN 10 AND 15 AND whatsapp_number NOT GLOB '*[^0-9]*'),
 at_ms INTEGER NOT NULL
) STRICT;
CREATE TABLE academy_teacher_invites (
 id TEXT PRIMARY KEY NOT NULL CHECK(length(id)=36),
 operation_id TEXT NOT NULL UNIQUE CHECK(length(operation_id)=36),
 token_hash TEXT NOT NULL UNIQUE CHECK(length(token_hash)=64),
 actor_subject TEXT NOT NULL REFERENCES auth_users(id),
 created_at_ms INTEGER NOT NULL,
 expires_at_ms INTEGER NOT NULL CHECK(expires_at_ms>created_at_ms AND expires_at_ms<=created_at_ms+604800000),
 claimed_subject TEXT UNIQUE REFERENCES auth_users(id),
 claimed_at_ms INTEGER,
 CHECK((claimed_subject IS NULL AND claimed_at_ms IS NULL) OR
       (claimed_subject IS NOT NULL AND claimed_at_ms IS NOT NULL AND claimed_at_ms<=expires_at_ms))
) STRICT;
CREATE INDEX academy_invites_date ON academy_teacher_invites(created_at_ms DESC,id DESC);

-- Every staff-authored write is independently verified inside the same D1 transaction.
CREATE TRIGGER academy_package_staff BEFORE INSERT ON academy_package_events BEGIN
 SELECT RAISE(ABORT,'ACADEMY_STAFF_DENIED') WHERE NOT EXISTS (
  SELECT 1 FROM staff_grants g JOIN auth_users u ON u.id=g.auth_subject
  JOIN accounts a ON a.auth_subject=u.id WHERE g.auth_subject=NEW.actor_subject
   AND g.permission='roles.manage' AND g.revoked_at_ms IS NULL
   AND u.phone_number_verified=1 AND a.status='active');
 SELECT RAISE(ABORT,'ACADEMY_PACKAGE_STALE') WHERE EXISTS(
  SELECT 1 FROM academy_package_events p WHERE p.package_id=NEW.package_id
   AND p.at_ms>=NEW.at_ms);
END;
CREATE TRIGGER academy_request_owner BEFORE INSERT ON academy_request_events BEGIN
 SELECT RAISE(ABORT,'ACADEMY_OWNER_DENIED') WHERE NOT EXISTS(
  SELECT 1 FROM learners l JOIN accounts a ON a.id=l.account_id
  WHERE l.id=NEW.learner_id AND a.auth_subject=NEW.actor_subject
   AND l.status='active' AND a.status='active');
 SELECT RAISE(ABORT,'ACADEMY_PACKAGE_UNAVAILABLE') WHERE NOT EXISTS(
  SELECT 1 FROM academy_package_events p WHERE p.id=NEW.package_version_id
    AND p.package_id=NEW.package_id AND p.active=1
    AND NOT EXISTS (SELECT 1 FROM academy_package_events n
     WHERE n.package_id=p.package_id AND (n.at_ms>p.at_ms OR
      (n.at_ms=p.at_ms AND n.id>p.id))));
 SELECT RAISE(ABORT,'ACADEMY_REQUEST_PENDING') WHERE EXISTS(
  SELECT 1 FROM academy_request_events r WHERE r.learner_id=NEW.learner_id
  AND NOT EXISTS (SELECT 1 FROM academy_subscription_activation_events a
   WHERE a.request_id=r.id)
  AND NOT EXISTS (SELECT 1 FROM academy_request_rejections d WHERE d.request_id=r.id));
END;
CREATE TRIGGER academy_activation_staff BEFORE INSERT ON academy_subscription_activation_events BEGIN
 SELECT RAISE(ABORT,'ACADEMY_STAFF_DENIED') WHERE NOT EXISTS (
  SELECT 1 FROM staff_grants g JOIN auth_users u ON u.id=g.auth_subject
  JOIN accounts a ON a.auth_subject=u.id WHERE g.auth_subject=NEW.actor_subject
   AND g.permission='roles.manage' AND g.revoked_at_ms IS NULL
   AND u.phone_number_verified=1 AND a.status='active');
 SELECT RAISE(ABORT,'ACADEMY_LEARNER_DENIED') WHERE NOT EXISTS(
  SELECT 1 FROM learners l JOIN accounts a ON a.id=l.account_id WHERE l.id=NEW.learner_id
  AND l.status='active' AND a.status='active');
 SELECT RAISE(ABORT,'ACADEMY_VERSION_DENIED') WHERE NOT EXISTS(
  SELECT 1 FROM academy_package_events p WHERE p.id=NEW.package_version_id AND p.active=1
  AND (NEW.request_id IS NOT NULL OR NOT EXISTS(
   SELECT 1 FROM academy_package_events n
   WHERE n.package_id=p.package_id AND (n.at_ms>p.at_ms OR
    (n.at_ms=p.at_ms AND n.id>p.id)))));
 -- Existing student requests retain their immutable quoted historical price
 -- even if Admin edited the package afterward. Direct grants use current price.
 SELECT RAISE(ABORT,'ACADEMY_REQUEST_MISMATCH') WHERE NEW.request_id IS NOT NULL AND NOT EXISTS(
  SELECT 1 FROM academy_request_events r WHERE r.id=NEW.request_id
   AND r.learner_id=NEW.learner_id AND r.package_version_id=NEW.package_version_id
   AND NOT EXISTS(SELECT 1 FROM academy_request_rejections d WHERE d.request_id=r.id));
END;
-- Activation + existing academic cycle are committed atomically and remain auditable.
CREATE TRIGGER academy_activation_apply AFTER INSERT ON academy_subscription_activation_events BEGIN
 INSERT INTO subscription_cycles(id,operation_id,learner_id,actor_subject,previous_cycle_id,
  starts_at_ms,ends_at_ms,base_sessions,rollover_sessions,reason,at_ms)
 SELECT NEW.cycle_id,NEW.operation_id,NEW.learner_id,NEW.actor_subject,NEW.previous_cycle_id,
  NEW.starts_at_ms,NEW.ends_at_ms,p.sessions,NEW.rollover_sessions,NEW.note,NEW.at_ms
 FROM academy_package_events p WHERE p.id=NEW.package_version_id;
END;
CREATE TRIGGER academy_reject_staff BEFORE INSERT ON academy_request_rejections BEGIN
 SELECT RAISE(ABORT,'ACADEMY_STAFF_DENIED') WHERE NOT EXISTS(
 SELECT 1 FROM staff_grants g JOIN auth_users u ON u.id=g.auth_subject
 JOIN accounts a ON a.auth_subject=u.id WHERE g.auth_subject=NEW.actor_subject
  AND g.permission='roles.manage' AND g.revoked_at_ms IS NULL
  AND u.phone_number_verified=1 AND a.status='active');
 SELECT RAISE(ABORT,'ACADEMY_REQUEST_SETTLED') WHERE EXISTS(
  SELECT 1 FROM academy_subscription_activation_events e WHERE e.request_id=NEW.request_id);
END;
CREATE TRIGGER academy_contact_staff BEFORE INSERT ON academy_contact_events BEGIN
 SELECT RAISE(ABORT,'ACADEMY_STAFF_DENIED') WHERE NOT EXISTS(
 SELECT 1 FROM staff_grants g JOIN auth_users u ON u.id=g.auth_subject
 JOIN accounts a ON a.auth_subject=u.id WHERE g.auth_subject=NEW.actor_subject
  AND g.permission='roles.manage' AND g.revoked_at_ms IS NULL
  AND u.phone_number_verified=1 AND a.status='active');
END;
CREATE TRIGGER academy_invite_staff BEFORE INSERT ON academy_teacher_invites BEGIN
 SELECT RAISE(ABORT,'ACADEMY_STAFF_DENIED') WHERE NOT EXISTS(
 SELECT 1 FROM staff_grants g JOIN auth_users u ON u.id=g.auth_subject
 JOIN accounts a ON a.auth_subject=u.id WHERE g.auth_subject=NEW.actor_subject
  AND g.permission='roles.manage' AND g.revoked_at_ms IS NULL
  AND u.phone_number_verified=1 AND a.status='active');
END;
CREATE TRIGGER academy_invite_claim BEFORE UPDATE OF claimed_subject,claimed_at_ms ON academy_teacher_invites BEGIN
 SELECT RAISE(ABORT,'ACADEMY_INVITE_ALREADY_CLAIMED') WHERE OLD.claimed_subject IS NOT NULL
  OR NEW.claimed_subject IS NULL OR NEW.claimed_at_ms IS NULL
  OR NEW.claimed_at_ms<OLD.created_at_ms OR NEW.claimed_at_ms>OLD.expires_at_ms;
 SELECT RAISE(ABORT,'ACADEMY_INVITE_ACTOR_DENIED') WHERE NOT EXISTS(
  SELECT 1 FROM auth_users u JOIN accounts a ON a.auth_subject=u.id
   WHERE u.id=NEW.claimed_subject AND a.status='active');
END;
CREATE TRIGGER academy_invite_no_delete BEFORE DELETE ON academy_teacher_invites BEGIN
 SELECT RAISE(ABORT,'ACADEMY_IMMUTABLE'); END;
CREATE TRIGGER academy_invite_no_update BEFORE UPDATE ON academy_teacher_invites
 WHEN NEW.claimed_subject=OLD.claimed_subject OR
 NEW.token_hash<>OLD.token_hash OR NEW.actor_subject<>OLD.actor_subject OR
 NEW.created_at_ms<>OLD.created_at_ms OR NEW.expires_at_ms<>OLD.expires_at_ms
 BEGIN SELECT RAISE(ABORT,'ACADEMY_IMMUTABLE'); END;

CREATE TRIGGER academy_package_events_immutable_update BEFORE UPDATE ON academy_package_events BEGIN SELECT RAISE(ABORT,'ACADEMY_IMMUTABLE'); END;
CREATE TRIGGER academy_package_events_immutable_delete BEFORE DELETE ON academy_package_events BEGIN SELECT RAISE(ABORT,'ACADEMY_IMMUTABLE'); END;
CREATE TRIGGER academy_request_events_immutable_update BEFORE UPDATE ON academy_request_events BEGIN SELECT RAISE(ABORT,'ACADEMY_IMMUTABLE'); END;
CREATE TRIGGER academy_request_events_immutable_delete BEFORE DELETE ON academy_request_events BEGIN SELECT RAISE(ABORT,'ACADEMY_IMMUTABLE'); END;
CREATE TRIGGER academy_subscription_activation_events_immutable_update BEFORE UPDATE ON academy_subscription_activation_events BEGIN SELECT RAISE(ABORT,'ACADEMY_IMMUTABLE'); END;
CREATE TRIGGER academy_subscription_activation_events_immutable_delete BEFORE DELETE ON academy_subscription_activation_events BEGIN SELECT RAISE(ABORT,'ACADEMY_IMMUTABLE'); END;
CREATE TRIGGER academy_request_rejections_immutable_update BEFORE UPDATE ON academy_request_rejections BEGIN SELECT RAISE(ABORT,'ACADEMY_IMMUTABLE'); END;
CREATE TRIGGER academy_request_rejections_immutable_delete BEFORE DELETE ON academy_request_rejections BEGIN SELECT RAISE(ABORT,'ACADEMY_IMMUTABLE'); END;
CREATE TRIGGER academy_contact_events_immutable_update BEFORE UPDATE ON academy_contact_events BEGIN SELECT RAISE(ABORT,'ACADEMY_IMMUTABLE'); END;
CREATE TRIGGER academy_contact_events_immutable_delete BEFORE DELETE ON academy_contact_events BEGIN SELECT RAISE(ABORT,'ACADEMY_IMMUTABLE'); END;
-- A staff-issued unguessable invitation is the Academy's explicit role
-- approval for the invited account; no CV or phone OTP is required to claim.
-- The invite creation + claim is the immutable provenance for this role.
-- It cannot create a staff grant or elevate the user beyond Sheikh.
CREATE TRIGGER academy_invite_auto_provision AFTER UPDATE OF claimed_subject
 ON academy_teacher_invites WHEN OLD.claimed_subject IS NULL AND NEW.claimed_subject IS NOT NULL
BEGIN
 SELECT RAISE(ABORT,'ACADEMY_INVITER_REVOKED') WHERE NOT EXISTS(
 SELECT 1 FROM staff_grants g JOIN auth_users actor ON actor.id=g.auth_subject
 JOIN accounts account ON account.auth_subject=actor.id
 WHERE g.auth_subject=NEW.actor_subject AND g.permission='roles.manage'
 AND g.revoked_at_ms IS NULL AND actor.phone_number_verified=1 AND account.status='active');
 SELECT RAISE(ABORT,'ACADEMY_TEACHER_ALREADY_REGISTERED') WHERE EXISTS(
  SELECT 1 FROM teachers t WHERE t.auth_subject=NEW.claimed_subject);
 INSERT INTO teachers(id,auth_subject,qualified,status)
 VALUES(lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-4'||
  substr(hex(randomblob(2)),2,3)||'-a'||substr(hex(randomblob(2)),2,3)||
  '-'||hex(randomblob(6))),NEW.claimed_subject,1,'active');
END;
INSERT INTO noor_schema_meta(component,version) VALUES('academy_admin_mvp',1);
