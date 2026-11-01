import type {CoreDatabase} from './bindings.ts';

/** ADM-01: signed, D1-backed capability discovery, not a grant operation. */
export const VERIFIED_STAFF_CAPABILITIES_SQL = [
 'SELECT g.permission AS permission FROM staff_grants g',
 'JOIN accounts a ON a.auth_subject=g.auth_subject',
 'JOIN auth_users u ON u.id=g.auth_subject',
 'WHERE g.auth_subject=?',
 "AND g.permission IN ('roles.manage','attendance.review')",
 'AND g.revoked_at_ms IS NULL',
 "AND a.status='active'",
 'AND u.phone_number_verified=1',
 'ORDER BY g.permission',
].join('\n');

const SUBJECT=/^[A-Za-z0-9_-]{1,128}$/;
export type StaffCapabilities=Readonly<{manageTeachers:boolean;reviewAttendance:boolean}>;

export async function readStaffCapabilities(db:CoreDatabase,subject:string){
 if(!SUBJECT.test(subject))return {status:403,code:'STAFF_ACCESS_DENIED'} as const;
 const rows=await db.prepare(VERIFIED_STAFF_CAPABILITIES_SQL)
  .bind(subject).all<{permission:string}>();
 const grants=new Set(rows.results.map(row=>row.permission));
 const permissions:StaffCapabilities={
  manageTeachers:grants.has('roles.manage'),
  reviewAttendance:grants.has('attendance.review'),
 };
 if(!permissions.manageTeachers&&!permissions.reviewAttendance)
  return {status:403,code:'STAFF_ACCESS_DENIED'} as const;
 return {status:200,code:'STAFF_CAPABILITIES',permissions} as const;
}
