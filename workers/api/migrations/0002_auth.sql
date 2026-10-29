-- Better Auth 1.7.14 + phone-number plugin, mapped through first-party Drizzle adapter.
-- Hand-maintained schema validated by native registration/login/session tests.
CREATE TABLE auth_users (
 id TEXT NOT NULL PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
 email_verified INTEGER NOT NULL DEFAULT 0 CHECK(email_verified IN (0,1)), image TEXT,
 created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
 phone_number TEXT UNIQUE, phone_number_verified INTEGER DEFAULT 0 CHECK(phone_number_verified IN (0,1))
) STRICT;
CREATE TABLE auth_sessions (
 id TEXT NOT NULL PRIMARY KEY, token TEXT NOT NULL UNIQUE,
 user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
 expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
 ip_address TEXT, user_agent TEXT
) STRICT;
CREATE INDEX auth_session_user ON auth_sessions(user_id);
CREATE TABLE auth_credentials (
 id TEXT NOT NULL PRIMARY KEY, account_id TEXT NOT NULL, provider_id TEXT NOT NULL,
 user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
 password TEXT, access_token TEXT, refresh_token TEXT, id_token TEXT,
 access_token_expires_at INTEGER, refresh_token_expires_at INTEGER, scope TEXT,
 created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
) STRICT;
CREATE INDEX auth_credential_user ON auth_credentials(user_id);
CREATE UNIQUE INDEX auth_credential_provider ON auth_credentials(provider_id,account_id);
CREATE TABLE auth_verifications (
 id TEXT NOT NULL PRIMARY KEY, identifier TEXT NOT NULL, value TEXT NOT NULL,
 expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
) STRICT;
CREATE INDEX auth_verification_identifier ON auth_verifications(identifier);
CREATE TABLE auth_rate_limits (
 id TEXT NOT NULL PRIMARY KEY, key TEXT NOT NULL UNIQUE,
 count INTEGER NOT NULL CHECK(count>=0), last_request INTEGER NOT NULL
) STRICT;
CREATE TRIGGER learner_count_limit BEFORE INSERT ON learners WHEN NEW.status='active'
BEGIN
 SELECT RAISE(ABORT,'learner profile limit') WHERE (
  SELECT count(*) FROM learners WHERE account_id=NEW.account_id AND status='active'
 ) >= 8;
END;
INSERT INTO noor_schema_meta(component,version) VALUES('auth',1);

