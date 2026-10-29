export type AccountUser = Readonly<{ id: string; name: string }>;
export type AccountSession = Readonly<{ user: AccountUser; phoneVerified: boolean }>;
export type AccountLearner = Readonly<{ id: string; name: string; learnerType: 'adult' | 'child'; revision:number }>;
export type LearnerProfileAction =
  | { action:'rename'; expectedRevision:number; operationId:string; name:string }
  | { action:'archive'; expectedRevision:number; operationId:string };
export type LearnerProfileAck = Readonly<{code:string;revision:number}>;
export type Credentials = { phoneNumber: string; password: string };
export type Registration = Credentials & { name: string };

export class AccountError extends Error {
  constructor(public readonly code: string, public readonly status = 0) { super(code); }
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AccountError('INVALID_RESPONSE');
  return value as Record<string, unknown>;
}
function name(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 80;
}
export function parseSession(value: unknown): AccountSession {
  const data = record(value), user = record(data.user);
  if (typeof user.id !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(user.id) ||
      !name(user.name) || typeof data.phoneVerified !== 'boolean') throw new AccountError('INVALID_RESPONSE');
  return { user: { id: user.id, name: user.name }, phoneVerified: data.phoneVerified };
}
export function parseLearner(value: unknown): AccountLearner {
  const row = record(value);
  if (typeof row.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(row.id) ||
      !name(row.name) || (row.learnerType !== 'adult' && row.learnerType !== 'child') ||
      !Number.isSafeInteger(row.revision) || Number(row.revision)<1) throw new AccountError('INVALID_RESPONSE');
  return { id: row.id, name: row.name, learnerType: row.learnerType, revision:row.revision as number };
}
export function parseLearners(value: unknown): readonly AccountLearner[] {
  const rows = record(value).learners;
  if (!Array.isArray(rows) || rows.length > 8) throw new AccountError('INVALID_RESPONSE');
  const learners = rows.map(parseLearner);
  if (new Set(learners.map(row => row.id)).size !== learners.length) throw new AccountError('INVALID_RESPONSE');
  return learners;
}

/** Fixed same-origin paths only. The browser owns the HttpOnly cookie and Origin header. */
export function createAccountClient(transport: typeof fetch = fetch) {
  async function request(path: string, body?: unknown, signal?: AbortSignal): Promise<unknown> {
    let response: Response;
    try {
      response = await transport(path, { method: body === undefined ? 'GET' : 'POST',
        credentials: 'same-origin', cache: 'no-store', redirect: 'error',
        ...(signal ? { signal } : {}),
        ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
      });
    } catch { throw new AccountError('NETWORK_ERROR'); }
    if (!response.ok) {
      let code = 'SERVICE_UNAVAILABLE';
      try { const data = record(await response.json()); if (typeof data.code === 'string') code = data.code; } catch { /* safe generic response */ }
      throw new AccountError(code, response.status);
    }
    try { return await response.json() as unknown; } catch { throw new AccountError('INVALID_RESPONSE'); }
  }
  return {
    session: async (signal?: AbortSignal) => parseSession(await request('/api/auth/session', undefined, signal)),
    login: async (body: Credentials) => parseSession(await request('/api/auth/login', body)),
    register: async (body: Registration) => parseSession(await request('/api/auth/register', body)),
    logout: async () => { await request('/api/auth/logout', {}); },
    learners: async (signal?: AbortSignal) => parseLearners(await request('/v1/me/learners', undefined, signal)),
    profileAction: async (learnerId:string, body:LearnerProfileAction):Promise<LearnerProfileAck> => {
      if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(learnerId))
        throw new AccountError('INVALID_LEARNER_ID');
      const payload=record(await request('/v1/me/learners/'+learnerId+'/profile-actions',body));
      if(!['PROFILE_UPDATED','OPERATION_ALREADY_APPLIED'].includes(String(payload.code)) ||
          !Number.isSafeInteger(payload.revision) || Number(payload.revision)!==body.expectedRevision+1)
        throw new AccountError('INVALID_RESPONSE');
      return {code:payload.code as string,revision:payload.revision as number};
    },
    createLearner: async (body: Pick<AccountLearner, 'name' | 'learnerType'>) => {
      const data = record(await request('/v1/me/learners', body)); return parseLearner(data.learner);
    },
  };
}
export function accountErrorMessage(error: unknown): string {
  if (!(error instanceof AccountError)) return 'تعذّر إكمال الطلب. حاول مرة أخرى.';
  if (error.status === 401) return 'بيانات الدخول غير صحيحة أو انتهت الجلسة. سجّل الدخول مجددًا.';
  if (error.status === 429) return 'محاولات كثيرة. انتظر دقيقة ثم حاول مجددًا.';
  if (error.code === 'PROFILE_REVISION_CONFLICT' || error.code === 'OPERATION_CONFLICT') return 'تغير الملف في جلسة أخرى. حدّث القائمة قبل إعادة التعديل.';
  if (error.code === 'PROFILE_SCHEMA_NOT_READY') return 'إدارة الملفات قيد التجهيز على الخادم.';
  if (error.status === 404) return 'ملف الطالب لم يعد متاحًا. حدّث القائمة.';
  if (error.code === 'LEARNER_LIMIT') return 'وصلت إلى الحد الأقصى: ثمانية ملفات طلاب.';
  if (error.code === 'NETWORK_ERROR') return 'تعذّر الاتصال. راجع اتصال الإنترنت وحدّث البيانات قبل إعادة المحاولة.';
  if (error.code === 'REGISTRATION_FAILED') return 'تعذّر إنشاء الحساب. إذا سبق لك التسجيل، جرّب تسجيل الدخول.';
  if (error.status === 400) return 'راجع البيانات المطلوبة ثم حاول مجددًا.';
  if (error.status === 403) return 'تعذّر الوصول إلى الحساب. سجّل الدخول مجددًا أو تواصل مع الدعم.';
  return 'خدمة الحسابات غير متاحة الآن. أعد المحاولة لاحقًا.';
}
