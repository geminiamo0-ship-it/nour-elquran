-- Additional fail-closed D1 verification of required structured archive
-- payload keys. SQLite three-valued NULL comparisons must NOT bypass guards.
CREATE TRIGGER lesson_archive_mark_required_fields
BEFORE INSERT ON lesson_quran_archive_marks
BEGIN
 SELECT RAISE(ABORT,'ARCHIVE_MARK_REQUIRED_FIELD_MISSING') WHERE
  ifnull(json_type(NEW.payload_json,'$.color'),'missing') != 'text' OR
  ifnull(length(json_extract(NEW.payload_json,'$.color')),0) != 7 OR
  ifnull(json_extract(NEW.payload_json,'$.color'),'') NOT GLOB
   '#[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]' OR
  (NEW.kind='note' AND (
    ifnull(json_type(NEW.payload_json,'$.text'),'missing') != 'text' OR
    length(trim(ifnull(json_extract(NEW.payload_json,'$.text'),''))) NOT BETWEEN 1 AND 500
  )) OR
  (NEW.kind IN ('pen','marker') AND (
    ifnull(json_type(NEW.payload_json,'$.width'),'missing') NOT IN ('integer','real') OR
    ifnull(json_extract(NEW.payload_json,'$.width'),-1) NOT BETWEEN 1 AND 60 OR
    ifnull(json_type(NEW.payload_json,'$.points'),'missing') != 'array' OR
    ifnull(json_array_length(NEW.payload_json,'$.points'),0) NOT BETWEEN 2 AND 2500
  ));
END;
