/** #302: signed administrative overview, aggregate facts only.
 * No learner identities, private notes, payment or consent data can leave here.
 * The caller role is checked from Better Auth + current D1 staff grant.
 */
import type {CoreDatabase} from './bindings.ts';
import {canManageTeachers} from './staff-teachers.ts';

export type StaffOverviewCounts=Readonly<{
 activeLearners:number;
 activeQualifiedTeachers:number;
 upcomingLessons:number;
 completedLessons:number;
}>;
const COUNT_KEYS=['activeLearners','activeQualifiedTeachers',
 'upcomingLessons','completedLessons'] as const;

export const STAFF_OVERVIEW_SQL=`
 SELECT (SELECT COUNT(*) FROM learners WHERE status='active') AS activeLearners,
 (SELECT COUNT(*) FROM teachers WHERE status='active' AND qualified=1)
  AS activeQualifiedTeachers,
 (SELECT COUNT(*) FROM lessons
   WHERE status='scheduled' AND starts_at_ms>=?) AS upcomingLessons,
 (SELECT COUNT(*) FROM lessons WHERE status='completed') AS completedLessons
`;

export async function readStaffOverview(db:CoreDatabase,subject:string,now=Date.now()){
 if(!Number.isSafeInteger(now)||now<0)
  return {status:503,code:'CLOCK_UNAVAILABLE'} as const;
 if(!await canManageTeachers(db,subject))
  return {status:403,code:'STAFF_ACCESS_DENIED'} as const;
 const row=await db.prepare(STAFF_OVERVIEW_SQL).bind(now).first<StaffOverviewCounts>();
 if(!row||COUNT_KEYS.some(key=>!Number.isSafeInteger(row[key])||row[key]<0))
  return {status:503,code:'STAFF_OVERVIEW_UNAVAILABLE'} as const;
 return {status:200,code:'STAFF_OVERVIEW',asOfMs:now,
  metrics:{
   activeLearners:row.activeLearners,
   activeQualifiedTeachers:row.activeQualifiedTeachers,
   upcomingLessons:row.upcomingLessons,
   completedLessons:row.completedLessons,
  },
  readOnly:true as const,
 } as const;
}
