export type TeacherPortalMode='preview'|'checking'|'connected'|'error';
/** Public demo is ONLY shown to anonymous viewers, never signed-in denied teachers. */
export function resolveTeacherPortalMode(enabled:boolean,sessionStatus:string):TeacherPortalMode {
  if(!enabled)return 'preview';
  if(sessionStatus==='authenticated')return 'connected';
  if(sessionStatus==='signed-out')return 'preview';
  if(sessionStatus==='checking')return 'checking';
  return 'error';
}
