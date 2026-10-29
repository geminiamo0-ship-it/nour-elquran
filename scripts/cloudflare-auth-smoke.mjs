import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
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
assert.equal((await call('/v1/learners/'+learner,{cookie:cookieA})).response.status,200);
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

