import {describe,expect,it} from 'vitest';
import {parseAdminAcademyRead} from './admin-academy-read';

const packageRow={id:'version-1',packageId:'package-1',title:'Synthetic package',
 priceEgp:200,sessions:8,active:1,atMs:1700000000000};
const requestRow={id:'request-1',learnerId:'learner-1',learnerName:'Synthetic learner',
 title:'Synthetic package',priceEgp:200,sessions:8,
 packageVersionId:'version-1',atMs:1700000000000,state:'pending'};
const inviteRow={id:'invite-1',teacherName:'Synthetic Sheikh',claimed:1,
 teacherId:'teacher-1',createdAtMs:1700000000000,
 expiresAtMs:1700600000000,claimedAtMs:1700001000000};
// Worker routes intentionally strip `status` from the JSON body.
const valid=()=>({code:'ACADEMY_STAFF',
 packages:[{...packageRow}],requests:[{...requestRow}],
 invites:[{...inviteRow}],whatsappNumber:'201000000000'});

describe('bounded signed staff academy read #315',()=>{
 it('projects only reviewed fields, never unknown D1/HTTP private keys',()=>{
  const receipt={...valid(),guardianPhone:'secret',
   packages:[{...packageRow,authSubject:'secret'}],
   requests:[{...requestRow,paymentToken:'secret',guardianPhone:'secret'}],
   invites:[{...inviteRow,claimedSubject:'secret'}]};
  const result=parseAdminAcademyRead(receipt);
  expect(result).toEqual({code:'ACADEMY_STAFF',
   packages:[packageRow],requests:[requestRow],invites:[inviteRow],
   whatsappNumber:'201000000000'});
  expect(JSON.stringify(result)).not.toContain('secret');
 });
 it('accepts honest empty lists, inactive packages, rejected requests and unclaimed invites',()=>{
  expect(parseAdminAcademyRead({...valid(),packages:[],requests:[],invites:[],
   whatsappNumber:null})).toEqual({code:'ACADEMY_STAFF',
   packages:[],requests:[],invites:[],whatsappNumber:null});
  expect(parseAdminAcademyRead({...valid(),
   packages:[{...packageRow,active:0}],
   requests:[{...requestRow,state:'rejected'}],
   invites:[{...inviteRow,teacherName:null,teacherId:null,claimed:0,
    claimedAtMs:null}]}).invites[0]?.claimed).toBe(0);
 });
 it('rejects malformed status, numeric coercion, fake states and missing fields',()=>{
  for(const bad of [
   null,[],{...valid(),code:'ACADEMY_OWNER'},
   {...valid(),status:201},
   {...valid(),status:'200'},
   {...valid(),status:undefined},
   {...valid(),status:204},
   {...valid(),packages:null},
   {...valid(),packages:[{...packageRow,priceEgp:'200'}]},
   {...valid(),packages:[{...packageRow,sessions:0}]},
   {...valid(),packages:[{...packageRow,active:true}]},
   {...valid(),requests:[{...requestRow,state:'paid'}]},
   {...valid(),requests:[{...requestRow,learnerName:null}]},
   {...valid(),invites:[{...inviteRow,expiresAtMs:'1700600000000'}]},
   // A safe integer can still be outside the valid Date/Intl range.
   {...valid(),invites:[{...inviteRow,expiresAtMs:Number.MAX_SAFE_INTEGER}]},
   {...valid(),invites:[{...inviteRow,createdAtMs:Number.MAX_SAFE_INTEGER}]},
   {...valid(),invites:[{...inviteRow,claimedAtMs:Number.MAX_SAFE_INTEGER}]},
   {...valid(),packages:[{...packageRow,atMs:Number.MAX_SAFE_INTEGER}]},
   {...valid(),requests:[{...requestRow,atMs:Number.MAX_SAFE_INTEGER}]},
   {...valid(),invites:[{...inviteRow,claimed:2}]},
   // A malformed signed D1 row cannot misrepresent a claimed Sheikh as pending,
   // or invent a claim outside the invitation's valid lifetime.
   {...valid(),invites:[{...inviteRow,claimed:0}]},
   {...valid(),invites:[{...inviteRow,claimed:0,teacherName:null,
    teacherId:null}]},
   {...valid(),invites:[{...inviteRow,claimed:0,teacherId:null,
    claimedAtMs:null}]},
   {...valid(),invites:[{...inviteRow,claimed:1,claimedAtMs:null}]},
   {...valid(),invites:[{...inviteRow,claimedAtMs:inviteRow.createdAtMs-1}]},
   {...valid(),invites:[{...inviteRow,claimedAtMs:inviteRow.expiresAtMs+1}]},
   {...valid(),invites:[{...inviteRow,expiresAtMs:inviteRow.createdAtMs}]},
   // A signed invitation is never valid for longer than the issued 7 days.
   {...valid(),invites:[{...inviteRow,
    expiresAtMs:inviteRow.createdAtMs+7*86_400_000+1}]},
   {...valid(),whatsappNumber:'not-a-phone'},
   {...valid(),whatsappNumber:undefined},
  ])expect(()=>parseAdminAcademyRead(bad)).toThrow('ACADEMY_STAFF_INVALID_RESPONSE');
 });
 it('accepts the seven-day expiry boundary without rounding it down',()=>{
  const exactlySevenDays={...inviteRow,
   expiresAtMs:inviteRow.createdAtMs+7*86_400_000};
  expect(parseAdminAcademyRead({...valid(),invites:[exactlySevenDays]})
   .invites[0]?.expiresAtMs).toBe(exactlySevenDays.expiresAtMs);
 });
 it('enforces fixed Worker bounds and unique identifiers, not unbounded browser arrays',()=>{
  for(const bad of [
   {...valid(),packages:Array.from({length:101},(_,i)=>({...packageRow,
    id:'version-'+i,packageId:'package-'+i}))},
   {...valid(),requests:Array.from({length:101},(_,i)=>({...requestRow,
    id:'request-'+i}))},
   {...valid(),invites:Array.from({length:51},(_,i)=>({...inviteRow,
    id:'invite-'+i}))},
   {...valid(),packages:[packageRow,packageRow]},
   {...valid(),packages:[packageRow,{...packageRow,id:'version-2'}]},
   {...valid(),requests:[requestRow,requestRow]},
   {...valid(),invites:[inviteRow,inviteRow]},
  ])expect(()=>parseAdminAcademyRead(bad)).toThrow('ACADEMY_STAFF_INVALID_RESPONSE');
 });
});
