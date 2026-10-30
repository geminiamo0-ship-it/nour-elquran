-- #182 Phase 06A1: additive, FAIL-CLOSED private audio preparation.
-- No route may issue audio upload/playback or record consent based on this migration.
-- Future guardian-verification and retention approval must explicitly replace the locks.
CREATE TABLE recitation_consent_events (
  operation_id TEXT NOT NULL PRIMARY KEY CHECK(length(operation_id)=36),
  id TEXT NOT NULL UNIQUE CHECK(length(id)=36),
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE RESTRICT,
  actor_auth_subject TEXT NOT NULL,
  policy_version TEXT NOT NULL CHECK(length(trim(policy_version)) BETWEEN 1 AND 80),
  decision TEXT NOT NULL CHECK(decision IN ('grant','withdraw')),
  recorded_at_ms INTEGER NOT NULL CHECK(recorded_at_ms>=0)
) STRICT;
CREATE INDEX recitation_consent_learner ON recitation_consent_events(learner_id,recorded_at_ms DESC);

CREATE TRIGGER recitation_consent_owner_guard BEFORE INSERT ON recitation_consent_events BEGIN
  SELECT RAISE(ABORT,'AUDIO_CONSENT_OWNER_DENIED') WHERE NOT EXISTS (
    SELECT 1 FROM learners learner JOIN accounts owner ON owner.id=learner.account_id
    WHERE learner.id=NEW.learner_id AND learner.status='active'
      AND owner.status='active' AND owner.auth_subject=NEW.actor_auth_subject
  );
END;
-- Do not mistake a verified phone number for verified adult/guardian authority.
-- A separately reviewed migration must replace this trigger after verified-guardian proof,
-- published policy version, revocation mechanics, retention and deletion are implemented.
CREATE TRIGGER recitation_consent_grant_locked BEFORE INSERT ON recitation_consent_events
WHEN NEW.decision='grant'
BEGIN SELECT RAISE(ABORT,'AUDIO_GUARDIAN_POLICY_NOT_APPROVED'); END;
CREATE TRIGGER recitation_consent_immutable_update BEFORE UPDATE ON recitation_consent_events
BEGIN SELECT RAISE(ABORT,'AUDIO_CONSENT_IMMUTABLE'); END;
CREATE TRIGGER recitation_consent_immutable_delete BEFORE DELETE ON recitation_consent_events
BEGIN SELECT RAISE(ABORT,'AUDIO_CONSENT_IMMUTABLE'); END;

-- This inventory contains metadata only, not sound, media URLs or signed R2 credentials.
-- No inserts allowed until the explicit policy gate and a private R2 bucket are verified.
CREATE TABLE recitation_audio_assets (
  id TEXT NOT NULL PRIMARY KEY CHECK(length(id)=36),
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE RESTRICT,
  assignment_id TEXT NOT NULL REFERENCES learner_assignments(id) ON DELETE RESTRICT,
  submission_id TEXT NOT NULL UNIQUE REFERENCES assignment_submission_events(id) ON DELETE RESTRICT,
  created_by_auth_subject TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  media_type TEXT NOT NULL CHECK(media_type IN ('audio/webm','audio/ogg','audio/mp4')),
  byte_size INTEGER NOT NULL CHECK(byte_size BETWEEN 1 AND 8388608),
  duration_ms INTEGER NOT NULL CHECK(duration_ms BETWEEN 1 AND 240000),
  sha256 TEXT NOT NULL CHECK(length(sha256)=64 AND sha256 NOT GLOB '*[^0-9a-f]*'),
  created_at_ms INTEGER NOT NULL CHECK(created_at_ms>=0),
  CHECK(object_key='assignment-audio/' || learner_id || '/' || id ||
    CASE media_type WHEN 'audio/webm' THEN '.webm'
      WHEN 'audio/ogg' THEN '.ogg' ELSE '.m4a' END)
) STRICT;
CREATE INDEX recitation_audio_by_learner ON recitation_audio_assets(learner_id,created_at_ms DESC);

CREATE TRIGGER recitation_audio_scope_guard BEFORE INSERT ON recitation_audio_assets BEGIN
  SELECT RAISE(ABORT,'AUDIO_SUBMISSION_SCOPE_DENIED') WHERE NOT EXISTS (
    SELECT 1 FROM assignment_submission_events submission
    JOIN learner_assignments task ON task.id=submission.assignment_id
    JOIN learners learner ON learner.id=submission.learner_id
    JOIN accounts owner ON owner.id=learner.account_id
    WHERE submission.id=NEW.submission_id
      AND submission.assignment_id=NEW.assignment_id AND submission.learner_id=NEW.learner_id
      AND task.learner_id=NEW.learner_id AND learner.status='active'
      AND owner.status='active' AND owner.auth_subject=NEW.created_by_auth_subject
  );
END;
CREATE TRIGGER recitation_audio_upload_locked BEFORE INSERT ON recitation_audio_assets
BEGIN SELECT RAISE(ABORT,'AUDIO_STORAGE_NOT_APPROVED'); END;
CREATE TRIGGER recitation_audio_immutable_update BEFORE UPDATE ON recitation_audio_assets
BEGIN SELECT RAISE(ABORT,'AUDIO_ASSET_IMMUTABLE'); END;
CREATE TRIGGER recitation_audio_immutable_delete BEFORE DELETE ON recitation_audio_assets
BEGIN SELECT RAISE(ABORT,'AUDIO_ASSET_IMMUTABLE'); END;

INSERT INTO noor_schema_meta(component,version) VALUES('recitation_audio_privacy',1);
