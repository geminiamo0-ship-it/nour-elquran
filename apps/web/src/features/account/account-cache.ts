/** Bounded, tab-scoped UI snapshot; never a session credential or grant.
 * Server D1 remains authority for every protected request and staff action.
 */
import {parseLearners,parseSession} from './api';
import type {AccountState} from './state';

const KEY='noor:owner:ui:v1';
export const OWNER_UI_CACHE_MS=5*60*1000;
export function readOwnerSnapshot(storage:Pick<Storage,'getItem'>,now=Date.now()):AccountState|null{
 try{
  const raw=storage.getItem(KEY);
  if(!raw||raw.length>12000)return null;
  const item:unknown=JSON.parse(raw);
  if(!item||typeof item!=='object'||Array.isArray(item))return null;
  const d=item as Record<string,unknown>;
  if(!Number.isSafeInteger(d.savedAt)||typeof d.savedAt!=='number'||
   now<d.savedAt||now-d.savedAt>OWNER_UI_CACHE_MS)return null;
  const session=parseSession(d.session);
  const learners=parseLearners({learners:d.learners});
  return {status:'authenticated',session,learners};
 }catch{return null;}
}
export function writeOwnerSnapshot(storage:Pick<Storage,'setItem'>,
 state:AccountState,now=Date.now()):void{
 if(state.status!=='authenticated')return;
 try{
  storage.setItem(KEY,JSON.stringify({savedAt:now,session:state.session,
   learners:state.learners}));
 }catch{/* browsers may disable sessionStorage; no auth policy depends on this */}
}
export function clearOwnerSnapshot(storage:Pick<Storage,'removeItem'>):void{
 try{storage.removeItem(KEY);}catch{/* fail closed on API requests regardless */}
}
