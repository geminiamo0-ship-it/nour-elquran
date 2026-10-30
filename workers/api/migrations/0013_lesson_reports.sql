-- Phase 07A #186: immutable draft changes and published snapshots from REAL completed lessons.
CREATE TABLE lesson_report_state (
 lesson_id TEXT PRIMARY KEY NOT NULL, learner_id TEXT NOT NULL,
 revision INTEGER NOT NULL CHECK(revision>=1),
 status TEXT NOT NULL CHECK(status IN ('draft','published')),
 latest_published_revision INTEGER CHECK(latest_published_revision BETWEEN 1 AND revision),
 scope TEXT NOT NULL CHECK(length(scope)<=700),
 strengths TEXT NOT NULL CHECK(length(strengths)<=1000),
 corrections TEXT NOT NULL CHECK(length(corrections)<=1000),
 next_plan TEXT NOT NULL CHECK(length(next_plan)<=1000),
 memorization INTEGER CHECK(memorization BETWEEN 0 AND 10),
 recitation INTEGER CHECK(recitation BETWEEN 0 AND 10),
 tajweed INTEGER CHECK(tajweed BETWEEN 0 AND 10),
 updated_at_ms INTEGER NOT NULL CHECK(updated_at_ms>=0),
 FOREIGN KEY(lesson_id,learner_id) REFERENCES lessons(id,learner_id) ON DELETE RESTRICT
) STRICT;
CREATE TABLE lesson_report_events (
 operation_id TEXT PRIMARY KEY NOT NULL CHECK(length(operation_id)=36),
 lesson_id TEXT NOT NULL, learner_id TEXT NOT NULL,
 actor_auth_subject TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('save','publish')),
 expected_revision INTEGER NOT NULL CHECK(expected_revision>=0),
 scope TEXT NOT NULL CHECK(length(scope)<=700),
 strengths TEXT NOT NULL CHECK(length(strengths)<=1000),
 corrections TEXT NOT NULL CHECK(length(corrections)<=1000),
 next_plan TEXT NOT NULL CHECK(length(next_plan)<=1000),
 memorization INTEGER CHECK(memorization BETWEEN 0 AND 10),
 recitation INTEGER CHECK(recitation BETWEEN 0 AND 10),
 tajweed INTEGER CHECK(tajweed BETWEEN 0 AND 10),
 at_ms INTEGER NOT NULL CHECK(at_ms>=0),
 FOREIGN KEY(lesson_id,learner_id) REFERENCES lessons(id,learner_id) ON DELETE RESTRICT
) STRICT;
CREATE INDEX lesson_report_events_by_lesson ON lesson_report_events(lesson_id,at_ms);
CREATE TABLE lesson_report_publications (
 lesson_id TEXT NOT NULL,learner_id TEXT NOT NULL,
 revision INTEGER NOT NULL CHECK(revision>=1),
 operation_id TEXT NOT NULL UNIQUE REFERENCES lesson_report_events(operation_id) ON DELETE RESTRICT,
 author_auth_subject TEXT NOT NULL,
 scope TEXT NOT NULL CHECK(length(trim(scope)) BETWEEN 1 AND 700),
 strengths TEXT NOT NULL,corrections TEXT NOT NULL,next_plan TEXT NOT NULL,
 memorization INTEGER CHECK(memorization BETWEEN 0 AND 10),
 recitation INTEGER CHECK(recitation BETWEEN 0 AND 10),
 tajweed INTEGER CHECK(tajweed BETWEEN 0 AND 10),
 published_at_ms INTEGER NOT NULL CHECK(published_at_ms>=0),
 PRIMARY KEY(lesson_id,revision),
 FOREIGN KEY(lesson_id,learner_id) REFERENCES lessons(id,learner_id) ON DELETE RESTRICT
) STRICT;
CREATE INDEX lesson_report_publications_by_learner ON lesson_report_publications(learner_id,published_at_ms DESC);
CREATE TRIGGER report_event_guard BEFORE INSERT ON lesson_report_events
BEGIN
 SELECT RAISE(ABORT,'REPORT_ACCESS_DENIED') WHERE NOT EXISTS (
  SELECT 1 FROM lessons l JOIN learners s ON s.id=l.learner_id
   JOIN accounts owner ON owner.id=s.account_id
   JOIN teachers t ON t.id=l.actual_teacher_id
  WHERE l.id=NEW.lesson_id AND l.learner_id=NEW.learner_id
   AND s.status='active' AND owner.status='active'
   AND t.auth_subject=NEW.actor_auth_subject AND t.status='active' AND t.qualified=1
   AND l.status='completed' AND l.ended_at_ms IS NOT NULL AND l.ended_at_ms<=NEW.at_ms
   AND EXISTS (SELECT 1 FROM lesson_lifecycle_events e
     WHERE e.lesson_id=l.id AND e.teacher_id=t.id AND e.action='end'
      AND e.at_ms=l.ended_at_ms)
   AND (EXISTS (SELECT 1 FROM teacher_assignments a
    WHERE a.learner_id=l.learner_id AND a.teacher_id=t.id
     AND a.starts_at_ms<=l.starts_at_ms AND a.ends_at_ms>l.starts_at_ms
     AND (a.revoked_at_ms IS NULL OR a.revoked_at_ms>l.starts_at_ms))
    OR EXISTS (SELECT 1 FROM lesson_access_grants g
      WHERE g.lesson_id=l.id AND g.teacher_id=t.id AND g.kind='substitute'
       AND g.accepted_at_ms IS NOT NULL AND g.revoked_at_ms IS NULL))
 );
 -- Approved substitute: only the taught lesson, no unrelated student history.
 -- Initial report requires timely action after END; corrections expire 24h after
 -- the FIRST publication, not a later version (which would extend the grant).
 SELECT RAISE(ABORT,'REPORT_SUBSTITUTE_DENIED') WHERE EXISTS (
   SELECT 1 FROM lessons l JOIN lesson_access_grants g
   ON g.lesson_id=l.id AND g.teacher_id=l.actual_teacher_id AND g.kind='substitute'
   WHERE l.id=NEW.lesson_id AND (g.accepted_at_ms IS NULL OR g.revoked_at_ms IS NOT NULL
    OR NEW.at_ms>COALESCE(
      (SELECT MIN(published_at_ms) FROM lesson_report_publications WHERE lesson_id=l.id),
      l.ended_at_ms)+86400000)
 );
 SELECT RAISE(ABORT,'REPORT_REVISION_CONFLICT') WHERE NEW.expected_revision !=
  COALESCE((SELECT revision FROM lesson_report_state WHERE lesson_id=NEW.lesson_id),0);
 SELECT RAISE(ABORT,'REPORT_NOT_READY_TO_PUBLISH') WHERE NEW.kind='publish' AND NOT EXISTS (
  SELECT 1 FROM lesson_report_state s WHERE s.lesson_id=NEW.lesson_id
   AND s.status='draft' AND s.revision=NEW.expected_revision
   AND length(trim(s.scope))>0 AND s.scope=NEW.scope AND s.strengths=NEW.strengths
   AND s.corrections=NEW.corrections AND s.next_plan=NEW.next_plan
   AND s.memorization IS NEW.memorization AND s.recitation IS NEW.recitation
   AND s.tajweed IS NEW.tajweed
 );
END;
CREATE TRIGGER report_event_apply AFTER INSERT ON lesson_report_events
BEGIN
 INSERT INTO lesson_report_state(lesson_id,learner_id,revision,status,latest_published_revision,
  scope,strengths,corrections,next_plan,memorization,recitation,tajweed,updated_at_ms)
 SELECT NEW.lesson_id,NEW.learner_id,NEW.expected_revision+1,'draft',NULL,
  NEW.scope,NEW.strengths,NEW.corrections,NEW.next_plan,
  NEW.memorization,NEW.recitation,NEW.tajweed,NEW.at_ms WHERE NEW.kind='save'
 ON CONFLICT(lesson_id) DO UPDATE SET
  revision=excluded.revision,status='draft',scope=excluded.scope,
  strengths=excluded.strengths,corrections=excluded.corrections,
  next_plan=excluded.next_plan,memorization=excluded.memorization,
  recitation=excluded.recitation,tajweed=excluded.tajweed,updated_at_ms=excluded.updated_at_ms;
 INSERT INTO lesson_report_publications(lesson_id,learner_id,revision,operation_id,
  author_auth_subject,scope,strengths,corrections,next_plan,
  memorization,recitation,tajweed,published_at_ms)
 SELECT NEW.lesson_id,NEW.learner_id,NEW.expected_revision,NEW.operation_id,
  NEW.actor_auth_subject,NEW.scope,NEW.strengths,NEW.corrections,NEW.next_plan,
  NEW.memorization,NEW.recitation,NEW.tajweed,NEW.at_ms WHERE NEW.kind='publish';
 UPDATE lesson_report_state SET status='published',
  latest_published_revision=NEW.expected_revision,updated_at_ms=NEW.at_ms
 WHERE lesson_id=NEW.lesson_id AND NEW.kind='publish';
END;
CREATE TRIGGER report_event_no_update BEFORE UPDATE ON lesson_report_events
BEGIN SELECT RAISE(ABORT,'REPORT_AUDIT_IMMUTABLE'); END;
CREATE TRIGGER report_event_no_delete BEFORE DELETE ON lesson_report_events
BEGIN SELECT RAISE(ABORT,'REPORT_AUDIT_IMMUTABLE'); END;
CREATE TRIGGER report_published_no_update BEFORE UPDATE ON lesson_report_publications
BEGIN SELECT RAISE(ABORT,'REPORT_PUBLICATION_IMMUTABLE'); END;
CREATE TRIGGER report_published_no_delete BEFORE DELETE ON lesson_report_publications
BEGIN SELECT RAISE(ABORT,'REPORT_PUBLICATION_IMMUTABLE'); END;
INSERT INTO noor_schema_meta(component,version) VALUES('lesson_reports',1);
