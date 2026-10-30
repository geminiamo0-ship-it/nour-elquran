import type {CoreDatabase} from './bindings.ts';

// Read-only until a trusted Classroom DO producer implements authenticated
// snapshot export + source-digest verification. The web app cannot seal an archive.
type ArchiveRow={
 lesson_id:string;learner_id:string;report_revision:number;edition_id:string;
 source_sha256:string;sealed_at_ms:number;
};
type PageRow={page:number};
type MarkRow={mark_id:string;page:number;surah:number|null;ayah:number|null;
 kind:'note'|'highlight'|'pen'|'marker';payload_json:string};
export type ArchiveMark=Readonly<{
 id:string;page:number;surah:number|null;ayah:number|null;
 kind:MarkRow['kind'];payload:unknown;
}>;
const scopeSQL=[
 'SELECT 1 AS allowed FROM lessons l',
 'JOIN learners s ON s.id=l.learner_id JOIN accounts a ON a.id=s.account_id',
 "WHERE l.id=? AND l.learner_id=? AND s.status='active' AND a.status='active'",
 "AND a.auth_subject=? AND l.status='completed' AND l.ended_at_ms IS NOT NULL",
 'AND EXISTS (SELECT 1 FROM lesson_lifecycle_events e WHERE e.lesson_id=l.id',
 "AND e.action='end' AND e.teacher_id=l.actual_teacher_id AND e.at_ms=l.ended_at_ms)",
 'LIMIT 1'
].join(' ');
export async function readLessonQuranArchive(db:CoreDatabase,subject:string,
 learnerId:string,lessonId:string){
 const owned=await db.prepare(scopeSQL).bind(lessonId,learnerId,subject)
  .first<{allowed:number}>();
 if(owned?.allowed!==1)return {status:404,code:'NOT_FOUND'} as const;
 // Never serve an older layer while the report's latest published revision
 // has changed, or any draft, even if an earlier archive was sealed.
 const manifest=await db.prepare([
  'SELECT a.* FROM lesson_quran_archives a',
  'JOIN lesson_report_state state ON state.lesson_id=a.lesson_id',
  'AND state.latest_published_revision=a.report_revision',
  'JOIN quran_editions edition ON edition.id=a.edition_id',
  "WHERE a.lesson_id=? AND a.learner_id=? AND a.sealed_at_ms IS NOT NULL",
  "AND a.source='classroom-do:v1' AND edition.riwayah='hafs' AND edition.page_count=604",
  'LIMIT 1'
 ].join(' ')).bind(lessonId,learnerId).first<ArchiveRow>();
 if(!manifest)return {status:200,archive:null,code:'ARCHIVE_NOT_SEALED'} as const;
 const pages=await db.prepare([
  'SELECT page FROM lesson_quran_archive_pages',
  'WHERE lesson_id=? AND report_revision=? ORDER BY page ASC LIMIT 20'
 ].join(' ')).bind(lessonId,manifest.report_revision).all<PageRow>();
 const marks=await db.prepare([
  'SELECT mark_id,page,surah,ayah,kind,payload_json FROM lesson_quran_archive_marks',
  'WHERE lesson_id=? AND report_revision=? ORDER BY page,mark_id LIMIT 100'
 ].join(' ')).bind(lessonId,manifest.report_revision).all<MarkRow>();
 // SQL manifest publication, canonical page and annotation foreign keys are
 // trusted; renderers revalidate every item to fail closed on corrupt payloads.
 return {status:200,archive:{
  lessonId,learnerId,reportRevision:manifest.report_revision,editionId:manifest.edition_id,
  source:'classroom-do:v1',sourceSha256:manifest.source_sha256,
  sealedAtMs:manifest.sealed_at_ms,pages:pages.results.map(p=>p.page),
  marks:marks.results.map(m=>({
    id:m.mark_id,page:m.page,surah:m.surah,ayah:m.ayah,kind:m.kind,
    payload:JSON.parse(m.payload_json) as unknown
  }))
 }} as const;
}
