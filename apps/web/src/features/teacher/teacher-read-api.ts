/**
 * Read-only teacher API adapter. Never authorizes access using a role stored in
 * the browser. Data returned by Cloudflare Worker is checked at the boundary.
 */
export type TeacherRosterRow = Readonly<{
  id: string; name: string; learnerType: 'adult' | 'child';
}>;
export type TeacherCalendarRow = Readonly<{
  id: string; learnerId: string; learnerName?: string;
  kind: 'trial' | 'standard' | 'makeup';
  status: 'scheduled' | 'live' | 'completed' | 'cancelled';
  startsAtMs: number; endsAtMs: number;
}>;
export class TeacherReadError extends Error {
  constructor(readonly code: string, readonly status = 0) { super(code); }
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new TeacherReadError('INVALID_RESPONSE');
  return value as Record<string, unknown>;
}
function identifier(value: unknown): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9-]{1,128}$/.test(value);
}
function name(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 80;
}
export function parseTeacherRoster(payload: unknown): readonly TeacherRosterRow[] {
  const rows = object(payload).learners;
  if (!Array.isArray(rows) || rows.length > 50) throw new TeacherReadError('INVALID_RESPONSE');
  const learners = rows.map((value: unknown):TeacherRosterRow => {
    const item=object(value);
    if (!identifier(item.id) || !name(item.name) ||
        (item.learnerType !== 'adult' && item.learnerType !== 'child'))
      throw new TeacherReadError('INVALID_RESPONSE');
    return {id:item.id,name:item.name,learnerType:item.learnerType};
  });
  if (new Set(learners.map(item => item.id)).size !== learners.length)
    throw new TeacherReadError('INVALID_RESPONSE');
  return learners;
}
export function parseTeacherLessons(payload: unknown): readonly TeacherCalendarRow[] {
  const rows = object(payload).lessons;
  if (!Array.isArray(rows) || rows.length > 50) throw new TeacherReadError('INVALID_RESPONSE');
  const lessons = rows.map((value: unknown):TeacherCalendarRow => {
    const item=object(value);
    if (!identifier(item.id) || !identifier(item.learnerId) ||
        (item.learnerName !== undefined && !name(item.learnerName)) ||
        !['trial','standard','makeup'].includes(String(item.kind)) ||
        !['scheduled','live','completed','cancelled'].includes(String(item.status)) ||
        !Number.isSafeInteger(item.startsAtMs) || Number(item.startsAtMs) < 0 ||
        !Number.isSafeInteger(item.endsAtMs) || Number(item.endsAtMs) <= Number(item.startsAtMs))
      throw new TeacherReadError('INVALID_RESPONSE');
    return {id:item.id,learnerId:item.learnerId,
      ...(typeof item.learnerName === 'string'?{learnerName:item.learnerName}:{}),
      kind:item.kind as TeacherCalendarRow['kind'],
      status:item.status as TeacherCalendarRow['status'],
      startsAtMs:item.startsAtMs as number,endsAtMs:item.endsAtMs as number};
  });
  if (new Set(lessons.map(item => item.id)).size !== lessons.length)
    throw new TeacherReadError('INVALID_RESPONSE');
  return lessons;
}
export function createTeacherReadClient(transport:typeof fetch=fetch) {
  async function read(path:'/v1/teacher/learners'|'/v1/teacher/lessons',signal?:AbortSignal):Promise<unknown> {
    let response:Response;
    try {response=await transport(path,{method:'GET',credentials:'same-origin',
      cache:'no-store',redirect:'error',...(signal?{signal}:{})});}
    catch {throw new TeacherReadError('NETWORK_ERROR');}
    if(!response.ok)throw new TeacherReadError(
      response.status===401?'UNAUTHENTICATED':response.status===403?'TEACHER_ACCESS_DENIED':'SERVICE_UNAVAILABLE',
      response.status);
    try{return await response.json() as unknown;}
    catch {throw new TeacherReadError('INVALID_RESPONSE');}
  }
  return {
    roster: async(signal?:AbortSignal)=>parseTeacherRoster(await read('/v1/teacher/learners',signal)),
    lessons: async(signal?:AbortSignal)=>parseTeacherLessons(await read('/v1/teacher/lessons',signal)),
  };
}
