import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {setTimeout as pause} from 'node:timers/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
const base = 'http://127.0.0.1:8795';
const password = 'Synthetic-Test-Password-2026!';
const state = process.env.NOOR_AUTH_STATE;
assert(state, 'Isolated local D1 persistence required');
const worker = path.resolve('workers/api');
function cookieHeader(response) {
  const cookies = response.headers.getSetCookie();
  assert(cookies.length > 0, 'Expected session cookies');
  assert(cookies.some(x => /httponly/i.test(x)), 'Session cookie must be HttpOnly');
  assert(cookies.some(x => /samesite=lax/i.test(x)), 'Session cookie must be SameSite Lax');
  return cookies.map(x => x.split(';')[0]).join('; ');
}
async function call(route, { method = 'GET', body, cookie, origin = base, headers = {} } = {}) {
  const response = await fetch(base + route, { method, headers: {
    origin, ...(body ? { 'content-type':'application/json' } : {}), ...(cookie ? { cookie } : {}), ...headers,
  }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json();
  assert.equal(response.headers.get('cache-control'), 'no-store');
  return { response, data };
}
function sql(statement) {
  execFileSync('npx',['--yes','wrangler@4.45.0','d1','execute','noor-core-local','--local','--persist-to',state,'--command',statement],
    { cwd: worker, stdio: 'pipe', env: { ...process.env, WRANGLER_SEND_METRICS:'false',CI:'true' } });
}
const ready = await call('/ready');
assert.equal(ready.response.status, 200, JSON.stringify(ready.data));
assert.equal(ready.data.authentication, 'configured');

const a = await call('/api/auth/register',{method:'POST',body:{name:'Fixture Owner A',phoneNumber:'+12025550101',password}});
assert.equal(a.response.status, 200, JSON.stringify(a.data));
assert.equal(a.data.phoneVerified, false, 'A password does not verify phone ownership');
let cookieA = cookieHeader(a.response);
const b = await call('/api/auth/register',{method:'POST',body:{name:'Fixture Owner B',phoneNumber:'+12025550102',password}});
assert.equal(b.response.status, 200, JSON.stringify(b.data));
const cookieB = cookieHeader(b.response);
const login = await call('/api/auth/login',{method:'POST',body:{phoneNumber:'+12025550101',password}});
assert.equal(login.response.status,200,JSON.stringify(login.data));
cookieA = cookieHeader(login.response);
const session = await call('/api/auth/session',{cookie:cookieA});
assert.equal(session.response.status,200);
assert.equal(session.data.user.id,a.data.user.id);
assert.equal(session.data.phoneVerified,false);
assert.equal(session.data.user.email,undefined);
assert.equal(session.data.token,undefined);
assert.equal((await call('/api/auth/session')).response.status,401);
const badLogin = await call('/api/auth/login',{method:'POST',body:{phoneNumber:'+12025550101',password:'wrong-password'}});
assert.equal(badLogin.response.status,401,JSON.stringify(badLogin.data));
assert.equal(badLogin.response.headers.getSetCookie().length,0);

const first = await call('/v1/me/learners',{method:'POST',cookie:cookieA,body:{name:'Fixture Learner A',learnerType:'child'}});
assert.equal(first.response.status,201,JSON.stringify(first.data));
const learner = first.data.learner.id;
// #157: exercise the actual Better Auth / Worker / D1 profile endpoint, not only SQL.
assert.equal(first.data.learner.revision,1);
const profilePath='/v1/me/learners/'+learner+'/profile-actions';
const profileRename={action:'rename',operationId:randomUUID(),expectedRevision:1,name:'Fixture Learner A Revised'};
assert.equal((await call(profilePath,{method:'POST',cookie:cookieB,body:profileRename})).response.status,404);
assert.equal((await call(profilePath,{method:'POST',cookie:cookieA,origin:'https://attacker.invalid',body:profileRename})).response.status,403);
assert.equal((await call(profilePath,{method:'POST',body:profileRename})).response.status,401);
assert.equal((await call(profilePath,{method:'POST',cookie:cookieA,body:{...profileRename,accountId:'forged'}})).response.status,400);
const renamed=await call(profilePath,{method:'POST',cookie:cookieA,body:profileRename});
assert.equal(renamed.response.status,200,JSON.stringify(renamed.data));
assert.equal(renamed.data.revision,2);
const replayRename=await call(profilePath,{method:'POST',cookie:cookieA,body:profileRename});
assert.equal(replayRename.response.status,200);
assert.equal(replayRename.data.code,'OPERATION_ALREADY_APPLIED');
const staleRename=await call(profilePath,{method:'POST',cookie:cookieA,
 body:{...profileRename,operationId:randomUUID(),name:'Wrong stale update'}});
assert.equal(staleRename.response.status,409);
const checkedProfile=await call('/v1/learners/'+learner,{cookie:cookieA});
assert.equal(checkedProfile.data.learner.name,'Fixture Learner A Revised');
assert.equal(checkedProfile.data.learner.revision,2);
console.log('Native learner profile: owner rename/CAS, idempotent replay, foreign owner denial, CSRF and refreshed detail PASS');
assert.equal((await call('/v1/learners/'+learner,{cookie:cookieA})).response.status,200);

// Private Quran P0 smoke uses a synthetic, throwaway edition + anchor in ONLY
// the isolated local D1; never fabricate hashes or ayah mappings in real D1.
const mushafPath='/v1/me/learners/'+learner+'/mushaf';
assert.equal((await call(mushafPath+'?page=1',{cookie:cookieA})).data.items.length,0);
assert.equal((await call(mushafPath+'?page=1',{cookie:cookieB})).response.status,404);
sql("INSERT INTO quran_editions(id,riwayah,page_count,manifest_sha256) "+
    "VALUES('hafs-kfqc:v1.1.1','hafs',604,'"+'c'.repeat(64)+"')");
sql("INSERT INTO quran_ayah_anchors(edition_id,surah,ayah,page,word_count) "+
    "VALUES('hafs-kfqc:v1.1.1',1,1,1,7)");
const mushafOp=(itemId,kind,action='put',expectedVersion=0,payload={},page=1,operationId=randomUUID())=>({
 itemId,kind,action,expectedVersion,payload,page,operationId,
});
const pen=mushafOp('stroke-1','pen','put',0,{
 color:'#f6cd46',width:3,points:[{x:12,y:13},{x:14,y:15}],
});
assert.equal((await call(mushafPath,{method:'POST',cookie:cookieB,body:pen})).response.status,404);
assert.equal((await call(mushafPath,{method:'POST',cookie:cookieA,origin:'https://attacker.invalid',body:pen})).response.status,403);
const penCreated=await call(mushafPath,{method:'POST',cookie:cookieA,body:pen});
assert.equal(penCreated.response.status,201,JSON.stringify(penCreated.data));
assert.equal(penCreated.data.item.version,1);
assert.equal((await call(mushafPath,{method:'POST',cookie:cookieA,body:pen})).data.code,'OPERATION_ALREADY_APPLIED');
assert.equal((await call(mushafPath,{method:'POST',cookie:cookieA,body:{...pen,action:'hide',payload:{},expectedVersion:1}})).response.status,409);
const noCAS=await call(mushafPath,{method:'POST',cookie:cookieA,body:{...pen,operationId:randomUUID()}});
assert.equal(noCAS.response.status,409);
const marker=mushafOp('marker-1','marker','put',0,{
 color:'#86c5a8',width:16,points:[{x:100,y:200},{x:150,y:250}],
});
assert.equal((await call(mushafPath,{method:'POST',cookie:cookieA,body:marker})).response.status,201);
const note=mushafOp('note-1-1-0','note','put',0,{
 color:'#aabbcc',text:'Synthetic learner-only note',target:{surah:1,ayah:1,wordIndex:null},
});
assert.equal((await call(mushafPath,{method:'POST',cookie:cookieA,body:note})).response.status,201);
const wrongAnchor=mushafOp('note-wrong','note','put',0,{
 color:'#aabbcc',text:'Forged unverified page',target:{surah:1,ayah:1,wordIndex:null},
},2);
assert.equal((await call(mushafPath,{method:'POST',cookie:cookieA,body:wrongAnchor})).response.status,409);
const highlight=mushafOp('highlight-1-1-0','highlight','put',0,{
 color:'#ffff00',target:{surah:1,ayah:1,wordIndex:null},
});
assert.equal((await call(mushafPath,{method:'POST',cookie:cookieA,body:highlight})).response.status,201);
const bookmark=mushafOp('bookmark-1','bookmark');
assert.equal((await call(mushafPath,{method:'POST',cookie:cookieA,body:bookmark})).response.status,201);
assert.equal((await call(mushafPath,{method:'POST',cookie:cookieA,
 body:mushafOp('position','position')})).response.status,201);
// Regression #146: a hidden stable-ID note/bookmark must retain CAS version after reload.
const noteHidden=await call(mushafPath,{method:'POST',cookie:cookieA,
 body:mushafOp('note-1-1-0','note','hide',1)});
assert.equal(noteHidden.response.status,201,JSON.stringify(noteHidden.data));
assert.equal(noteHidden.data.item.version,2);
const indexWithHiddenNote=await call(mushafPath+'?index=1',{cookie:cookieA});
assert.equal(indexWithHiddenNote.data.items.find(x=>x.itemId==='note-1-1-0')?.visible,false);
assert.equal(indexWithHiddenNote.data.items.find(x=>x.itemId==='note-1-1-0')?.version,2);
const noteRestored=await call(mushafPath,{method:'POST',cookie:cookieA,
 body:mushafOp('note-1-1-0','note','put',2,note.payload)});
assert.equal(noteRestored.response.status,201,JSON.stringify(noteRestored.data));
assert.equal(noteRestored.data.item.visible,true);
const bookmarkHidden=await call(mushafPath,{method:'POST',cookie:cookieA,
 body:mushafOp('bookmark-1','bookmark','hide',1)});
assert.equal(bookmarkHidden.response.status,201);
const hiddenBookmarkIndex=await call(mushafPath+'?index=1',{cookie:cookieA});
assert.equal(hiddenBookmarkIndex.data.items.find(x=>x.itemId==='bookmark-1')?.version,2);
assert.equal(hiddenBookmarkIndex.data.items.find(x=>x.itemId==='bookmark-1')?.visible,false);
const bookmarkRestored=await call(mushafPath,{method:'POST',cookie:cookieA,
 body:mushafOp('bookmark-1','bookmark','put',2)});
assert.equal(bookmarkRestored.response.status,201,JSON.stringify(bookmarkRestored.data));
assert.equal(bookmarkRestored.data.item.visible,true);
const pageBeforeHide=await call(mushafPath+'?page=1',{cookie:cookieA});
assert.equal(pageBeforeHide.data.items.filter(x=>x.kind==='pen'||x.kind==='marker').length,2);
assert.equal((await call(mushafPath+'?index=1',{cookie:cookieA})).data.items.length,4);
const hide=mushafOp('stroke-1','pen','hide',1);
assert.equal((await call(mushafPath,{method:'POST',cookie:cookieA,body:hide})).data.item.visible,false);
assert.equal((await call(mushafPath+'?page=1',{cookie:cookieA})).data.items.some(x=>x.itemId==='stroke-1'),false);
const restore=mushafOp('stroke-1','pen','restore',2);
assert.equal((await call(mushafPath,{method:'POST',cookie:cookieA,body:restore})).data.item.version,3);
assert.equal((await call(mushafPath+'?page=1',{cookie:cookieA})).data.items.some(x=>x.itemId==='stroke-1'),true);
assert.equal((await call(mushafPath+'?page=0',{cookie:cookieA})).response.status,400);
assert.equal((await call(mushafPath,{method:'POST',cookie:cookieA,
 body:{...note,operationId:randomUUID(),actorAuthSubject:a.data.user.id}})).response.status,400);
console.log('Native private Quran: verified learner save/reload, pen, marker, note anchor, bookmark, position, tombstone, CAS, replay, CSRF and cross-owner denial passed');

assert.equal((await call('/v1/learners/'+learner,{cookie:cookieB,headers:{'x-account-id':'forged-owner-a'}})).response.status,404);
assert.equal((await call('/v1/learners/'+learner,{headers:{authorization:'Bearer forged','x-user-id':a.data.user.id}})).response.status,401);
assert.equal((await call('/v1/me/learners',{cookie:'better-auth.session_token=forged'})).response.status,401);
assert.equal((await call('/v1/me/learners',{cookie:cookieB})).data.learners.length,0);
assert.equal((await call('/v1/me/learners',{method:'POST',cookie:cookieB,body:{name:'Bad owner injection',learnerType:'child',accountId:'other'}})).response.status,400);
assert.equal((await call('/v1/me/learners',{method:'POST',cookie:cookieA,origin:'https://attacker.invalid',body:{name:'CSRF',learnerType:'child'}})).response.status,403);
for(let i=1;i<8;i++) {
 const made = await call('/v1/me/learners',{method:'POST',cookie:cookieA,body:{name:'Fixture '+i,learnerType:'child'}});
 assert.equal(made.response.status,201,JSON.stringify(made.data));
}
assert.equal((await call('/v1/me/learners',{cookie:cookieA})).data.learners.length,8);
assert.equal((await call('/v1/me/learners',{method:'POST',cookie:cookieA,body:{name:'Ninth',learnerType:'child'}})).response.status,409);
assert.equal((await call('/internal-auth/sign-up/email',{method:'POST',body:{email:'not-allowed@example.invalid',password}})).response.status,404);

// B2: native D1/Worker authorizations, with deliberately synthetic identities.
const teacherActor=a.data.user.id, teacherSubject=b.data.user.id;
assert.match(teacherActor,/^[a-zA-Z0-9_-]+$/);
assert.match(teacherSubject,/^[a-zA-Z0-9_-]+$/);
const teacherCommand=(action,operationId=randomUUID())=>({
  targetUserId:teacherSubject,action,reason:'Synthetic qualified staff decision',operationId,
});
const beforeGrant=await call('/v1/staff/teacher-actions',{
  method:'POST',cookie:cookieA,body:teacherCommand('provision'),
});
assert.equal(beforeGrant.response.status,403,'No bootstrap roles via normal account session');
const outsider=await call('/v1/staff/teacher-actions',{
  method:'POST',cookie:cookieB,body:teacherCommand('provision'),
});
assert.equal(outsider.response.status,403);
sql("UPDATE auth_users SET phone_number_verified=1 WHERE id IN ('"+teacherActor+"','"+teacherSubject+"')");
sql("INSERT INTO staff_grants(auth_subject,permission) VALUES('"+teacherActor+"','roles.manage')");
assert.equal((await call('/v1/teacher/learners',{cookie:cookieB})).response.status,403);
const provisionBody=teacherCommand('provision');
const provision=await call('/v1/staff/teacher-actions',{
  method:'POST',cookie:cookieA,body:provisionBody,
});
assert.equal(provision.response.status,201,JSON.stringify(provision.data));
assert.equal(provision.data.state,'disabled');
assert.equal(provision.data.qualified,false);
assert.equal((await call('/v1/teacher/learners',{cookie:cookieB})).response.status,403);
const sameOp=await call('/v1/staff/teacher-actions',{method:'POST',cookie:cookieA,body:provisionBody});
assert.equal(sameOp.response.status,200);
assert.equal(sameOp.data.code,'OPERATION_ALREADY_APPLIED');
const conflictOp=await call('/v1/staff/teacher-actions',{
  method:'POST',cookie:cookieA,body:{...provisionBody,action:'activate'},
});
assert.equal(conflictOp.response.status,409);
const noQualification=await call('/v1/staff/teacher-actions',{
  method:'POST',cookie:cookieA,body:teacherCommand('activate'),
});
assert.equal(noQualification.response.status,409);
const qualified=await call('/v1/staff/teacher-actions',{
  method:'POST',cookie:cookieA,body:teacherCommand('qualify'),
});
assert.equal(qualified.response.status,200,JSON.stringify(qualified.data));
assert.equal(qualified.data.state,'disabled');
const activated=await call('/v1/staff/teacher-actions',{
  method:'POST',cookie:cookieA,body:teacherCommand('activate'),
});
assert.equal(activated.response.status,200,JSON.stringify(activated.data));
assert.equal(activated.data.state,'active');
assert.deepEqual((await call('/v1/teacher/learners',{cookie:cookieB})).data.learners,[]);
assert.deepEqual((await call('/v1/teacher/lessons',{cookie:cookieB})).data.lessons,[]);
// B3: synthetic staff creates an actual primary assignment and a 40m booked lesson.
// The read-only teacher endpoints must immediately reflect only this family's data.
const schedule=(body,cookie=cookieA,origin=base)=>call('/v1/staff/schedule-actions',{
  method:'POST',cookie,origin,body,
});
const learnerBookingStart=Date.now()+8*60*60*1000;
const assignmentRequest={
  action:'assign',operationId:randomUUID(),reason:'Synthetic teaching assignment acceptance',
  learnerId:learner,teacherId:provision.data.teacherId,
  startsAtMs:Date.now()+2000,endsAtMs:Date.now()+30*24*60*60*1000,
};
assert.equal((await schedule(assignmentRequest,cookieB)).response.status,403);
assert.equal((await schedule({...assignmentRequest,role:'admin'})).response.status,400);
const assignmentCreated=await schedule(assignmentRequest);
assert.equal(assignmentCreated.response.status,201,JSON.stringify(assignmentCreated.data));
assert.equal((await schedule(assignmentRequest)).data.code,'OPERATION_ALREADY_APPLIED');
// The primary roster is deliberately time-scoped; wait until the new assignment begins.
await pause(2300);
const assignedRoster=await call('/v1/teacher/learners',{cookie:cookieB});
assert.equal(assignedRoster.response.status,200,JSON.stringify(assignedRoster.data));
assert.equal(assignedRoster.data.learners.length,1);
assert.equal(assignedRoster.data.learners[0].id,learner);
// #162: current primary teacher authors a versioned plan; verified owner sees it.
const planTeacher='/v1/teacher/learners/'+learner+'/plan';
const planOwner='/v1/me/learners/'+learner+'/plan';
const planWrite='/v1/teacher/learners/'+learner+'/plan-actions';
const emptyPlan=await call(planTeacher,{cookie:cookieB});
assert.equal(emptyPlan.response.status,200);
assert.equal(emptyPlan.data.plan,null);
const planCommand={operationId:randomUUID(),expectedRevision:0,level:'beginner',
 nextWird:'Synthetic weekly Quran section',revisionWird:'Synthetic review section',focus:'Synthetic pronunciation'};
assert.equal((await call(planWrite,{method:'POST',cookie:cookieA,body:planCommand})).response.status,404,
  'Staff account is not a current assigned primary teacher');
assert.equal((await call(planOwner,{cookie:cookieB})).response.status,404,
  'Teacher account cannot read household owner data');
assert.equal((await call(planWrite,{method:'POST',cookie:cookieB,body:{...planCommand,actor:'forged'}})).response.status,400);
const savedPlan=await call(planWrite,{method:'POST',cookie:cookieB,body:planCommand});
assert.equal(savedPlan.response.status,200,JSON.stringify(savedPlan.data));
assert.equal(savedPlan.data.revision,1);
assert.equal((await call(planWrite,{method:'POST',cookie:cookieB,body:planCommand})).data.code,'PLAN_ALREADY_SAVED');
assert.equal((await call(planWrite,{method:'POST',cookie:cookieB,body:{
 ...planCommand,operationId:randomUUID(),nextWird:'Stale write'}})).response.status,409);
const ownerPlan=await call(planOwner,{cookie:cookieA});
assert.equal(ownerPlan.response.status,200);
assert.equal(ownerPlan.data.plan.nextWird,planCommand.nextWird);
assert.equal(ownerPlan.data.plan.revision,1);
assert.equal((await call('/v1/me/learners/invalid-other-owner/plan',{cookie:cookieA})).response.status,404);

 // #173: Worker + session + D1 publish to real owner Training, no synthetic browser.
const assignmentEdition='hafs-kfqc:v1.1.1'; // canonical 1:1 fixture already seeded earlier
const teacherTaskPath='/v1/teacher/learners/'+learner+'/assignments';
const ownerTaskPath='/v1/me/learners/'+learner+'/assignments';
const emptyTasks=await call(ownerTaskPath,{cookie:cookieA});
assert.equal(emptyTasks.response.status,200);
assert.deepEqual(emptyTasks.data.assignments,[]);
assert.equal((await call(ownerTaskPath,{cookie:cookieB})).response.status,404);
const catalog=await call('/v1/teacher/assignment-catalog',{cookie:cookieB});
assert.equal(catalog.response.status,200,JSON.stringify(catalog.data));
assert(catalog.data.surahs.some(v=>v.editionId===assignmentEdition&&v.surah===1&&v.ayahCount===1));
assert.equal((await call('/v1/teacher/assignment-catalog',{cookie:cookieA})).response.status,403);
const publish={operationId:randomUUID(),kind:'memorization',editionId:assignmentEdition,
 surah:1,fromAyah:1,toAyah:1,dueAtMs:Date.now()+86400000,instructions:'Synthetic assigned memorization'};
assert.equal((await call(teacherTaskPath,{method:'POST',cookie:cookieA,body:publish})).response.status,404);
assert.equal((await call(teacherTaskPath,{method:'POST',cookie:cookieB,body:{...publish,teacherId:'forged'}})).response.status,400);
assert.equal((await call(teacherTaskPath,{method:'POST',cookie:cookieB,origin:'https://evil.invalid',body:publish})).response.status,403);
assert.equal((await call(teacherTaskPath,{method:'POST',cookie:cookieB,body:{...publish,operationId:randomUUID(),toAyah:70}})).response.status,400);
const published=await call(teacherTaskPath,{method:'POST',cookie:cookieB,body:publish});
assert.equal(published.response.status,201,JSON.stringify(published.data));
assert.match(published.data.assignmentId,/^[0-9a-f-]{36}$/i);
const duplicate=await call(teacherTaskPath,{method:'POST',cookie:cookieB,body:publish});
assert.equal(duplicate.response.status,200);
assert.equal(duplicate.data.code,'ASSIGNMENT_ALREADY_PUBLISHED');
assert.equal(duplicate.data.assignmentId,published.data.assignmentId);
assert.equal((await call(teacherTaskPath,{method:'POST',cookie:cookieB,
  body:{...publish,instructions:'Tampered replay'}})).response.status,409);
const tasks=await call(ownerTaskPath,{cookie:cookieA});
assert.equal(tasks.response.status,200);
assert.equal(tasks.data.assignments.length,1);
assert.equal(tasks.data.assignments[0].id,published.data.assignmentId);
assert.equal(tasks.data.assignments[0].toAyah,1);
assert.equal((await call(teacherTaskPath,{cookie:cookieB})).data.assignments.length,1);
console.log('Native assignment publish: verified Quran anchors, current teacher, owner readback, owner isolation, replay and CSRF PASS');

console.log('Native academic plan: assigned qualified teacher CAS/write/replay, owner read, foreign 404, stale 409 PASS');

const bookRequest={action:'book',operationId:randomUUID(),
  reason:'Synthetic forty minute lesson booking',learnerId:learner,
  teacherId:provision.data.teacherId,startsAtMs:learnerBookingStart,kind:'standard'};
const lessonCreated=await schedule(bookRequest);
assert.equal(lessonCreated.response.status,201,JSON.stringify(lessonCreated.data));
const bookingRepeat=await schedule(bookRequest);
assert.equal(bookingRepeat.data.code,'OPERATION_ALREADY_APPLIED');
const overlapping=await schedule({...bookRequest,operationId:randomUUID(),startsAtMs:learnerBookingStart+1000});
assert.equal(overlapping.response.status,409);
const teacherSchedule=await call('/v1/teacher/lessons',{cookie:cookieB});
assert.equal(teacherSchedule.response.status,200);
assert.equal(teacherSchedule.data.lessons.length,1);
assert.equal(teacherSchedule.data.lessons[0].id,lessonCreated.data.resourceId);
assert.equal(teacherSchedule.data.lessons[0].endsAtMs-teacherSchedule.data.lessons[0].startsAtMs,2400000);
const learnerTimetable=await call('/v1/me/learners/'+learner+'/lessons',{cookie:cookieA});
assert.equal(learnerTimetable.response.status,200);
assert.equal(learnerTimetable.data.lessons[0].id,lessonCreated.data.resourceId);
const unsafeArchive=await call(profilePath,{method:'POST',cookie:cookieA,body:{
  action:'archive',operationId:randomUUID(),expectedRevision:2,
}});
assert.equal(unsafeArchive.response.status,409,'Cannot archive a student with a scheduled lesson');
assert.equal(unsafeArchive.data.code,'PROFILE_OPEN_LESSONS');
assert.equal((await call('/v1/learners/'+learner,{cookie:cookieA})).data.learner.revision,2);

assert.equal((await call('/v1/me/learners/'+learner+'/lessons',{cookie:cookieB})).response.status,404);
const prematureRevoke=await schedule({action:'revoke',operationId:randomUUID(),
  reason:'Synthetic schedule reallocation',resourceId:assignmentCreated.data.resourceId});
assert.equal(prematureRevoke.response.status,409);
assert.equal((await schedule({action:'cancel',operationId:randomUUID(),
  reason:'Synthetic booking cancellation',resourceId:lessonCreated.data.resourceId},
  cookieA,'https://attacker.invalid')).response.status,403);
const cancelled=await schedule({action:'cancel',operationId:randomUUID(),
  reason:'Synthetic booking cancellation',resourceId:lessonCreated.data.resourceId});
assert.equal(cancelled.response.status,200,JSON.stringify(cancelled.data));
const revoked=await schedule({action:'revoke',operationId:randomUUID(),
  reason:'Synthetic assignment revocation',resourceId:assignmentCreated.data.resourceId});
assert.equal(revoked.response.status,200,JSON.stringify(revoked.data));
assert.deepEqual((await call('/v1/teacher/learners',{cookie:cookieB})).data.learners,[]);
console.log('Native staff scheduling: assignment, teacher roster, booking, 40m, learner timetable, conflict, cancellation, revocation, no forged role passed');

const unauthorizedMutation=await call('/v1/staff/teacher-actions',{
  method:'POST',cookie:cookieB,body:teacherCommand('suspend'),
});
assert.equal(unauthorizedMutation.response.status,403);
const badOrigin=await call('/v1/staff/teacher-actions',{
  method:'POST',cookie:cookieA,origin:'https://attacker.invalid',body:teacherCommand('suspend'),
});
assert.equal(badOrigin.response.status,403);
const suspension=await call('/v1/staff/teacher-actions',{
  method:'POST',cookie:cookieA,body:teacherCommand('suspend'),
});
assert.equal(suspension.response.status,200,JSON.stringify(suspension.data));
assert.equal((await call('/v1/teacher/learners',{cookie:cookieB})).response.status,403);
assert.equal((await call(planWrite,{method:'POST',cookie:cookieB,body:planCommand})).response.status,404,
  'Revoked teacher must not replay a previously saved academic plan');
sql("UPDATE staff_grants SET revoked_at_ms=1000 WHERE auth_subject='"+teacherActor+"'");
const afterRevocation=await call('/v1/staff/teacher-actions',{
  method:'POST',cookie:cookieA,body:teacherCommand('activate'),
});
assert.equal(afterRevocation.response.status,403);
console.log('Native staff teacher role audit: unauthorized, verified, provision, qualify, activate, replay, suspend and revocation passed');

const logout = await call('/api/auth/logout',{method:'POST',cookie:cookieA});
assert.equal(logout.response.status,200);
assert.equal((await call('/v1/me/learners',{cookie:cookieA})).response.status,401,'Revoked cookie must fail immediately');
const again = await call('/api/auth/login',{method:'POST',body:{phoneNumber:'+12025550101',password}});
assert.equal(again.response.status,200,JSON.stringify(again.data));
cookieA = cookieHeader(again.response);
// Each request constructs a fresh library instance; the limit must persist in D1.
for (let i=0; i<2; i++) {
  const denied = await call('/api/auth/login',{method:'POST',body:{phoneNumber:'+12025550101',password:'wrong-password'}});
  assert.equal(denied.response.status,401,JSON.stringify(denied.data));
}
const limited = await call('/api/auth/login',{method:'POST',body:{phoneNumber:'+12025550101',password},
  headers:{'x-forwarded-for':'203.0.113.99','x-real-ip':'203.0.113.98'}});
assert.equal(limited.response.status,429,JSON.stringify(limited.data));
assert.equal(limited.data.code,'RATE_LIMITED');
assert.equal(limited.response.headers.getSetCookie().length,0);
const id = a.data.user.id;
assert.match(id,/^[a-zA-Z0-9_-]+$/);
sql("UPDATE accounts SET status='disabled' WHERE auth_subject='"+id+"'");
assert.equal((await call('/v1/me/learners',{cookie:cookieA})).response.status,403);
sql("UPDATE accounts SET status='active' WHERE auth_subject='"+id+"'");
sql("UPDATE auth_sessions SET expires_at=0 WHERE user_id='"+id+"'");
assert.equal((await call('/v1/me/learners',{cookie:cookieA})).response.status,401,'Expired session must not be cached');
console.log('Native Better Auth/D1: signup, phone login, owner isolation, profile/credential limits, CSRF, logout, disabled account and expiry passed');

