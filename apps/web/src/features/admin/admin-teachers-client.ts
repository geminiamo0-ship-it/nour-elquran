/** #305: role-scoped, read-only staff teacher directory.
 * Server decides authorization; browser cannot assert roles or mutate teachers.
 */
export type AdminTeacher=Readonly<{
 id:string;name:string;qualified:boolean;status:'active'|'disabled';
 currentLearners:number;upcomingLessons:number;
}>;
export type AdminTeacherDirectoryValue=Readonly<{
 asOfMs:number;teachers:readonly AdminTeacher[];truncated:boolean;
}>;
export class AdminTeachersError extends Error{
 constructor(readonly code:string,readonly status=0){super(code);}
}
const record=(v:unknown):v is Record<string,unknown> =>
 v!==null&&typeof v==='object'&&!Array.isArray(v);
const keys=['id','name','qualified','status','currentLearners','upcomingLessons'] as const;
const id=/^[a-zA-Z0-9-]{1,128}$/;
const integer=(v:unknown):v is number=>Number.isSafeInteger(v)&&Number(v)>=0;

export function parseAdminTeachers(value:unknown):AdminTeacherDirectoryValue{
 if(!record(value)||value.code!=='STAFF_TEACHER_DIRECTORY'||value.readOnly!==true||
  !integer(value.asOfMs)||typeof value.truncated!=='boolean'||
  !Array.isArray(value.teachers)||value.teachers.length>50)
  throw new AdminTeachersError('INVALID_TEACHER_DIRECTORY');
 const teachers:AdminTeacher[]=[];
 const ids=new Set<string>();
 for(const row of value.teachers as unknown[]){
  if(!record(row)||Object.keys(row).length!==keys.length||
    !keys.every(k=>Object.hasOwn(row,k))||
    typeof row.id!=='string'||!id.test(row.id)||ids.has(row.id)||
    typeof row.name!=='string'||row.name.trim()!==row.name||
    row.name.length<1||row.name.length>120||
    typeof row.qualified!=='boolean'||
    (row.status!=='active'&&row.status!=='disabled')||
    !integer(row.currentLearners)||!integer(row.upcomingLessons))
   throw new AdminTeachersError('INVALID_TEACHER_DIRECTORY');
  ids.add(row.id);
  teachers.push({
   id:row.id,name:row.name,qualified:row.qualified,
   status:row.status,currentLearners:row.currentLearners,
   upcomingLessons:row.upcomingLessons,
  });
 }
 if(value.truncated&&teachers.length!==50)
  throw new AdminTeachersError('INVALID_TEACHER_DIRECTORY');
 return {asOfMs:value.asOfMs as number,teachers,truncated:value.truncated};
}
export async function fetchAdminTeachers(signal?:AbortSignal):Promise<AdminTeacherDirectoryValue>{
 let response:Response;
 try{
  response=await fetch('/v1/staff/teachers',{method:'GET',credentials:'same-origin',
   cache:'no-store',redirect:'error',...(signal?{signal}:{})});
 }catch{throw new AdminTeachersError('NETWORK_UNAVAILABLE');}
 let payload:unknown;
 try{payload=await response.json();}catch{
  throw new AdminTeachersError('INVALID_TEACHER_DIRECTORY',response.status);
 }
 if(!response.ok){
  throw new AdminTeachersError(record(payload)&&typeof payload.code==='string'
   ?payload.code:'STAFF_TEACHERS_UNAVAILABLE',response.status);
 }
 return parseAdminTeachers(payload);
}
