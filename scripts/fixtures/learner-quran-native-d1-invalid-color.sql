-- #286: native Wrangler D1 canonical-ink guard negative regression.
-- Run only in the disposable local database after teacher-draft-native-d1.sql.
-- No credentials, actual learner identities, real media, or remote D1.
-- The learner-owned self-study event must fail before any ledger projection.
INSERT INTO learner_quran_events(
 id,learner_id,operation_id,item_id,actor_subject,actor_role,
 origin_type,origin_id,audience,action,edition_id,page,surah,ayah,word_index,
 kind,expected_revision,payload_json,at_ms)
 VALUES(
 'native-invalid-canonical-event','draft-test-learner',
 'native-invalid-canonical-op','native-invalid-canonical-item',
 'draft-test-owner','learner','self_study',NULL,'private','put',
 'hafs-kfqc:v1.1.1',1,NULL,NULL,NULL,
 'pen',0,
 '{"color":"#gg0000","width":3,"points":[{"x":120,"y":220},{"x":140,"y":235}]}',
 3100);
