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
// A later signed denial supersedes a previously successful staff roster read.
export const isAdminTeacherAccessRevoked=(error:unknown):error is AdminTeachersError=>
 error instanceof AdminTeachersError&&[401,403,404].includes(error.status);
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
export async function fetchAdminTeachers(signal?:AbortSignal,teacherId?:string):Promise<AdminTeacherDirectoryValue>{
 if(teacherId!==undefined&&!id.test(teacherId))
  throw new AdminTeachersError('INVALID_TEACHER_LOOKUP',400);
 const url=teacherId===undefined?'/v1/staff/teachers':
  `/v1/staff/teachers?id=${encodeURIComponent(teacherId)}`;
 let response:Response;
 try{
  response=await fetch(url,{method:'GET',credentials:'same-origin',
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
 const directory=parseAdminTeachers(payload);
 // #314: a successful exact-ID response must prove the requested target.
 // Never let an intermediary's stale/mismatched 200 add another Sheikh
 // to the staff action selector, even if its general DTO is well formed.
 if(teacherId!==undefined&&(directory.truncated||directory.teachers.length>1||
    directory.teachers.some(teacher=>teacher.id!==teacherId)))
  throw new AdminTeachersError('INVALID_TEACHER_LOOKUP_RESPONSE',response.status);
 return directory;
}
