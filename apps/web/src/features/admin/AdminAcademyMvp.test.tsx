import {readFileSync} from 'node:fs';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import type {AccountSession} from '@/features/account';
import {AdminAcademyMvp,submitAcademyCommand,readAcademy,
 academyAdminOperationErrorMessage} from './AdminAcademyMvp';
import {academyAdminOutcomeIsUncertain} from './admin-academy-write-outcome';
import {academyAdminStaffAccessRevoked} from './admin-academy-read';

afterEach(()=>vi.unstubAllGlobals());

function response(status:number,body:unknown,throws=false){
 const json=vi.fn(async()=>{
  if(throws)throw new SyntaxError('synthetic invalid JSON');
  return body;
 });
 vi.stubGlobal('fetch',vi.fn(async()=>({status,ok:false,json})));
 return json;
}

describe('staff academy malformed authorization response #315',()=>{
 it('treats an HTML 403 as revoked staff access but an uncertain D1 write',async()=>{
  response(403,null,true);
  const payload={operationId:'44444444-4444-4444-8444-444444444444'};
  let failure:unknown;
  try{await submitAcademyCommand('activate',payload);}
  catch(e){failure=e;}
  expect(failure).toMatchObject({
   code:'STAFF_ACCESS_DENIED',status:403,exactCodeOnly:false
  });
  const err=failure as {code:string;status:number;exactCodeOnly:boolean};
  expect(academyAdminStaffAccessRevoked(err.status,err.code)).toBe(true);
  expect(academyAdminOutcomeIsUncertain('activate',err.status,
   err.code,err.exactCodeOnly)).toBe(true);
  expect(fetch).toHaveBeenCalledWith('/v1/staff/academy/activate',
   expect.objectContaining({method:'POST',credentials:'same-origin',
    cache:'no-store',redirect:'error',body:JSON.stringify(payload)}));
 });
 it('fails closed on a 403 JSON body without a trustworthy code',async()=>{
  response(403,{message:'proxy access denied'});
  await expect(submitAcademyCommand('packages',{})).rejects.toMatchObject({
   code:'STAFF_ACCESS_DENIED',status:403,exactCodeOnly:false
  });
 });
 it('keeps an exact Worker business denial distinct from role revocation',async()=>{
  response(403,{code:'ACADEMY_ACTIVATION_DENIED'});
  let failure:unknown;
  try{await submitAcademyCommand('activate',{});}
  catch(e){failure=e;}
  expect(failure).toMatchObject({
   code:'ACADEMY_ACTIVATION_DENIED',status:403,exactCodeOnly:true
  });
  const err=failure as {code:string;status:number};
  expect(academyAdminStaffAccessRevoked(err.status,err.code)).toBe(false);
 });
 it('never interprets an unauthenticated 401 as proof the write did not commit',async()=>{
  const json=response(401,null,true);
  await expect(submitAcademyCommand('activate',{})).rejects.toMatchObject({
   code:'STAFF_ACCESS_DENIED',status:401,exactCodeOnly:false
  });
  expect(json).not.toHaveBeenCalled();
 });
 it('does not forge staff revocation from an unrelated malformed 503',async()=>{
  response(503,null,true);
  await expect(submitAcademyCommand('activate',{})).rejects.toThrow(
   'استجابة غير صالحة');
 });
});

describe('staff academy signed GET error privacy #315',()=>{
 it('does not echo a malformed JSON response containing private proxy or D1 text',async()=>{
  const privateBody='SQL_PRIVATE_CHILD_NAME_<script>secret</script>';
  vi.stubGlobal('fetch',vi.fn(async()=>({
   status:200,
   json:vi.fn(async()=>{throw new SyntaxError(privateBody);})
  })));
  await expect(readAcademy(new AbortController().signal)).rejects.toThrow(
   'تعذّر قراءة الإدارة من الخادم');
  try{await readAcademy(new AbortController().signal);}
  catch(error){
   expect(String(error)).not.toContain('SQL_PRIVATE_CHILD_NAME');
   expect(String(error)).not.toContain('<script>');
  }
  expect(fetch).toHaveBeenCalledWith('/v1/staff/academy',
   expect.objectContaining({credentials:'same-origin',cache:'no-store',
    redirect:'error'}));
 });
 it('sanitizes a malformed signed 200 payload instead of showing raw fields',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>({
   status:200,json:vi.fn(async()=>({code:'ACADEMY_STAFF',
    packages:'PRIVATE_CHILD_RECORD',requests:[],invites:[],whatsappNumber:null}))
  })));
  await expect(readAcademy(new AbortController().signal)).rejects.toThrow(
   'تعذّر قراءة الإدارة من الخادم');
 });
});

describe('staff academy denial message privacy #315',()=>{
 it('does not echo untrusted codes or private strings from a malformed intermediary',()=>{
  const unknown='SQL_PRIVATE_CHILD_NAME_<script>alert(1)</script>';
  const message=academyAdminOperationErrorMessage(unknown);
  expect(message).toContain('راجع السجل');
  expect(message).not.toContain('SQL_PRIVATE');
  expect(message).not.toContain('<script>');
  expect(academyAdminOperationErrorMessage('a'.repeat(100_000))).toBe(message);
 });
 it('explains a durably issued Sheikh invitation cannot reveal its one-use token again',()=>{
  const message=academyAdminOperationErrorMessage('ACADEMY_INVITE_ALREADY_ISSUED');
  expect(message).toContain('رابطها السري لا يمكن استعادته');
  expect(message).toContain('تحقق من الحالة');
  expect(academyAdminOperationErrorMessage('ACADEMY_CYCLE_OVERLAP'))
   .toContain('اشتراك متداخل');
 });
});

describe('staff academy SSR privacy boundary #315',()=>{
 it('renders no privileged learner roster or invitation before signed GET',()=>{
  const session={user:{id:'synthetic-staff',name:'Synthetic Staff'},
   phoneVerified:true} as unknown as AccountSession;
  for(const mode of ['packages','requests','invites','contact'] as const){
   const html=renderToStaticMarkup(<AdminAcademyMvp session={session} mode={mode}/>);
   expect(html).toContain('جارٍ تحميل البيانات');
   expect(html).not.toContain('teacher/join?token=');
   expect(html).not.toContain('تم الاستلام يدويًا');
   expect(html).not.toContain('synthetic-learner');
  }
 });
});

/** Source contract until signed Dev browser interaction coverage is available.
 * A previously checked confirmation must never authorize a changed package,
 * learner, audit note or WhatsApp contact without a fresh explicit check. */
describe('staff academy confirmation is bound to unchanged form values #315',()=>{
 it('unchecks confirmation on every editable operational value',()=>{
  const source=readFileSync(new URL('./AdminAcademyMvp.tsx',import.meta.url),'utf8');
  const handlers=[...source.matchAll(/onChange=\{e=>\{([\s\S]*?)\}\}/g)]
   .map(match=>match[1]??'');
  for(const field of ['Title','Price','Sessions','LearnerId',
   'SelectedPackage','Reason','Whatsapp']){
   const setter=`set${field}(e.target.value)`;
   expect(handlers.some(handler=>handler.includes(setter)&&
    handler.includes('setConfirmed(false)')),
    `${field} must invalidate a prior staff confirmation`).toBe(true);
  }
 });
});
