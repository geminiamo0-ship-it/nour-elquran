-- #247: committed in-app notices, no external delivery or private educational data.
-- Every item comes from an actual assignment or lesson mutation, never a
-- browser assertion. No WhatsApp, phone, recordings or grade fields exist here.
CREATE TABLE noor_inbox_items (
 id TEXT NOT NULL PRIMARY KEY CHECK(length(id)=32),
 learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE RESTRICT,
 recipient_subject TEXT NOT NULL CHECK(length(recipient_subject)>0),
 recipient_kind TEXT NOT NULL CHECK(recipient_kind IN ('owner','teacher')),
 kind TEXT NOT NULL CHECK(kind IN ('assignment_published','lesson_booked',
  'lesson_rescheduled','lesson_cancelled','lesson_completed')),
 source_id TEXT NOT NULL CHECK(length(source_id) BETWEEN 1 AND 128),
 title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 80),
 detail TEXT NOT NULL CHECK(length(trim(detail)) BETWEEN 1 AND 240),
 created_at_ms INTEGER NOT NULL CHECK(created_at_ms>=0),
 CHECK ((kind='assignment_published' AND recipient_kind='owner') OR
        (kind<>'assignment_published'))
) STRICT;
CREATE INDEX noor_inbox_recipient ON noor_inbox_items(
 recipient_subject,recipient_kind,created_at_ms DESC,id DESC);
CREATE INDEX noor_inbox_learner ON noor_inbox_items(
 learner_id,recipient_subject,created_at_ms DESC);
CREATE TRIGGER noor_inbox_item_no_update BEFORE UPDATE ON noor_inbox_items
BEGIN SELECT RAISE(ABORT,'INBOX_IMMUTABLE'); END;
CREATE TRIGGER noor_inbox_item_no_delete BEFORE DELETE ON noor_inbox_items
BEGIN SELECT RAISE(ABORT,'INBOX_IMMUTABLE'); END;

-- A trigger writing a notice observes its authoritative source record.
CREATE TRIGGER noor_inbox_assignment_insert AFTER INSERT ON assignment_publish_events
BEGIN
 INSERT INTO noor_inbox_items(id,learner_id,recipient_subject,recipient_kind,
   kind,source_id,title,detail,created_at_ms)
 SELECT lower(hex(randomblob(16))),NEW.learner_id,a.auth_subject,'owner',
  'assignment_published',NEW.assignment_id,'واجب جديد',
  printf('سورة %d · الآيات %d–%d',NEW.surah,NEW.from_ayah,NEW.to_ayah),
  NEW.published_at_ms
 FROM learners l JOIN accounts a ON a.id=l.account_id
 WHERE l.id=NEW.learner_id AND l.status='active' AND a.status='active';
END;
CREATE TRIGGER noor_inbox_lesson_booked AFTER INSERT ON lessons
WHEN NEW.status='scheduled'
BEGIN
 INSERT INTO noor_inbox_items(id,learner_id,recipient_subject,recipient_kind,
   kind,source_id,title,detail,created_at_ms)
 SELECT lower(hex(randomblob(16))),NEW.learner_id,a.auth_subject,'owner',
  'lesson_booked',NEW.id,'حصة مؤكدة','أُضيفت حصة جديدة إلى جدولك',
  CAST(strftime('%s','now') AS INTEGER)*1000
 FROM learners l JOIN accounts a ON a.id=l.account_id
 WHERE l.id=NEW.learner_id AND l.status='active' AND a.status='active';
 INSERT INTO noor_inbox_items(id,learner_id,recipient_subject,recipient_kind,
   kind,source_id,title,detail,created_at_ms)
 SELECT lower(hex(randomblob(16))),NEW.learner_id,t.auth_subject,'teacher',
  'lesson_booked',NEW.id,'حصة جديدة','أُضيفت حصة إلى جدول الشيخ',
  CAST(strftime('%s','now') AS INTEGER)*1000
 FROM teachers t WHERE t.id=NEW.actual_teacher_id
  AND t.status='active' AND t.qualified=1;
END;
CREATE TRIGGER noor_inbox_lesson_changes AFTER UPDATE OF status,starts_at_ms ON lessons
WHEN (NEW.status='cancelled' AND OLD.status<>'cancelled')
 OR (NEW.status='completed' AND OLD.status<>'completed')
 OR (NEW.starts_at_ms<>OLD.starts_at_ms AND NEW.status='scheduled')
BEGIN
 INSERT INTO noor_inbox_items(id,learner_id,recipient_subject,recipient_kind,
   kind,source_id,title,detail,created_at_ms)
 SELECT lower(hex(randomblob(16))),NEW.learner_id,a.auth_subject,'owner',
  CASE WHEN NEW.status='cancelled' THEN 'lesson_cancelled'
   WHEN NEW.status='completed' THEN 'lesson_completed'
   ELSE 'lesson_rescheduled' END,NEW.id,
  CASE WHEN NEW.status='cancelled' THEN 'إلغاء حصة'
   WHEN NEW.status='completed' THEN 'انتهت الحصة'
   ELSE 'تغيير موعد الحصة' END,
  'تم تحديث حالة الحصة داخل جدولك',
  CAST(strftime('%s','now') AS INTEGER)*1000
 FROM learners l JOIN accounts a ON a.id=l.account_id
 WHERE l.id=NEW.learner_id AND l.status='active' AND a.status='active';
 INSERT INTO noor_inbox_items(id,learner_id,recipient_subject,recipient_kind,
   kind,source_id,title,detail,created_at_ms)
 SELECT lower(hex(randomblob(16))),NEW.learner_id,t.auth_subject,'teacher',
  CASE WHEN NEW.status='cancelled' THEN 'lesson_cancelled'
   WHEN NEW.status='completed' THEN 'lesson_completed'
   ELSE 'lesson_rescheduled' END,NEW.id,
  CASE WHEN NEW.status='cancelled' THEN 'إلغاء حصة'
   WHEN NEW.status='completed' THEN 'انتهت الحصة'
   ELSE 'تغيير موعد الحصة' END,
  'تم تحديث الحصة في جدول الشيخ',
  CAST(strftime('%s','now') AS INTEGER)*1000
 FROM teachers t WHERE t.id=NEW.actual_teacher_id
  AND t.status='active' AND t.qualified=1;
END;

CREATE TABLE noor_inbox_read_events (
 id TEXT NOT NULL PRIMARY KEY CHECK(length(id)=36),
 notification_id TEXT NOT NULL REFERENCES noor_inbox_items(id) ON DELETE RESTRICT,
 operation_id TEXT NOT NULL CHECK(length(operation_id)=36),
 actor_subject TEXT NOT NULL,
 action TEXT NOT NULL CHECK(action IN ('read','unread')),
 expected_revision INTEGER NOT NULL CHECK(expected_revision>=0),
 revision INTEGER NOT NULL CHECK(revision=expected_revision+1),
 at_ms INTEGER NOT NULL CHECK(at_ms>=0),
 UNIQUE(notification_id,operation_id),
 UNIQUE(notification_id,revision)
) STRICT;
CREATE INDEX noor_inbox_reads_actor ON noor_inbox_read_events(actor_subject,at_ms DESC);
CREATE TRIGGER noor_inbox_read_guard BEFORE INSERT ON noor_inbox_read_events
BEGIN
 SELECT RAISE(ABORT,'INBOX_ACCESS_DENIED') WHERE NOT EXISTS(
  SELECT 1 FROM noor_inbox_items n
  WHERE n.id=NEW.notification_id AND n.recipient_subject=NEW.actor_subject
    AND ((n.recipient_kind='teacher' AND EXISTS(
     SELECT 1 FROM teachers t WHERE t.auth_subject=NEW.actor_subject
      AND t.status='active' AND t.qualified=1))
     OR (n.recipient_kind='owner' AND EXISTS(
      SELECT 1 FROM learners l JOIN accounts a ON a.id=l.account_id
      WHERE l.id=n.learner_id AND a.auth_subject=NEW.actor_subject
        AND l.status='active' AND a.status='active')));
 SELECT RAISE(ABORT,'INBOX_REVISION_CONFLICT') WHERE NEW.expected_revision<>
  COALESCE((SELECT MAX(e.revision) FROM noor_inbox_read_events e
    WHERE e.notification_id=NEW.notification_id),0);
END;
CREATE TRIGGER noor_inbox_read_no_update BEFORE UPDATE ON noor_inbox_read_events
BEGIN SELECT RAISE(ABORT,'INBOX_READ_IMMUTABLE'); END;
CREATE TRIGGER noor_inbox_read_no_delete BEFORE DELETE ON noor_inbox_read_events
BEGIN SELECT RAISE(ABORT,'INBOX_READ_IMMUTABLE'); END;
INSERT INTO noor_schema_meta(component,version) VALUES('inbox',1);
