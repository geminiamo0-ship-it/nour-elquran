import {afterEach,describe,expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import type {AccountSession} from '@/features/account';
import {AdminAcademyMvp,submitAcademyCommand} from './AdminAcademyMvp';
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
