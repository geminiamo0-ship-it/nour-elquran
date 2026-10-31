import type {CoreDatabase} from './bindings.ts';
import {PRIVATE_EDITION} from './private-mushaf.ts';

/** #253: signed owner-only view of immutable shared Quran marks as they stood
 * at a verified lesson End. Never query today's mutable projection, and never
 * include the learner's private/self-study or legacy personal Mushaf data.
 * This is NOT a sealed/exportable archive or a published teacher report.
 */
type LessonEnd={ended_at_ms:number};
type Page={page:number};
type EventMark={
 item_id:string;page:number;kind:'pen'|'marker'|'highlight'|'note';
 surah:number|null;ayah:number|null;word_index:number|null;
 actor_role:'teacher'|'learner';origin_type:'lesson'|'assignment';
 origin_id:string;payload_json:string;
};

const scope=[
 'SELECT l.ended_at_ms FROM lessons l',
 'JOIN learners learner ON learner.id=l.learner_id',
 'JOIN accounts owner ON owner.id=learner.account_id',
 "WHERE l.id=? AND l.learner_id=? AND l.status='completed'",
 "AND l.ended_at_ms IS NOT NULL AND learner.status='active'",
 "AND owner.status='active' AND owner.auth_subject=?",
 'AND EXISTS (SELECT 1 FROM lesson_lifecycle_events audit',
 "WHERE audit.lesson_id=l.id AND audit.action='end'",
 'AND audit.teacher_id=l.actual_teacher_id AND audit.at_ms=l.ended_at_ms)',
 'LIMIT 1'
].join(' ');

const pagesSql=[
 'SELECT DISTINCT page FROM learner_quran_events',
 "WHERE learner_id=? AND edition_id=? AND audience='shared'",
 "AND origin_type='lesson' AND origin_id=? AND at_ms<=?",
 'ORDER BY page ASC LIMIT 605'
].join(' ');

const historicalSql=[
 'SELECT item_id,page,kind,surah,ayah,word_index,actor_role,origin_type,origin_id,payload_json',
 'FROM (SELECT e.*,ROW_NUMBER() OVER (PARTITION BY e.item_id',
 'ORDER BY e.at_ms DESC,e.rowid DESC) AS event_rank',
 'FROM learner_quran_events e',
 "WHERE e.learner_id=? AND e.edition_id=? AND e.page=? AND e.audience='shared'",
 'AND e.at_ms<=?)',
 "WHERE event_rank=1 AND action='put'",
 'ORDER BY at_ms ASC,item_id ASC LIMIT 301'
].join(' ');

export async function readOwnerLessonQuranHistory(db:CoreDatabase,ownerSubject:string,
 learnerId:string,lessonId:string,page:number|null){
 const lesson=await db.prepare(scope).bind(lessonId,learnerId,ownerSubject)
  .first<LessonEnd>();
 if(!lesson||!Number.isSafeInteger(lesson.ended_at_ms)||lesson.ended_at_ms<0)
  return {status:404,code:'NOT_FOUND'} as const;
 const asOfMs=lesson.ended_at_ms;
 const pageRows=await db.prepare(pagesSql).bind(learnerId,PRIVATE_EDITION,lessonId,asOfMs)
  .all<Page>();
 const pages=pageRows.results.map(row=>row.page);
 if(pages.some(p=>!Number.isSafeInteger(p)||p<1||p>604))
  return {status:409,code:'QURAN_HISTORY_INVALID_PAGES'} as const;
 if(page!==null&&(!Number.isSafeInteger(page)||!pages.includes(page)))
  return {status:400,code:'INVALID_HISTORY_PAGE'} as const;
 if(page===null)return {status:200,code:'QURAN_LESSON_HISTORY',learnerId,
  lessonId,asOfMs,pages,marks:[]} as const;
 const rows=(await db.prepare(historicalSql).bind(learnerId,PRIVATE_EDITION,page,asOfMs)
  .all<EventMark>()).results;
 if(rows.length>300)return {status:409,code:'QURAN_HISTORY_PAGE_CAPACITY'} as const;
 // Author subject is deliberately absent from the read model.
 return {status:200,code:'QURAN_LESSON_HISTORY',learnerId,lessonId,asOfMs,pages,
  marks:rows.map(row=>({
   itemId:row.item_id,page:row.page,kind:row.kind,surah:row.surah,ayah:row.ayah,
   wordIndex:row.word_index,authorRole:row.actor_role,
   audience:'shared' as const,visible:true,
   originType:row.origin_type,originId:row.origin_id,
   payload:JSON.parse(row.payload_json) as Record<string,unknown>
  }))} as const;
}
