import type { CoreDatabase, Env } from '../bindings.ts';
import { reply } from '../responses.ts';
import { createAuth } from './config.ts';
import { authSettings } from './settings.ts';
import { ownerAccount } from './accounts.ts';
import { getOwnedLearner, listOwnedLearners } from '../owner-learners.ts';
import { applyLearnerProfileAction, parseLearnerProfileAction } from '../learner-profile-actions.ts';
import {applyPrivateMushaf,parsePrivateMushafOp,readPrivateMushaf} from '../private-mushaf.ts';
import {readOwnerCumulativePage,readTeacherSharedPage} from '../learner-quran-ledger.ts';
import { listOwnedLearnerLessons, listVerifiedTeacherLessons } from '../lesson-calendar.ts';
import { listVerifiedTeacherLearners } from '../teacher-roster.ts';
import {readOwnerPlan,readTeacherPlan,writeTeacherPlan,parsePlanAction} from '../academic-plans.ts';
import {readOwnerAssignments,readTeacherAssignments,getAssignmentCatalog,publishAssignment,parsePublishAssignment} from '../published-assignments.ts';
import {listInbox,changeInboxRead} from '../in-app-inbox.ts';
import {reportAttendanceIncident,submitAttendanceAppeal,listOwnerAttendance,listTeacherAttendance,listStaffAttendanceAppeals,reviewAttendanceAppeal} from '../attendance-cases.ts';
import {publishTrialSlot,listOwnerTrialSlots,bookOwnerTrial,closeTrialSlot,cancelOwnerTrial} from '../free-trial-booking.ts';
import {readTeacherInkDrafts,saveTeacherInkDraft,teacherAssignmentPageRange} from '../teacher-assignment-ink-drafts.ts';
import {getStudentAttempts,getTeacherAttempts,submitStudentAttempt,reviewStudentAttempt,parseSubmission,parseReview} from '../assignment-submissions.ts';
import {PRIVATE_RECITATION_UPLOADS_ENABLED} from '../private-recitation-audio.ts';
import {getTeacherReport,getStudentReports,applyTeacherReport,parseReportAction} from '../lesson-reports.ts';
import {parseNotebookAction,readNotebookNotes,writeNotebookNote} from '../notebook-notes.ts';
import {readLessonQuranArchive} from '../lesson-quran-archive.ts';
import {readOwnerLessonQuranHistory} from '../lesson-quran-history.ts';
import {verifiedOwner} from '../published-assignments.ts';
import { canManageTeachers, issueTeacherRoleAction, parseTeacherAction } from '../staff-teachers.ts';
import {executeStaffSchedule,parseScheduleCommand} from '../staff-scheduling.ts';
import { checkTeacherClassroomAccess, checkOwnedLearnerClassroomAccess } from '../classroom-access.ts';
import {forwardVerifiedPresence,parseClientPresenceAction} from '../classroom/presence.ts';
import {forwardVerifiedPage,parsePageAction} from '../classroom/quran-sync.ts';
import {forwardVerifiedInk,parseClientInk} from '../classroom/ink-sync.ts';
import {openVerifiedRealtime} from '../classroom/realtime.ts';
import {createMediaToken,mediaLessonWindow} from '../classroom/livekit-token.ts';
import {checkLiveKitProvider} from '../classroom/livekit-provider-check.ts';
import {wakeActingTeacherMedia,wakeLessonMediaReconciliation} from '../classroom/media-enforcement.ts';
import {muteSignedLearnerMicrophone} from '../classroom/livekit-mute.ts';
import {forwardVerifiedMicPolicy} from '../classroom/mic-policy.ts';
import {readTeacherLifecycle,readLearnerLifecycle,teacherLifecycleAction,parseLifecycleAction} from '../classroom/lesson-lifecycle-write.ts';
import {forwardCorrections,parseClientCorrection} from '../classroom/live-corrections.ts';
import { normalizePhone, onlyKeys, readObject, validName } from './input.ts';

type Auth = ReturnType<typeof createAuth>;
async function forwardAuth(auth: Auth, request: Request, path: string, body?: Record<string, unknown>) {
  const settings = new URL(request.url);
  settings.pathname = '/internal-auth' + path; settings.search = '';
  const headers = new Headers(request.headers);
  headers.delete('content-length');
  if (body) headers.set('content-type', 'application/json');
  return auth.handler(new Request(settings, {
    method: request.method, headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  }));
}
async function credentials(auth: Auth, db: CoreDatabase, request: Request, path: string, requestId: string) {
  if (request.method !== 'POST') return reply(405, { code: 'METHOD_NOT_ALLOWED' }, requestId);
  const input = await readObject(request), register = path === '/api/auth/register';
  const phone = normalizePhone(input?.phoneNumber);
  if (!input || !phone || typeof input.password !== 'string' || input.password.length < 8 ||
      input.password.length > 128 || !onlyKeys(input, register ? ['name','phoneNumber','password'] : ['phoneNumber','password']) ||
      (register && !validName(input.name))) return reply(400, { code: 'INVALID_CREDENTIAL_INPUT' }, requestId);
  const body = register ? { name: (input.name as string).trim(), phoneNumber: phone,
    email: crypto.randomUUID() + '@accounts.noor.invalid', password: input.password }
    : { phoneNumber: phone, password: input.password };
  const response = await forwardAuth(auth, request, register ? '/sign-up/email' : '/sign-in/phone-number', body);
  if (!response.ok) return reply(response.status >= 500 ? 503 : response.status, {
    code: response.status === 429 ? 'RATE_LIMITED' : register ? 'REGISTRATION_FAILED' : 'INVALID_CREDENTIALS',
  }, requestId);
  const result: unknown = await response.json();
  const user = result && typeof result === 'object' ? (result as Record<string, unknown>).user : null;
  if (!user || typeof user !== 'object' || typeof (user as Record<string, unknown>).id !== 'string')
    return reply(503, { code: 'AUTH_UNAVAILABLE' }, requestId);
  const userId = (user as { id: string }).id;
  const owner = await ownerAccount(db, userId);
  if (!owner) {
    const token = (result as Record<string, unknown>).token;
    if (typeof token === 'string') await db.prepare('DELETE FROM auth_sessions WHERE user_id=? AND token=?').bind(userId, token).run();
    return reply(403, { code: 'ACCOUNT_UNAVAILABLE' }, requestId);
  }
  const outgoing = reply(200, { user: { id: userId, name: (user as Record<string, unknown>).name },
    phoneVerified: (user as Record<string, unknown>).phoneNumberVerified === true }, requestId);
  for (const cookie of response.headers.getSetCookie()) outgoing.headers.append('Set-Cookie', cookie);
  return outgoing;
}

async function profiles(env: Env, db: CoreDatabase, accountId: string, authSubject: string, request: Request, path: string, requestId: string) {
  if (path === '/v1/me/learners' && request.method === 'GET') {
    const learners = await listOwnedLearners(db, { authSubject });
    return reply(200, { learners: learners.map(row => ({ id: row.id, name: row.displayName, learnerType: row.learnerType, revision:row.revision })) }, requestId);
  }
  if (path === '/v1/me/learners' && request.method === 'POST') {
    const input = await readObject(request);
    if (!input || !onlyKeys(input, ['name','learnerType']) || !validName(input.name) ||
      !['adult','child'].includes(String(input.learnerType))) return reply(400, { code: 'INVALID_LEARNER' }, requestId);
    const id = crypto.randomUUID();
    try {
      await db.prepare("INSERT INTO learners(id,account_id,display_name,learner_type,status,created_at_ms) VALUES(?,?,?,?,'active',?)")
        .bind(id, accountId, input.name.trim(), input.learnerType, Date.now()).run();
    } catch (error) {
      if (error instanceof Error && error.message.includes('learner profile limit'))
        return reply(409, { code: 'LEARNER_LIMIT' }, requestId);
      throw error;
    }
    return reply(201, { learner: { id, name: input.name.trim(), learnerType: input.learnerType, revision:1 } }, requestId);
  }
  const profileMatch = /^\/v1\/me\/learners\/([a-zA-Z0-9-]{1,128})\/profile-actions$/.exec(path);
  if (profileMatch) {
    if (request.method!=='POST') return reply(405,{code:'METHOD_NOT_ALLOWED'},requestId);
    const schema=await db.prepare(
      "SELECT version FROM noor_schema_meta WHERE component='learner_profiles'",
    ).first<{version:number}>();
    if(schema?.version!==1)return reply(503,{code:'PROFILE_SCHEMA_NOT_READY'},requestId);
    const input=parseLearnerProfileAction(await readObject(request));
    if(!input)return reply(400,{code:'INVALID_PROFILE_ACTION'},requestId);
    const result=await applyLearnerProfileAction(db,accountId,authSubject,profileMatch[1]!,input);
    const {status,...body}=result;
    return reply(status,body,requestId);
  }
  const ownerTrialCancel=/^\/v1\/me\/learners\/([a-zA-Z0-9-]{1,128})\/trial-cancellations$/.exec(path);
  if(ownerTrialCancel){
    if(request.method!=='POST')return reply(405,{code:'METHOD_NOT_ALLOWED'},requestId);
    const schema=await db.prepare(
      "SELECT version FROM noor_schema_meta WHERE component='trial_owner_cancel'"
    ).first<{version:number}>();
    if(schema?.version!==1)return reply(503,{code:'TRIAL_CANCEL_SCHEMA_NOT_READY'},requestId);
    const result=await cancelOwnerTrial(db,authSubject,ownerTrialCancel[1]!,
      await readObject(request));
    const {status,...body}=result;return reply(status,body,requestId);
  }
  const trialRoute=/^\/v1\/me\/learners\/([a-zA-Z0-9-]{1,128})\/(trial-slots|trial-bookings)$/.exec(path);
  if(trialRoute){
    const learnerId=trialRoute[1]!,mode=trialRoute[2]!;
    if(request.method!==(mode==='trial-slots'?'GET':'POST'))
      return reply(405,{code:'METHOD_NOT_ALLOWED'},requestId);
    const schema=await db.prepare(
      "SELECT version FROM noor_schema_meta WHERE component='free_trial_booking'"
    ).first<{version:number}>();
    if(schema?.version!==1)return reply(503,{code:'TRIAL_SCHEMA_NOT_READY'},requestId);
    const result=mode==='trial-slots'
      ?await listOwnerTrialSlots(db,authSubject,learnerId)
      :await bookOwnerTrial(db,authSubject,learnerId,await readObject(request));
    const {status,...body}=result;return reply(status,body,requestId);
  }
  const ownedAttendance=/^\/v1\/me\/learners\/([a-zA-Z0-9-]{1,128})\/(attendance-cases|attendance-appeals)$/.exec(path);
  if(ownedAttendance){
    const learnerId=ownedAttendance[1]!,mode=ownedAttendance[2]!;
    if(request.method!==(mode==='attendance-cases'?'GET':'POST'))
      return reply(405,{code:'METHOD_NOT_ALLOWED'},requestId);
    const schema=await db.prepare(
      "SELECT version FROM noor_schema_meta WHERE component='attendance_cases'"
    ).first<{version:number}>();
    if(schema?.version!==1)return reply(503,{code:'ATTENDANCE_SCHEMA_NOT_READY'},requestId);
    const result=mode==='attendance-cases'
      ?await listOwnerAttendance(db,authSubject,learnerId)
      :await submitAttendanceAppeal(db,authSubject,learnerId,await readObject(request));
    const {status,...body}=result;return reply(status,body,requestId);
  }
  const ownedInbox=/^\/v1\/me\/learners\/([a-zA-Z0-9-]{1,128})\/(inbox|inbox-actions)$/.exec(path);
  if(ownedInbox){
    const learnerId=ownedInbox[1]!,kind=ownedInbox[2]!;
    if(request.method!==(kind==='inbox'?'GET':'POST'))
      return reply(405,{code:'METHOD_NOT_ALLOWED'},requestId);
    const schema=await db.prepare(
      "SELECT version FROM noor_schema_meta WHERE component='inbox'"
    ).first<{version:number}>();
    if(schema?.version!==1)return reply(503,{code:'INBOX_SCHEMA_NOT_READY'},requestId);
    const result=kind==='inbox'
      ?await listInbox(db,authSubject,'owner',learnerId)
      :await changeInboxRead(db,authSubject,'owner',learnerId,await readObject(request));
    const {status,...body}=result;return reply(status,body,requestId);
  }
  const myAttempts=/^\/v1\/me\/learners\/([a-zA-Z0-9-]{1,128})\/assignments\/([a-zA-Z0-9-]{1,128})\/submissions$/.exec(path);
  if(myAttempts){
    if(request.method!=='GET'&&request.method!=='POST')
      return reply(405,{code:'METHOD_NOT_ALLOWED'},requestId);
    const version=await db.prepare("SELECT version FROM noor_schema_meta WHERE component='assignment_submissions'")
      .first<{version:number}>();
    if(version?.version!==1)return reply(503,{code:'SUBMISSION_SCHEMA_NOT_READY'},requestId);
    const learnerId=myAttempts[1]!,assignmentId=myAttempts[2]!;
    const result=request.method==='GET'
      ?await getStudentAttempts(db,authSubject,learnerId,assignmentId)
      :await (async()=>{
        const command=parseSubmission(await readObject(request));
        if(!command)return {status:400,code:'INVALID_SUBMISSION'} as const;
        return submitStudentAttempt(db,authSubject,learnerId,assignmentId,command);
      })();
    const {status,...body}=result;
    return reply(status,body,requestId);
  }
  // Phase 06A1: safe read-only capability discovery. No endpoint may grant
  // child consent, mint an R2 upload, serve audio, or treat phone as guardian proof.
  const audioPolicyMatch=/^\/v1\/me\/learners\/([a-zA-Z0-9-]{1,128})\/recitation-audio-policy$/.exec(path);
  if(audioPolicyMatch){
    if(request.method!=='GET')return reply(405,{code:'METHOD_NOT_ALLOWED'},requestId);
    if(!await verifiedOwner(db,authSubject,audioPolicyMatch[1]!))
      return reply(404,{code:'NOT_FOUND'},requestId);
    const migration=await db.prepare(
      "SELECT version FROM noor_schema_meta WHERE component='recitation_audio_privacy'"
    ).first<{version:number}>();
    if(migration?.version!==1)return reply(503,{code:'AUDIO_PRIVACY_SCHEMA_NOT_READY'},requestId);
    return reply(200,{
      uploadEnabled:PRIVATE_RECITATION_UPLOADS_ENABLED,
      consentStatus:'not_available',
      storageStatus:'not_configured',
      code:'AUDIO_PRIVACY_APPROVAL_REQUIRED',
    },requestId);
  }
  const ownedAssignmentsMatch=/^\/v1\/me\/learners\/([a-zA-Z0-9-]{1,128})\/assignments$/.exec(path);
  if(ownedAssignmentsMatch){
    if(request.method!=='GET')return reply(405,{code:'METHOD_NOT_ALLOWED'},requestId);
    const version=await db.prepare("SELECT version FROM noor_schema_meta WHERE component='assignments'")
      .first<{version:number}>();
    if(version?.version!==1)return reply(503,{code:'ASSIGNMENT_SCHEMA_NOT_READY'},requestId);
    const result=await readOwnerAssignments(db,authSubject,ownedAssignmentsMatch[1]!);
    const {status,...body}=result;
    return reply(status,body,requestId);
  }
  // Phase 07A: only latest APPROVED report, never the Sheikh's draft.
  const ownedReports=/^\/v1\/me\/learners\/([a-zA-Z0-9-]{1,128})\/reports$/.exec(path);
  if(ownedReports){
    if(request.method!=='GET')return reply(405,{code:'METHOD_NOT_ALLOWED'},requestId);
    const version=await db.prepare("SELECT version FROM noor_schema_meta WHERE component='lesson_reports'")
      .first<{version:number}>();
    if(version?.version!==1)return reply(503,{code:'REPORT_SCHEMA_NOT_READY'},requestId);
    const result=await getStudentReports(db,authSubject,ownedReports[1]!);
    const {status,...body}=result;return reply(status,body,requestId);
  }
  const ownedPlanMatch=/^\/v1\/me\/learners\/([a-zA-Z0-9-]{1,128})\/plan$/.exec(path);
  if(ownedPlanMatch){
    if(request.method!=='GET')return reply(405,{code:'METHOD_NOT_ALLOWED'},requestId);
    const version=await db.prepare(
      "SELECT version FROM noor_schema_meta WHERE component='academic_plan'",
    ).first<{version:number}>();
    if(version?.version!==1)return reply(503,{code:'PLAN_SCHEMA_NOT_READY'},requestId);
    const result=await readOwnerPlan(db,authSubject,ownedPlanMatch[1]!);
    const {status,...body}=result;
    return reply(status,body,requestId);
  }
  // ADR 0009 / #251 A2: authenticated cumulative reader only. The old
  // student-private Mushaf is included ONLY for its verified owner; teachers
  // cannot read any private marks or claim another account's learner.
  const cumulative=/^\/v1\/me\/learners\/([a-zA-Z0-9-]{1,128})\/cumulative-quran$/.exec(path);
  if(cumulative){
    if(request.method!=='GET')return reply(405,{code:'METHOD_NOT_ALLOWED'},requestId);
    const learnerId=cumulative[1]!;
    if(!await getOwnedLearner(db,{authSubject},learnerId))
      return reply(404,{code:'NOT_FOUND'},requestId);
    const params=new URL(request.url).searchParams;
    if(params.size!==1||!/^([1-9]\d{0,2})$/.test(params.get('page')??'')||
       Number(params.get('page'))>604)
      return reply(400,{code:'INVALID_QURAN_PAGE'},requestId);
    const version=await db.prepare(
      "SELECT version FROM noor_schema_meta WHERE component='learner_quran_ledger'",
    ).first<{version:number}>();
    if(version?.version!==1)return reply(503,{code:'QURAN_LEDGER_SCHEMA_NOT_READY'},requestId);
    const result=await readOwnerCumulativePage(db,authSubject,learnerId,Number(params.get('page')));
    const {status,...body}=result;
    // Never expose internal auth subject ids in web read responses.
    if('current' in body&&Array.isArray(body.current))
      return reply(status,{learnerId,...body,
        current:body.current.map(({authorSubject,...safe})=>{void authorSubject;return safe;})},requestId);
    return reply(status,{learnerId,...body},requestId);
  }
  const mushafMatch = /^\/v1\/me\/learners\/([a-zA-Z0-9-]{1,128})\/mushaf$/.exec(path);
  if(mushafMatch){
    if(request.method!=='GET'&&request.method!=='POST')
      return reply(405,{code:'METHOD_NOT_ALLOWED'},requestId);
    const learnerId=mushafMatch[1]!;
    // The verified owner account + requested learner must agree on D1; this
    // path never authorizes a teacher or a browser asserted owner header.
    if(!await getOwnedLearner(db,{authSubject},learnerId))
      return reply(404,{code:'NOT_FOUND'},requestId);
    const schema=await db.prepare(
      "SELECT version FROM noor_schema_meta WHERE component='private_mushaf'",
    ).first<{version:number}>();
    if(schema?.version!==1)return reply(503,{code:'PRIVATE_MUSHAF_SCHEMA_NOT_READY'},requestId);
    if(request.method==='GET'){
      const url=new URL(request.url),q=url.searchParams;
      if((q.has('index')&& (q.size!==1||q.get('index')!=='1')) ||
         (!q.has('index')&&(q.size!==1||!/^([1-9]\d{0,2})$/.test(q.get('page')??'') ||
           Number(q.get('page'))>604)))
        return reply(400,{code:'INVALID_MUSHAF_PAGE'},requestId);
      const result=await readPrivateMushaf(db,learnerId,q.has('index')?null:Number(q.get('page')));
      const {status,...body}=result;
      return reply(status,{learnerId,...body},requestId);
    }
    const command=parsePrivateMushafOp(await readObject(request,120000));
    if(!command)return reply(400,{code:'INVALID_MUSHAF_OPERATION'},requestId);
    const result=await applyPrivateMushaf(db,authSubject,learnerId,command);
    const {status,...body}=result;
    return reply(status,{learnerId,...body},requestId);
  }
  // #253: completed, audited lesson, as-of-End immutable shared marks only.
  // Unlike quran-archive, this does not claim a published sealed report.
  const historyMatch=/^\/v1\/me\/learners\/([a-zA-Z0-9-]{1,128})\/lessons\/([a-zA-Z0-9-]{1,128})\/quran-history$/.exec(path);
  if(historyMatch){
    if(request.method!=='GET')return reply(405,{code:'METHOD_NOT_ALLOWED'},requestId);
    const params=new URL(request.url).searchParams;
    if(params.size>1||(params.size===1&&!params.has('page'))||
       (params.has('page')&&(!/^([1-9]\d{0,2})$/.test(params.get('page')??'')||
        Number(params.get('page'))>604)))
      return reply(400,{code:'INVALID_HISTORY_PAGE'},requestId);
    const version=await db.prepare(
      "SELECT version FROM noor_schema_meta WHERE component='learner_quran_ledger'"
    ).first<{version:number}>();
    if(version?.version!==1)return reply(503,{code:'QURAN_LEDGER_SCHEMA_NOT_READY'},requestId);
    const result=await readOwnerLessonQuranHistory(db,authSubject,
      historyMatch[1]!,historyMatch[2]!,
      params.has('page')?Number(params.get('page')):null);
    const {status,...body}=result;
    return reply(status,body,requestId);
  }
  // Phase 08B1: ONLY owner-readable, current-report published and DO-sealed
  // lesson Quran layers. No public mutation, seal, archive upload or export route.
  const archiveMatch=/^\/v1\/me\/learners\/([a-zA-Z0-9-]{1,128})\/lessons\/([a-zA-Z0-9-]{1,128})\/quran-archive$/.exec(path);
  if(archiveMatch){
    if(request.method!=='GET')return reply(405,{code:'METHOD_NOT_ALLOWED'},requestId);
    const version=await db.prepare("SELECT version FROM noor_schema_meta WHERE component='lesson_quran_archive'")
      .first<{version:number}>();
    if(version?.version!==1)return reply(503,{code:'ARCHIVE_SCHEMA_NOT_READY'},requestId);
    const result=await readLessonQuranArchive(db,authSubject,archiveMatch[1]!,archiveMatch[2]!);
    const {status,...body}=result;return reply(status,body,requestId);
  }
  // Phase 08A: individual learner's private lesson note journal; never the
  // Sheikh's shared Quran layer and never a cross-profile note source.
  const noteMatch=/^\/v1\/me\/learners\/([a-zA-Z0-9-]{1,128})\/lessons\/([a-zA-Z0-9-]{1,128})\/notebook-notes$/.exec(path);
  if(noteMatch){
    if(request.method!=='GET'&&request.method!=='POST')
      return reply(405,{code:'METHOD_NOT_ALLOWED'},requestId);
    const version=await db.prepare("SELECT version FROM noor_schema_meta WHERE component='notebook_notes'")
      .first<{version:number}>();
    if(version?.version!==1)return reply(503,{code:'NOTEBOOK_SCHEMA_NOT_READY'},requestId);
    const learnerId=noteMatch[1]!,lessonId=noteMatch[2]!;
    const result=request.method==='GET'
      ?await readNotebookNotes(db,authSubject,learnerId,lessonId)
      :await (async()=>{
         const action=parseNotebookAction(await readObject(request));
         if(!action)return {status:400,code:'INVALID_NOTEBOOK_ACTION'} as const;
         return writeNotebookNote(db,authSubject,learnerId,lessonId,action);
       })();
    const {status,...body}=result;return reply(status,body,requestId);
  }
  // CR-01: a signed household owner controls exactly their verified learner.
  // Public commands contain ONLY {action}; all actor fields come from auth + D1.
  // CR-02A token request: no browser-provided identity, role, room, grant,
  // scope or arbitrary room/admin settings. Same-origin POST only.
  const learnerLifecycle=/^\/v1\/me\/learners\/([a-zA-Z0-9-]{1,128})\/lessons\/([a-zA-Z0-9-]{1,128})\/lifecycle$/.exec(path);
  if(learnerLifecycle){
    if(request.method!=='GET')return reply(405,{code:'METHOD_NOT_ALLOWED'},requestId);
    const outcome=await readLearnerLifecycle(env,authSubject,learnerLifecycle[1]!,learnerLifecycle[2]!);
    const {status,...body}=outcome;return reply(status,body,requestId);
  }
  const learnerMicPolicy=/^\/v1\/me\/learners\/([a-zA-Z0-9-]{1,128})\/lessons\/([a-zA-Z0-9-]{1,128})\/microphone-policy$/.exec(path);
  if(learnerMicPolicy){
    if(request.method!=='GET')return reply(405,{code:'METHOD_NOT_ALLOWED'},requestId);
    const learnerId=learnerMicPolicy[1]!,lessonId=learnerMicPolicy[2]!;
    const access=await checkOwnedLearnerClassroomAccess(db,accountId,learnerId,lessonId);
    if(!access)return reply(404,{code:'NOT_FOUND'},requestId);
    const result=await forwardVerifiedMicPolicy(env,{lessonId,learnerId,
      actorSubject:authSubject,role:'learner'},'snapshot');
    const {status,...body}=result;return reply(status,body,requestId);
  }
  const learnerMedia=/^\/v1\/me\/learners\/([a-zA-Z0-9-]{1,128})\/lessons\/([a-zA-Z0-9-]{1,128})\/media-token$/.exec(path);
  if(learnerMedia){
    if(request.method!=='POST')return reply(405,{code:'METHOD_NOT_ALLOWED'},requestId);
    const learnerId=learnerMedia[1]!,lessonId=learnerMedia[2]!;
    const access=await checkOwnedLearnerClassroomAccess(db,accountId,learnerId,lessonId);
    if(!access)return reply(404,{code:'NOT_FOUND'},requestId);
    const body=await readObject(request);
    if(!body||Object.keys(body).length!==0)
      return reply(400,{code:'INVALID_MEDIA_TOKEN_REQUEST'},requestId);
    const outcome=await createMediaToken(env,{lessonId,learnerId,
      actorSubject:authSubject,role:'learner'},access);
    const {status,...safe}=outcome;return reply(status,safe,requestId);
  }
  const learnerInk=/^\/v1\/me\/learners\/([a-zA-Z0-9-]{1,128})\/lessons\/([a-zA-Z0-9-]{1,128})\/quran-ink$/.exec(path);
  if(learnerInk){
    if(request.method!=='GET'&&request.method!=='POST')
      return reply(405,{code:'METHOD_NOT_ALLOWED'},requestId);
    const learnerId=learnerInk[1]!,lessonId=learnerInk[2]!;
    // Both GET and POST re-check the signed household and exact learner/lesson
    // relationship; the browser cannot claim an actor, owner, or teacher role.
    const access=await checkOwnedLearnerClassroomAccess(db,accountId,learnerId,lessonId);
    if(!access)return reply(404,{code:'NOT_FOUND'},requestId);
    const canWrite=env.NOOR_CUMULATIVE_INK_ENABLED==='true'&&access.status==='live';
    // Never accept a room-only learner stroke as canonical Quran persistence.
    if(request.method==='POST'&&!canWrite)
      return reply(access.status==='live'?503:409,
        {code:access.status==='live'?'CUMULATIVE_INK_DISABLED':'LESSON_NOT_LIVE'},requestId);
    const params=new URL(request.url).searchParams;
    const action=request.method==='GET'?
      (params.size===1?parseClientInk({action:'snapshot',page:Number(params.get('page'))},'learner'):null):
      parseClientInk(await readObject(request),'learner');
    if(!action||(request.method==='POST'&&action.action==='snapshot'))
      return reply(400,{code:'INVALID_INK_COMMAND'},requestId);
    const outcome=await forwardVerifiedInk(env,{lessonId,learnerId,
      actorSubject:authSubject,role:'learner'},action);
    const {status,...body}=outcome;
    return reply(status,{...body,...(request.method==='GET'?{canWrite}:{})},requestId);
  }
  const learnerQuran=/^\/v1\/me\/learners\/([a-zA-Z0-9-]{1,128})\/lessons\/([a-zA-Z0-9-]{1,128})\/quran-page$/.exec(path);
  if(learnerQuran){
    if(request.method!=='GET')return reply(405,{code:'METHOD_NOT_ALLOWED'},requestId);
    const learnerId=learnerQuran[1]!,lessonId=learnerQuran[2]!;
    const access=await checkOwnedLearnerClassroomAccess(db,accountId,learnerId,lessonId);
    if(!access)return reply(404,{code:'NOT_FOUND'},requestId);
    const outcome=await forwardVerifiedPage(env,{lessonId,learnerId,
      actorSubject:authSubject,role:'learner'},{action:'snapshot'});
    const {status,...body}=outcome;return reply(status,body,requestId);
  }
  const learnerPresence=/^\/v1\/me\/learners\/([a-zA-Z0-9-]{1,128})\/lessons\/([a-zA-Z0-9-]{1,128})\/(presence|presence-actions)$/.exec(path);
  if(learnerPresence){
    const learnerId=learnerPresence[1]!,lessonId=learnerPresence[2]!;
    const mode=learnerPresence[3]!;
    if(request.method!==(mode==='presence'?'GET':'POST'))
      return reply(405,{code:'METHOD_NOT_ALLOWED'},requestId);
    const access=await checkOwnedLearnerClassroomAccess(db,accountId,learnerId,lessonId);
    if(!access)return reply(404,{code:'NOT_FOUND'},requestId);
    const action=mode==='presence'?'snapshot':parseClientPresenceAction(await readObject(request));
    if(!action)return reply(400,{code:'INVALID_ROOM_ACTION'},requestId);
    const outcome=await forwardVerifiedPresence(env,{lessonId,learnerId,
      role:'learner',actorSubject:authSubject},action);
    const {status,...body}=outcome;return reply(status,body,requestId);
  }
  const learnerAccessMatch = /^\/v1\/me\/learners\/([a-zA-Z0-9-]{1,128})\/lessons\/([a-zA-Z0-9-]{1,128})\/access$/.exec(path);
  if (learnerAccessMatch && request.method === 'GET') {
    const access = await checkOwnedLearnerClassroomAccess(
      db, accountId, learnerAccessMatch[1]!, learnerAccessMatch[2]!,
    );
    return access
      ? reply(200, { access, roomConnected: false, code: 'CLASSROOM_NOT_CONNECTED' }, requestId)
      : reply(404, { code: 'NOT_FOUND' }, requestId);
  }
  const lessonMatch = /^\/v1\/me\/learners\/([a-zA-Z0-9-]{1,128})\/lessons$/.exec(path);
  if (lessonMatch && request.method === 'GET') {
    const learnerId = lessonMatch[1]!;
    const owned = await getOwnedLearner(db, { authSubject }, learnerId);
    if (!owned) return reply(404, { code: 'NOT_FOUND' }, requestId);
    const lessons = await listOwnedLearnerLessons(db, accountId, learnerId);
    return reply(200, { learnerId, lessons }, requestId);
  }
  const match = /^\/v1\/learners\/([a-zA-Z0-9-]{1,128})$/.exec(path);
  if (match && request.method === 'GET') {
    const row = await getOwnedLearner(db, { authSubject }, match[1]!);
    return row ? reply(200, { learner: { id: row.id, name: row.displayName, learnerType: row.learnerType, revision:row.revision } }, requestId)
      : reply(404, { code: 'NOT_FOUND' }, requestId);
  }
  return reply(404, { code: 'NOT_FOUND' }, requestId);
}

export async function handleAuthenticated(request: Request, env: Env, requestId: string): Promise<Response> {
  const settings = authSettings(env);
  if (!settings || !env.DB) return reply(503, { code: 'AUTH_NOT_CONFIGURED' }, requestId);
  const origin = request.headers.get('origin');
  const mutation = request.method !== 'GET' && request.method !== 'HEAD';
  if ((origin !== null && origin !== settings.origin) || (mutation && origin !== settings.origin))
    return reply(403, { code: 'BAD_ORIGIN' }, requestId);
  const version = await env.DB.prepare("SELECT version FROM noor_schema_meta WHERE component='auth'").first<{ version: number }>();
  if (version?.version !== 1) return reply(503, { code: 'AUTH_SCHEMA_NOT_READY' }, requestId);
  const auth = createAuth(env), path = new URL(request.url).pathname;
  if (path === '/api/auth/register' || path === '/api/auth/login')
    return credentials(auth, env.DB, request, path, requestId);
  if (path === '/api/auth/logout') {
    if (request.method !== 'POST') return reply(405, { code: 'METHOD_NOT_ALLOWED' }, requestId);
    const response = await forwardAuth(auth, request, '/sign-out');
    const result = reply(response.ok ? 200 : 401, { code: response.ok ? 'SIGNED_OUT' : 'UNAUTHENTICATED' }, requestId);
    for (const cookie of response.headers.getSetCookie()) result.headers.append('Set-Cookie', cookie);
    return result;
  }
  // The library re-reads the signed session from D1; cookie cache and unverified token auth are disabled.
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return reply(401, { code: 'UNAUTHENTICATED' }, requestId);
  // Same-origin signed, read-only realtime hints. Neither role nor identity
  // comes from a WebSocket payload or client-asserted request headers.
  const teacherRealtime=/^\\/v1\\/teacher\\/lessons\\/([a-zA-Z0-9-]{1,128})\\/realtime$/.exec(path);
  if(teacherRealtime){
    const lessonId=teacherRealtime[1]!;
    const access=await checkTeacherClassroomAccess(env.DB,session.user.id,lessonId);
    if(!access)return reply(404,{code:'NOT_FOUND'},requestId);
    return openVerifiedRealtime(env,{lessonId,learnerId:access.learnerId,
      actorSubject:session.user.id,role:'teacher'},request);
  }
  const learnerRealtime=/^\\/v1\\/me\\/learners\\/([a-zA-Z0-9-]{1,128})\\/lessons\\/([a-zA-Z0-9-]{1,128})\\/realtime$/.exec(path);
  if(learnerRealtime){
    const learnerId=learnerRealtime[1]!,lessonId=learnerRealtime[2]!;
    const owner=await ownerAccount(env.DB,session.user.id);
    if(!owner)return reply(404,{code:'NOT_FOUND'},requestId);
    const access=await checkOwnedLearnerClassroomAccess(env.DB,owner.id,learnerId,lessonId);
    if(!access)return reply(404,{code:'NOT_FOUND'},requestId);
    return openVerifiedRealtime(env,{lessonId,learnerId,
      actorSubject:session.user.id,role:'learner'},request);
  }

  const staffTrialClose=/^\/v1\/staff\/trial-slots\/([a-zA-Z0-9-]{1,128})\/close$/.exec(path);
  if(staffTrialClose){
    if(request.method!=='POST')return reply(405,{code:'METHOD_NOT_ALLOWED'},requestId);
    const schema=await env.DB.prepare(
      "SELECT version FROM noor_schema_meta WHERE component='free_trial_booking'"
    ).first<{version:number}>();
    if(schema?.version!==1)return reply(503,{code:'TRIAL_SCHEMA_NOT_READY'},requestId);
    const result=await closeTrialSlot(env.DB,session.user.id,
      staffTrialClose[1]!,await readObject(request));
    const {status,...body}=result;return reply(status,body,requestId);
  }
  if(path==='/v1/staff/trial-slots'){
    if(request.method!=='POST')return reply(405,{code:'METHOD_NOT_ALLOWED'},requestId);
    const schema=await env.DB.prepare(
      "SELECT version FROM noor_schema_meta WHERE component='free_trial_booking'"
    ).first<{version:number}>();
    if(schema?.version!==1)return reply(503,{code:'TRIAL_SCHEMA_NOT_READY'},requestId);
    const result=await publishTrialSlot(env.DB,session.user.id,await readObject(request));
    const {status,...body}=result;return reply(status,body,requestId);
  }
  if(path==='/v1/staff/attendance-appeals'||path==='/v1/staff/attendance-appeals/review'){
    const list=path==='/v1/staff/attendance-appeals';
    if(request.method!==(list?'GET':'POST'))
      return reply(405,{code:'METHOD_NOT_ALLOWED'},requestId);
    const schema=await env.DB.prepare(
      "SELECT version FROM noor_schema_meta WHERE component='attendance_cases'"
    ).first<{version:number}>();
    if(schema?.version!==1)return reply(503,{code:'ATTENDANCE_SCHEMA_NOT_READY'},requestId);
    const result=list
      ?await listStaffAttendanceAppeals(env.DB,session.user.id)
      :await reviewAttendanceAppeal(env.DB,session.user.id,await readObject(request));
    const {status,...body}=result;return reply(status,body,requestId);
  }
  if (path === '/v1/staff/schedule-actions') {
    if(request.method!=='POST')return reply(405,{code:'METHOD_NOT_ALLOWED'},requestId);
    // No client-asserted staff grant, account or teacher identity is trusted.
    if(!await canManageTeachers(env.DB,session.user.id))
      return reply(403,{code:'STAFF_ACCESS_DENIED'},requestId);
    const version=await env.DB.prepare(
      "SELECT version FROM noor_schema_meta WHERE component='staff_schedule'",
    ).first<{version:number}>();
    if(version?.version!==1)return reply(503,{code:'SCHEDULE_SCHEMA_NOT_READY'},requestId);
    const command=parseScheduleCommand(await readObject(request));
    if(!command)return reply(400,{code:'INVALID_SCHEDULE_ACTION'},requestId);
    const outcome=await executeStaffSchedule(env.DB,session.user.id,command);
    const {status,...safe}=outcome;
    // D1 cancellation is already committed; trigger the room's authoritative
    // D1 reconcile now, not a browser-provided LiveKit identity.
    const mediaEnforcement=command.action==='cancel'&&
      (outcome.code==='SCHEDULE_ACTION_APPLIED'||outcome.code==='OPERATION_ALREADY_APPLIED')
      ?await wakeLessonMediaReconciliation(env,command.resourceId!)
      :undefined;
    return reply(status,{...safe,...(mediaEnforcement?{mediaEnforcement}: {})},requestId);
  }
  if (path === '/v1/staff/teacher-actions') {
    if (request.method !== 'POST') return reply(405, {code:'METHOD_NOT_ALLOWED'}, requestId);
    // No public path can mint staff grants. Role is resolved from verified
    // Better Auth + D1, BEFORE accepting a target identity.
    if (!await canManageTeachers(env.DB, session.user.id))
      return reply(403, {code:'STAFF_ACCESS_DENIED'}, requestId);
    const migration=await env.DB.prepare(
      "SELECT version FROM noor_schema_meta WHERE component='teacher_roles'",
    ).first<{version:number}>();
    if(migration?.version!==1)return reply(503, {code:'TEACHER_ROLE_SCHEMA_NOT_READY'}, requestId);
    const input=parseTeacherAction(await readObject(request));
    if(!input)return reply(400, {code:'INVALID_TEACHER_ACTION'}, requestId);
    const output=await issueTeacherRoleAction(env.DB,session.user.id,input);
    const {status,...data}=output;
    // Suspended/dequalified acting teachers must lose active media; this
    // wake happens after committed role change and is idempotent on replay.
    const mediaEnforcement=(input.action==='suspend'||input.action==='revoke_qualification')&&
      output.teacherId&&
      (output.code==='TEACHER_ROLE_CHANGED'||output.code==='OPERATION_ALREADY_APPLIED')
      ?await wakeActingTeacherMedia(env,output.teacherId)
      :undefined;
    return reply(status,{...data,...(mediaEnforcement?{mediaEnforcement}: {})},requestId);
  }
  // Academic annotations: signed teacher may see only currently assigned
  // shared annotations. Student-private ink/notes are never queried here.
  const teacherCumulative=/^\/v1\/teacher\/learners\/([a-zA-Z0-9-]{1,128})\/cumulative-quran$/.exec(path);
  if(teacherCumulative){
    if(request.method!=='GET')return reply(405,{code:'METHOD_NOT_ALLOWED'},requestId);
    const params=new URL(request.url).searchParams;
    if(params.size!==1||!/^([1-9]\d{0,2})$/.test(params.get('page')??'')||
       Number(params.get('page'))>604)
      return reply(400,{code:'INVALID_QURAN_PAGE'},requestId);
    const version=await env.DB.prepare(
      "SELECT version FROM noor_schema_meta WHERE component='learner_quran_ledger'",
    ).first<{version:number}>();
    if(version?.version!==1)return reply(503,{code:'QURAN_LEDGER_SCHEMA_NOT_READY'},requestId);
    const learnerId=teacherCumulative[1]!;
    const result=await readTeacherSharedPage(env.DB,session.user.id,learnerId,Number(params.get('page')));
    const {status,...body}=result;
    if('items' in body&&Array.isArray(body.items))
      return reply(status,{learnerId,...body,
        items:body.items.map(({authorSubject,...safe})=>{void authorSubject;return safe;})},requestId);
    return reply(status,{learnerId,...body},requestId);
  }
  if(path==='/v1/teacher/assignment-catalog'){
    if(request.method!=='GET')return reply(405,{code:'METHOD_NOT_ALLOWED'},requestId);
    const version=await env.DB.prepare("SELECT version FROM noor_schema_meta WHERE component='assignments'")
     .first<{version:number}>();
    if(version?.version!==1)return reply(503,{code:'ASSIGNMENT_SCHEMA_NOT_READY'},requestId);
    const result=await getAssignmentCatalog(env.DB,session.user.id);
    const {status,...body}=result;
    return reply(status,body,requestId);
  }
  const teacherReviews=/^\/v1\/teacher\/learners\/([a-zA-Z0-9-]{1,128})\/assignments\/([a-zA-Z0-9-]{1,128})\/reviews$/.exec(path);
  if(teacherReviews){
    if(request.method!=='GET'&&request.method!=='POST')
      return reply(405,{code:'METHOD_NOT_ALLOWED'},requestId);
    const version=await env.DB.prepare("SELECT version FROM noor_schema_meta WHERE component='assignment_submissions'")
      .first<{version:number}>();
    if(version?.version!==1)return reply(503,{code:'SUBMISSION_SCHEMA_NOT_READY'},requestId);
    const learnerId=teacherReviews[1]!,assignmentId=teacherReviews[2]!;
    const result=request.method==='GET'
      ?await getTeacherAttempts(env.DB,session.user.id,learnerId,assignmentId)
      :await (async()=>{
        const command=parseReview(await readObject(request));
        if(!command)return {status:400,code:'INVALID_REVIEW'} as const;
        return reviewStudentAttempt(env.DB!,session.user.id,learnerId,assignmentId,command);
      })();
    const {status,...body}=result;
    return reply(status,body,requestId);
  }
  // Sheikh-only private annotations: unpublished versions never reach a student.
  const teacherDraftRange=/^\/v1\/teacher\/learners\/([a-zA-Z0-9-]{1,128})\/assignment-page-range$/.exec(path);
  if(teacherDraftRange){
    if(request.method!=='GET')return reply(405,{code:'METHOD_NOT_ALLOWED'},requestId);
    const params=new URL(request.url).searchParams;
    if(params.size!==4||!['editionId','surah','fromAyah','toAyah'].every(k=>params.has(k)))
      return reply(400,{code:'DRAFT_INVALID_RANGE'},requestId);
    const result=await teacherAssignmentPageRange(env.DB,session.user.id,teacherDraftRange[1]!,
      params.get('editionId')??'',Number(params.get('surah')),
      Number(params.get('fromAyah')),Number(params.get('toAyah')));
    const {status,...body}=result;return reply(status,body,requestId);
  }
  const teacherDrafts=/^\/v1\/teacher\/learners\/([a-zA-Z0-9-]{1,128})\/assignment-drafts$/.exec(path);
  if(teacherDrafts){
    if(request.method!=='GET'&&request.method!=='POST')
      return reply(405,{code:'METHOD_NOT_ALLOWED'},requestId);
    const version=await env.DB.prepare(
      "SELECT version FROM noor_schema_meta WHERE component='teacher_assignment_drafts'"
    ).first<{version:number}>();
    if(version?.version!==1)return reply(503,{code:'DRAFT_SCHEMA_NOT_READY'},requestId);
    const learnerId=teacherDrafts[1]!;
    const result=request.method==='GET'
      ?await readTeacherInkDrafts(env.DB,session.user.id,learnerId)
      :await saveTeacherInkDraft(env.DB,session.user.id,learnerId,
        await readObject(request,180000),Date.now(),env.NOOR_ENVIRONMENT==='staging');
    const {status,...body}=result;
    return reply(status,body,requestId);
  }
  const teacherAssignmentsMatch=/^\/v1\/teacher\/learners\/([a-zA-Z0-9-]{1,128})\/assignments$/.exec(path);
  if(teacherAssignmentsMatch){
    if(request.method!=='GET'&&request.method!=='POST')
      return reply(405,{code:'METHOD_NOT_ALLOWED'},requestId);
    const version=await env.DB.prepare("SELECT version FROM noor_schema_meta WHERE component='assignments'")
     .first<{version:number}>();
    if(version?.version!==1)return reply(503,{code:'ASSIGNMENT_SCHEMA_NOT_READY'},requestId);
    const learnerId=teacherAssignmentsMatch[1]!;
    if(request.method==='GET'){
      const result=await readTeacherAssignments(env.DB,session.user.id,learnerId);
      const {status,...body}=result;
      return reply(status,body,requestId);
    }
    const command=parsePublishAssignment(await readObject(request));
    if(!command)return reply(400,{code:'INVALID_ASSIGNMENT'},requestId);
    if(command.draftId){
      const draftVersion=await env.DB.prepare(
        "SELECT version FROM noor_schema_meta WHERE component='teacher_assignment_drafts'"
      ).first<{version:number}>();
      if(draftVersion?.version!==1)
        return reply(503,{code:'DRAFT_SCHEMA_NOT_READY'},requestId);
    }
    const result=await publishAssignment(env.DB,session.user.id,learnerId,command);
    const {status,...body}=result;
    return reply(status,body,requestId);
  }
  // Report author is the verified ACTING Sheikh of a completed audited lesson,
  // including only a narrowly accepted substitute, never a role asserted by UI.
  const lessonReport=/^\/v1\/teacher\/lessons\/([a-zA-Z0-9-]{1,128})\/(report|report-actions)$/.exec(path);
  if(lessonReport){
    const [,lessonId,kind]=lessonReport;
    if(request.method!==(kind==='report'?'GET':'POST'))
      return reply(405,{code:'METHOD_NOT_ALLOWED'},requestId);
    const version=await env.DB.prepare("SELECT version FROM noor_schema_meta WHERE component='lesson_reports'")
      .first<{version:number}>();
    if(version?.version!==1)return reply(503,{code:'REPORT_SCHEMA_NOT_READY'},requestId);
    const result=kind==='report'
      ?await getTeacherReport(env.DB,session.user.id,lessonId!)
      :await (async()=>{
        const action=parseReportAction(await readObject(request));
        if(!action)return {status:400,code:'INVALID_REPORT_ACTION'} as const;
        return applyTeacherReport(env.DB!,session.user.id,lessonId!,action);
      })();
    const {status,...body}=result;return reply(status,body,requestId);
  }
  const teacherPlanMatch=/^\/v1\/teacher\/learners\/([a-zA-Z0-9-]{1,128})\/(plan|plan-actions)$/.exec(path);
  if(teacherPlanMatch){
    const learnerId=teacherPlanMatch[1]!,kind=teacherPlanMatch[2];
    if(request.method!==(kind==='plan'?'GET':'POST'))
      return reply(405,{code:'METHOD_NOT_ALLOWED'},requestId);
    const schema=await env.DB.prepare(
      "SELECT version FROM noor_schema_meta WHERE component='academic_plan'",
    ).first<{version:number}>();
    if(schema?.version!==1)return reply(503,{code:'PLAN_SCHEMA_NOT_READY'},requestId);
    if(kind==='plan'){
      const result=await readTeacherPlan(env.DB,session.user.id,learnerId);
      const {status,...body}=result;
      return reply(status,body,requestId);
    }
    const command=parsePlanAction(await readObject(request));
    if(!command)return reply(400,{code:'INVALID_PLAN_ACTION'},requestId);
    const result=await writeTeacherPlan(env.DB,session.user.id,learnerId,command);
    const {status,...body}=result;
    return reply(status,body,requestId);
  }
  // CR-01: freshly verify qualified acting teacher/primary or consented
  // substitute scope on EVERY join, heartbeat, leave and snapshot.
  // CR-02A: only a qualified actual Sheikh can request a short LiveKit JWT.
  // Every token requires new Better Auth+D1+LessonDO active lease checks.
  // Authorized Sheikh-only mute. The request cannot assert track SID, room,
  // learner identity, or muted:false; LiveKit RoomService lists exact tracks.
  const teacherCorrections=/^\/v1\/teacher\/lessons\/([a-zA-Z0-9-]{1,128})\/corrections$/.exec(path);
  if(teacherCorrections){
    if(request.method!=='GET'&&request.method!=='POST')
      return reply(405,{code:'METHOD_NOT_ALLOWED'},requestId);
    const lessonId=teacherCorrections[1]!;
    const access=await checkTeacherClassroomAccess(env.DB,session.user.id,lessonId);
    if(!access)return reply(404,{code:'NOT_FOUND'},requestId);
    const action=request.method==='GET'?'snapshot' as const:
      parseClientCorrection(await readObject(request));
    if(!action)return reply(400,{code:'INVALID_CORRECTION_COMMAND'},requestId);
    const outcome=await forwardCorrections(env,{lessonId,learnerId:access.learnerId,
      actorSubject:session.user.id,role:'teacher'},action);
    const {status,...body}=outcome;return reply(status,body,requestId);
  }
  const teacherLifecycle=/^\/v1\/teacher\/lessons\/([a-zA-Z0-9-]{1,128})\/(lifecycle|lifecycle-actions)$/.exec(path);
  if(teacherLifecycle){
    const lessonId=teacherLifecycle[1]!,kind=teacherLifecycle[2]!;
    if(request.method!==(kind==='lifecycle'?'GET':'POST'))
      return reply(405,{code:'METHOD_NOT_ALLOWED'},requestId);
    if(kind==='lifecycle'){
      const outcome=await readTeacherLifecycle(env,session.user.id,lessonId);
      const {status,...body}=outcome;return reply(status,body,requestId);
    }
    const action=parseLifecycleAction(await readObject(request));
    if(!action)return reply(400,{code:'INVALID_LESSON_LIFECYCLE_ACTION'},requestId);
    const outcome=await teacherLifecycleAction(env,session.user.id,lessonId,
      action.action,action.operationId);
    const {status,...body}=outcome;return reply(status,body,requestId);
  }
  const teacherMicPolicy=/^\/v1\/teacher\/lessons\/([a-zA-Z0-9-]{1,128})\/microphone-policy$/.exec(path);
  if(teacherMicPolicy){
    if(request.method!=='GET'&&request.method!=='POST')
      return reply(405,{code:'METHOD_NOT_ALLOWED'},requestId);
    const lessonId=teacherMicPolicy[1]!;
    const access=await checkTeacherClassroomAccess(env.DB,session.user.id,lessonId);
    if(!access)return reply(404,{code:'NOT_FOUND'},requestId);
    if(request.method==='POST'){
      const input=await readObject(request);
      if(!input||Object.keys(input).length!==1||input.action!=='release')
        return reply(400,{code:'INVALID_MIC_POLICY_COMMAND'},requestId);
    }
    const result=await forwardVerifiedMicPolicy(env,{lessonId,learnerId:access.learnerId,
      actorSubject:session.user.id,role:'teacher'},
      request.method==='POST'?'release':'snapshot');
    const {status,...body}=result;return reply(status,body,requestId);
  }
  const teacherMute=/^\/v1\/teacher\/lessons\/([a-zA-Z0-9-]{1,128})\/mute-learner-microphone$/.exec(path);
  if(teacherMute){
    if(request.method!=='POST')return reply(405,{code:'METHOD_NOT_ALLOWED'},requestId);
    const input=await readObject(request);
    if(!input||Object.keys(input).length!==0)
      return reply(400,{code:'INVALID_MUTE_REQUEST'},requestId);
    const result=await muteSignedLearnerMicrophone(env,session.user.id,teacherMute[1]!);
    const {status,...body}=result;return reply(status,body,requestId);
  }
  // Dev-only read-only provider API health proof, never LiveKit media.
  // Signed actor, fresh D1 Sheikh grant and matching DO lease are mandatory.
  const teacherProviderCheck=/^\/v1\/teacher\/lessons\/([a-zA-Z0-9-]{1,128})\/livekit-provider-check$/.exec(path);
  if(teacherProviderCheck){
    if(env.NOOR_ENVIRONMENT!=='staging'||env.NOOR_DEV_OPEN!=='true'||
       !/^https:\/\/noor-site-staging\.[a-z0-9-]+\.workers\.dev$/.test(new URL(request.url).origin))
      return reply(404,{code:'NOT_FOUND'},requestId);
    if(request.method!=='POST')return reply(405,{code:'METHOD_NOT_ALLOWED'},requestId);
    const lessonId=teacherProviderCheck[1]!;
    const access=await checkTeacherClassroomAccess(env.DB,session.user.id,lessonId);
    if(!access||!mediaLessonWindow(access,Date.now()))
      return reply(404,{code:'NOT_FOUND'},requestId);
    const input=await readObject(request);
    if(!input||Object.keys(input).length!==0)
      return reply(400,{code:'INVALID_LIVEKIT_PROBE_REQUEST'},requestId);
    const actor={lessonId,learnerId:access.learnerId,
      actorSubject:session.user.id,role:'teacher' as const};
    const lease=await forwardVerifiedPresence(env,actor,'heartbeat');
    if(lease.status!==200)return reply(lease.status,{code:lease.code},requestId);
    const check=await checkLiveKitProvider(env,actor);
    return reply(check.status,{code:check.code},requestId);
  }
  const teacherMedia=/^\/v1\/teacher\/lessons\/([a-zA-Z0-9-]{1,128})\/media-token$/.exec(path);
  if(teacherMedia){
    if(request.method!=='POST')return reply(405,{code:'METHOD_NOT_ALLOWED'},requestId);
    const lessonId=teacherMedia[1]!;
    const access=await checkTeacherClassroomAccess(env.DB,session.user.id,lessonId);
    if(!access)return reply(404,{code:'NOT_FOUND'},requestId);
    const body=await readObject(request);
    if(!body||Object.keys(body).length!==0)
      return reply(400,{code:'INVALID_MEDIA_TOKEN_REQUEST'},requestId);
    const outcome=await createMediaToken(env,{lessonId,learnerId:access.learnerId,
      actorSubject:session.user.id,role:'teacher'},access);
    const {status,...safe}=outcome;return reply(status,safe,requestId);
  }
  const teacherInk=/^\/v1\/teacher\/lessons\/([a-zA-Z0-9-]{1,128})\/quran-ink$/.exec(path);
  if(teacherInk){
    if(request.method!=='GET'&&request.method!=='POST')
      return reply(405,{code:'METHOD_NOT_ALLOWED'},requestId);
    const lessonId=teacherInk[1]!;
    const access=await checkTeacherClassroomAccess(env.DB,session.user.id,lessonId);
    if(!access)return reply(404,{code:'NOT_FOUND'},requestId);
    const canWrite=env.NOOR_CUMULATIVE_INK_ENABLED==='true'&&access.status==='live';
    if(request.method==='POST'&&!canWrite)
      return reply(access.status==='live'?503:409,
        {code:access.status==='live'?'CUMULATIVE_INK_DISABLED':'LESSON_NOT_LIVE'},requestId);
    const params=new URL(request.url).searchParams;
    const action=request.method==='GET'?
      (params.size===1?parseClientInk({action:'snapshot',
        page:Number(params.get('page'))},'teacher'):null):
      parseClientInk(await readObject(request),'teacher');
    if(!action||(request.method==='POST'&&action.action==='snapshot'))
      return reply(400,{code:'INVALID_INK_COMMAND'},requestId);
    const outcome=await forwardVerifiedInk(env,{lessonId,learnerId:access.learnerId,
      actorSubject:session.user.id,role:'teacher'},action);
    const {status,...body}=outcome;
    return reply(status,{...body,...(request.method==='GET'?{canWrite}:{})},requestId);
  }
  const teacherQuran=/^\/v1\/teacher\/lessons\/([a-zA-Z0-9-]{1,128})\/quran-page$/.exec(path);
  if(teacherQuran){
    if(request.method!=='GET'&&request.method!=='POST')
      return reply(405,{code:'METHOD_NOT_ALLOWED'},requestId);
    const lessonId=teacherQuran[1]!;
    const access=await checkTeacherClassroomAccess(env.DB,session.user.id,lessonId);
    if(!access)return reply(404,{code:'NOT_FOUND'},requestId);
    const action=request.method==='GET'?{action:'snapshot' as const}:
      parsePageAction(await readObject(request),'teacher');
    if(!action)return reply(400,{code:'INVALID_QURAN_PAGE_COMMAND'},requestId);
    const outcome=await forwardVerifiedPage(env,{lessonId,learnerId:access.learnerId,
      actorSubject:session.user.id,role:'teacher'},action);
    const {status,...body}=outcome;return reply(status,body,requestId);
  }
  const teacherPresence=/^\/v1\/teacher\/lessons\/([a-zA-Z0-9-]{1,128})\/(presence|presence-actions)$/.exec(path);
  if(teacherPresence){
    const lessonId=teacherPresence[1]!,mode=teacherPresence[2]!;
    if(request.method!==(mode==='presence'?'GET':'POST'))
      return reply(405,{code:'METHOD_NOT_ALLOWED'},requestId);
    const access=await checkTeacherClassroomAccess(env.DB,session.user.id,lessonId);
    if(!access)return reply(404,{code:'NOT_FOUND'},requestId);
    const action=mode==='presence'?'snapshot':parseClientPresenceAction(await readObject(request));
    if(!action)return reply(400,{code:'INVALID_ROOM_ACTION'},requestId);
    const outcome=await forwardVerifiedPresence(env,{lessonId,learnerId:access.learnerId,
      role:'teacher',actorSubject:session.user.id},action);
    const {status,...body}=outcome;return reply(status,body,requestId);
  }
  const teacherAccessMatch = /^\/v1\/teacher\/lessons\/([a-zA-Z0-9-]{1,128})\/access$/.exec(path);
  if (teacherAccessMatch && request.method === 'GET') {
    const access = await checkTeacherClassroomAccess(env.DB, session.user.id, teacherAccessMatch[1]!);
    return access
      ? reply(200, { access, roomConnected: false, code: 'CLASSROOM_NOT_CONNECTED' }, requestId)
      : reply(404, { code: 'NOT_FOUND' }, requestId);
  }
  if (path === '/v1/teacher/lessons' && request.method === 'GET') {
    // Teacher role is resolved from the VERIFIED Better Auth identity in D1.
    const lessons = await listVerifiedTeacherLessons(env.DB, session.user.id);
    return lessons === null
      ? reply(403, { code: 'TEACHER_ACCESS_DENIED' }, requestId)
      : reply(200, { lessons }, requestId);
  }
  const teacherAttendance=/^\/v1\/teacher\/lessons\/([a-zA-Z0-9-]{1,128})\/attendance-report$/.exec(path);
  if(teacherAttendance){
    if(request.method!=='POST')return reply(405,{code:'METHOD_NOT_ALLOWED'},requestId);
    const schema=await env.DB.prepare(
      "SELECT version FROM noor_schema_meta WHERE component='attendance_cases'"
    ).first<{version:number}>();
    if(schema?.version!==1)return reply(503,{code:'ATTENDANCE_SCHEMA_NOT_READY'},requestId);
    const result=await reportAttendanceIncident(env,session.user.id,
      teacherAttendance[1]!,await readObject(request));
    const {status,...body}=result;return reply(status,body,requestId);
  }
  if(path==='/v1/teacher/attendance-cases'){
    if(request.method!=='GET')return reply(405,{code:'METHOD_NOT_ALLOWED'},requestId);
    const schema=await env.DB.prepare(
      "SELECT version FROM noor_schema_meta WHERE component='attendance_cases'"
    ).first<{version:number}>();
    if(schema?.version!==1)return reply(503,{code:'ATTENDANCE_SCHEMA_NOT_READY'},requestId);
    const result=await listTeacherAttendance(env.DB,session.user.id);
    const {status,...body}=result;return reply(status,body,requestId);
  }
  if(path==='/v1/teacher/inbox'||path==='/v1/teacher/inbox-actions'){
    const list=path==='/v1/teacher/inbox';
    if(request.method!==(list?'GET':'POST'))
      return reply(405,{code:'METHOD_NOT_ALLOWED'},requestId);
    const schema=await env.DB.prepare(
      "SELECT version FROM noor_schema_meta WHERE component='inbox'"
    ).first<{version:number}>();
    if(schema?.version!==1)return reply(503,{code:'INBOX_SCHEMA_NOT_READY'},requestId);
    const result=list
      ?await listInbox(env.DB,session.user.id,'teacher',null)
      :await changeInboxRead(env.DB,session.user.id,'teacher',null,await readObject(request));
    const {status,...body}=result;return reply(status,body,requestId);
  }
  if (path === '/v1/teacher/learners') {
    if (request.method !== 'GET') return reply(405, { code: 'METHOD_NOT_ALLOWED' }, requestId);
    // The teacher is obtained from the verified Better Auth subject, never a query/header.
    const learners = await listVerifiedTeacherLearners(env.DB, session.user.id);
    return learners === null
      ? reply(403, { code: 'TEACHER_ACCESS_DENIED' }, requestId)
      : reply(200, { learners }, requestId);
  }
  const owner = await ownerAccount(env.DB, session.user.id);
  if (!owner) return reply(403, { code: 'ACCOUNT_UNAVAILABLE' }, requestId);
  if (path === '/api/auth/session' && request.method === 'GET')
    return reply(200, { user: { id: session.user.id, name: session.user.name },
      phoneVerified: session.user.phoneNumberVerified === true }, requestId);
  return profiles(env, env.DB, owner.id, session.user.id, request, path, requestId);
}

