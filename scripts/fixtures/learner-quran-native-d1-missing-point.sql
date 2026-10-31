-- #286: a missing point coordinate is SQL NULL and must fail closed.
-- Disposable native local D1 after teacher-draft-native-d1.sql; no real data.
INSERT INTO learner_quran_events(
 id,learner_id,operation_id,item_id,actor_subject,actor_role,
 origin_type,origin_id,audience,action,edition_id,page,surah,ayah,word_index,
 kind,expected_revision,payload_json,at_ms)
 VALUES(
 'native-missing-point-event','draft-test-learner',
 'native-missing-point-op','native-missing-point-item',
 'draft-test-owner','learner','self_study',NULL,'private','put',
 'hafs-kfqc:v1.1.1',1,NULL,NULL,NULL,
 'pen',0,
 '{"color":"#d0a94c","width":3,"points":[{"y":220},{"x":140,"y":235}]}',
 3300);
