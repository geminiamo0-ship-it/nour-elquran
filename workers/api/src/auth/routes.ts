import type { CoreDatabase, Env } from '../bindings.ts';
import { reply } from '../responses.ts';
import { createAuth } from './config.ts';
import { authSettings } from './settings.ts';
import { ownerAccount } from './accounts.ts';
import { getOwnedLearner, listOwnedLearners } from '../owner-learners.ts';
import { listOwnedLearnerLessons, listVerifiedTeacherLessons } from '../lesson-calendar.ts';
import { listVerifiedTeacherLearners } from '../teacher-roster.ts';
import { canManageTeachers, issueTeacherRoleAction, parseTeacherAction } from '../staff-teachers.ts';
import {executeStaffSchedule,parseScheduleCommand} from '../staff-scheduling.ts';
import { checkTeacherClassroomAccess, checkOwnedLearnerClassroomAccess } from '../classroom-access.ts';
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

async function profiles(db: CoreDatabase, accountId: string, authSubject: string, request: Request, path: string, requestId: string) {
  if (path === '/v1/me/learners' && request.method === 'GET') {
    const learners = await listOwnedLearners(db, { authSubject });
    return reply(200, { learners: learners.map(row => ({ id: row.id, name: row.displayName, learnerType: row.learnerType })) }, requestId);
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
    return reply(201, { learner: { id, name: input.name.trim(), learnerType: input.learnerType } }, requestId);
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
    return row ? reply(200, { learner: { id: row.id, name: row.displayName, learnerType: row.learnerType } }, requestId)
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
    return reply(status,safe,requestId);
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
    return reply(status,data,requestId);
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
  return profiles(env.DB, owner.id, session.user.id, request, path, requestId);
}

