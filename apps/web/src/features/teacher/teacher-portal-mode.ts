export type TeacherPortalMode='checking'|'connected'|'error'|'signed-out';
/** Fail closed: never replace an unavailable account or missing service
 * with fixture-based Sheikh profiles at the public /teacher route.
 */
export function resolveTeacherPortalMode(enabled:boolean,sessionStatus:string):TeacherPortalMode{
 if(!enabled)return 'error';
 if(sessionStatus==='authenticated')return 'connected';
 if(sessionStatus==='signed-out')return 'signed-out';
 if(sessionStatus==='checking')return 'checking';
 return 'error';
}
