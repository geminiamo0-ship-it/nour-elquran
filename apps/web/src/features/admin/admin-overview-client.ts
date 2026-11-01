/** #302: read-only, same-origin staff overview. Browser never sends a role,
 * learner identity, teacher identity or any administrative write.
 */
export type AdminOverview=Readonly<{
 asOfMs:number;
 metrics:Readonly<{
  activeLearners:number;
  activeQualifiedTeachers:number;
  upcomingLessons:number;
  completedLessons:number;
 }>;
}>;
export class AdminOverviewError extends Error{
 constructor(readonly code:string,readonly status=0){super(code);}
}
const isRecord=(v:unknown):v is Record<string,unknown> =>
 v!==null&&typeof v==='object'&&!Array.isArray(v);
const metricsKeys=['activeLearners','activeQualifiedTeachers','upcomingLessons',
 'completedLessons'] as const;

export function parseAdminOverview(value:unknown):AdminOverview{
 if(!isRecord(value)||value.code!=='STAFF_OVERVIEW'||value.readOnly!==true||
  !Number.isSafeInteger(value.asOfMs)||Number(value.asOfMs)<0)
  throw new AdminOverviewError('INVALID_OVERVIEW');
 const m=value.metrics;
 if(!isRecord(m)||Object.keys(m).length!==metricsKeys.length||
  !metricsKeys.every(k=>Number.isSafeInteger(m[k])&&Number(m[k])>=0))
  throw new AdminOverviewError('INVALID_OVERVIEW');
 return {asOfMs:Number(value.asOfMs),metrics:{
  activeLearners:Number(m.activeLearners),
  activeQualifiedTeachers:Number(m.activeQualifiedTeachers),
  upcomingLessons:Number(m.upcomingLessons),
  completedLessons:Number(m.completedLessons),
 }};
}

export async function fetchAdminOverview(signal?:AbortSignal):Promise<AdminOverview>{
 let response:Response;
 try{
  response=await fetch('/v1/staff/overview',{method:'GET',credentials:'same-origin',
   cache:'no-store',redirect:'error',...(signal?{signal}:{})});
 }catch{throw new AdminOverviewError('NETWORK_UNAVAILABLE');}
 let payload:unknown;
 try{payload=await response.json();}catch{
  throw new AdminOverviewError('INVALID_OVERVIEW',response.status);
 }
 if(!response.ok){
  const code=isRecord(payload)&&typeof payload.code==='string'?payload.code:
   'STAFF_OVERVIEW_UNAVAILABLE';
  throw new AdminOverviewError(code,response.status);
 }
 return parseAdminOverview(payload);
}
