/** Exact, authenticated first-free-trial slot API.
 * Neither teacher names nor pricing are implied by the browser.
 */
export type TrialSlot=Readonly<{slotId:string;startsAtMs:number;endsAtMs:number;
 instructionMinutes:30;reservationMinutes:40}>;
export type TrialAvailability=Readonly<{eligible:boolean;slots:readonly TrialSlot[]}>;
export class TrialBookingError extends Error{
 constructor(readonly code:string,readonly status=0){super(code);}
}
const id=/^[A-Za-z0-9-]{1,128}$/;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const obj=(raw:unknown):raw is Record<string,unknown>=>raw!==null&&typeof raw==='object'&&!Array.isArray(raw);
function ownerUrl(learnerId:string){
 if(!id.test(learnerId))throw new TrialBookingError('INVALID_LEARNER');
 return '/v1/me/learners/'+encodeURIComponent(learnerId);
}
export function parseTrialAvailability(raw:unknown):TrialAvailability{
 if(!obj(raw)||raw.code!=='TRIAL_SLOTS'||typeof raw.eligible!=='boolean'||
  !Array.isArray(raw.slots)||raw.slots.length>50||
  (!raw.eligible&&raw.slots.length!==0))
  throw new TrialBookingError('INVALID_TRIAL_RESPONSE');
 const slots=raw.slots.map((row:unknown):TrialSlot=>{
  if(!obj(row)||Object.keys(row).length!==5||
   !['slotId','startsAtMs','endsAtMs','instructionMinutes','reservationMinutes']
    .every(k=>Object.hasOwn(row,k))||
   typeof row.slotId!=='string'||!uuid.test(row.slotId)||
    !Number.isSafeInteger(row.startsAtMs)||Number(row.startsAtMs)<0||
    !Number.isSafeInteger(row.endsAtMs)||
    Number(row.endsAtMs)-Number(row.startsAtMs)!==2400000||
    row.instructionMinutes!==30||row.reservationMinutes!==40)
   throw new TrialBookingError('INVALID_TRIAL_RESPONSE');
  return {slotId:row.slotId,startsAtMs:row.startsAtMs,
    endsAtMs:row.endsAtMs,instructionMinutes:30,reservationMinutes:40} as TrialSlot;
 });
 if(new Set(slots.map(s=>s.slotId)).size!==slots.length)
  throw new TrialBookingError('INVALID_TRIAL_RESPONSE');
 return {eligible:raw.eligible,slots};
}
async function request(url:string,input?:unknown,signal?:AbortSignal):Promise<Record<string,unknown>>{
 let response:Response;
 try{response=await fetch(url,{method:input===undefined?'GET':'POST',
  credentials:'same-origin',cache:'no-store',redirect:'error',
  ...(input===undefined?{}:{headers:{'content-type':'application/json'},
   body:JSON.stringify(input)}),...(signal?{signal}:{})});}
 catch{throw new TrialBookingError('NETWORK_UNAVAILABLE');}
 let payload:unknown;
 try{payload=await response.json();}catch{throw new TrialBookingError('INVALID_TRIAL_RESPONSE',response.status);}
 if(!obj(payload))throw new TrialBookingError('INVALID_TRIAL_RESPONSE',response.status);
 if(!response.ok)throw new TrialBookingError(typeof payload.code==='string'?
  payload.code:'TRIAL_SERVICE_UNAVAILABLE',response.status);
 return payload;
}
export const trialBookingClient={
 availability:async(learnerId:string,signal?:AbortSignal)=>
  parseTrialAvailability(await request(ownerUrl(learnerId)+'/trial-slots',undefined,signal)),
 book:async(learnerId:string,slotId:string,operationId:string)=>{
  if(!uuid.test(slotId)||!uuid.test(operationId))
   throw new TrialBookingError('INVALID_TRIAL_BOOKING');
  const payload=await request(ownerUrl(learnerId)+'/trial-bookings',{slotId,operationId});
  if(!['TRIAL_BOOKED','TRIAL_BOOKING_REPLAY'].includes(String(payload.code))||
    typeof payload.lessonId!=='string'||!uuid.test(payload.lessonId))
   throw new TrialBookingError('INVALID_TRIAL_RESPONSE');
  return payload.lessonId;
 },
 rescheduleSlots:async(learnerId:string,lessonId:string,signal?:AbortSignal)=>{
  if(!uuid.test(lessonId))throw new TrialBookingError('INVALID_TRIAL_RESCHEDULE');
  const raw=await request(ownerUrl(learnerId)+'/trial-reschedule-slots?lessonId='+
   encodeURIComponent(lessonId),undefined,signal);
  if(raw.code!=='TRIAL_RESCHEDULE_SLOTS')
   throw new TrialBookingError('INVALID_TRIAL_RESPONSE');
  return parseTrialAvailability({code:'TRIAL_SLOTS',eligible:true,slots:raw.slots}).slots;
 },
 reschedule:async(learnerId:string,oldLessonId:string,slotId:string,operationId:string)=>{
  if(![oldLessonId,slotId,operationId].every(v=>uuid.test(v)))
   throw new TrialBookingError('INVALID_TRIAL_RESCHEDULE');
  const payload=await request(ownerUrl(learnerId)+'/trial-reschedules',
    {oldLessonId,slotId,operationId});
  if(!['TRIAL_RESCHEDULED','TRIAL_RESCHEDULE_REPLAY'].includes(String(payload.code))||
   typeof payload.lessonId!=='string'||!uuid.test(payload.lessonId))
   throw new TrialBookingError('INVALID_TRIAL_RESPONSE');
  return payload.lessonId;
 },
 cancel:async(learnerId:string,lessonId:string,operationId:string)=>{
  if(!uuid.test(lessonId)||!uuid.test(operationId))
   throw new TrialBookingError('INVALID_TRIAL_CANCELLATION');
  const payload=await request(ownerUrl(learnerId)+'/trial-cancellations',
   {lessonId,operationId});
  if(!['TRIAL_CANCELLED','TRIAL_ALREADY_CANCELLED'].includes(String(payload.code))||
   payload.lessonId!==lessonId)throw new TrialBookingError('INVALID_TRIAL_RESPONSE');
  return lessonId;
 }
};
