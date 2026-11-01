/** #305: staff-only academic teacher directory; never return learner identities,
 * teacher auth subjects, phone/email, private qualifications or financial data.
 */
import type {CoreDatabase} from './bindings.ts';
import {canManageTeachers} from './staff-teachers.ts';

export const ADMIN_TEACHER_LIMIT=50;
export type AdminTeacher=Readonly<{
 id:string;
 name:string;
 qualified:boolean;
 status:'active'|'disabled';
 currentLearners:number;
 upcomingLessons:number;
}>;
type TeacherRow=Readonly<{
 id:unknown;
 name:unknown;
 qualified:unknown;
 status:unknown;
 currentLearners:unknown;
 upcomingLessons:unknown;
}>;

/** Only deterministic, bounded records after the fresh current staff grant. */
export const ADMIN_TEACHERS_SQL=`
 SELECT teacher.id AS id, user.name AS name,
        teacher.qualified AS qualified, teacher.status AS status,
        (SELECT COUNT(*) FROM teacher_assignments AS assignment
         JOIN learners AS learner ON learner.id=assignment.learner_id
         JOIN accounts AS owner ON owner.id=learner.account_id
         WHERE assignment.teacher_id=teacher.id
           AND assignment.revoked_at_ms IS NULL
           AND assignment.starts_at_ms<=? AND assignment.ends_at_ms>?
           AND learner.status='active' AND owner.status='active'
        ) AS currentLearners,
        (SELECT COUNT(*) FROM lessons AS lesson
         WHERE lesson.actual_teacher_id=teacher.id
           AND lesson.status='scheduled' AND lesson.starts_at_ms>=?
        ) AS upcomingLessons
 FROM teachers AS teacher
 JOIN auth_users AS user ON user.id=teacher.auth_subject
 ORDER BY user.name COLLATE NOCASE ASC, teacher.id ASC
 LIMIT 51
`;
const ID=/^[a-zA-Z0-9-]{1,128}$/;
function validRow(row:TeacherRow):boolean{
 return typeof row.id==='string'&&ID.test(row.id)&&
  typeof row.name==='string'&&row.name.trim().length>0&&row.name.length<=120&&
  (row.qualified===0||row.qualified===1)&&
  (row.status==='active'||row.status==='disabled')&&
  Number.isSafeInteger(row.currentLearners)&&Number(row.currentLearners)>=0&&
  Number.isSafeInteger(row.upcomingLessons)&&Number(row.upcomingLessons)>=0;
}
export async function readAdminTeachers(
 db:CoreDatabase,verifiedSubject:string,now=Date.now(),
){
 if(!Number.isSafeInteger(now)||now<0)
  return {status:503,code:'CLOCK_UNAVAILABLE'} as const;
 if(!await canManageTeachers(db,verifiedSubject))
  return {status:403,code:'STAFF_ACCESS_DENIED'} as const;
 const rows=await db.prepare(ADMIN_TEACHERS_SQL).bind(now,now,now).all<TeacherRow>();
 if(!Array.isArray(rows.results)||rows.results.length>ADMIN_TEACHER_LIMIT+1||
   rows.results.some(row=>!row||!validRow(row)))
  return {status:503,code:'STAFF_TEACHERS_UNAVAILABLE'} as const;
 const teachers:AdminTeacher[]=rows.results.slice(0,ADMIN_TEACHER_LIMIT).map(row=>({
  id:row.id as string,name:(row.name as string).trim(),
  qualified:row.qualified===1,status:row.status as 'active'|'disabled',
  currentLearners:row.currentLearners as number,
  upcomingLessons:row.upcomingLessons as number,
 }));
 return {status:200,code:'STAFF_TEACHER_DIRECTORY',asOfMs:now,
  readOnly:true as const,teachers,
  truncated:rows.results.length>ADMIN_TEACHER_LIMIT} as const;
}
