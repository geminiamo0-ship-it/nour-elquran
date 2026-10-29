/** Next static export emits a trailing slash; do not route connected user
 * to an unrelated empty page because the URL is canonicalized.
 */
export function teacherRoute(pathname:string){
  if(!pathname.startsWith('/teacher'))return pathname;
  return pathname.replace(/\/+$/,'')||'/';
}
