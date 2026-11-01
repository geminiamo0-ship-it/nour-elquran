import {describe,it,expect} from 'vitest';
import {clearOwnerSnapshot,OWNER_UI_CACHE_MS,readOwnerSnapshot,writeOwnerSnapshot}
 from './account-cache';

const student='10b4e832-c325-4da9-8cff-e1f10d209156';
const state={status:'authenticated' as const,
 session:{user:{id:'account-one',name:'Guardian One'},phoneVerified:false},
 learners:[{id:student,name:'Child A',learnerType:'child' as const,revision:1}]};
function memory(){
 const values=new Map<string,string>();
 const storage={getItem:(key:string)=>values.get(key)??null,
  setItem:(key:string,v:string)=>{values.set(key,v);},
  removeItem:(key:string)=>{values.delete(key);}};
 return {storage,values};
}
describe('tab-only bounded student UI cache (never an auth credential)',()=>{
 it('warms a valid learner snapshot while preserving identity',()=>{
  const {storage,values}=memory();
  writeOwnerSnapshot(storage,state,1000);
  expect(readOwnerSnapshot(storage,1001)).toEqual(state);
  const raw=[...values.values()][0]??'';
  expect(raw).not.toContain('token');
  expect(raw).not.toContain('password');
  expect(raw).not.toContain('cookie');
 });
 it('expires after five minutes, rejects future, corrupted and untrusted fields',()=>{
  const {storage,values}=memory();
  writeOwnerSnapshot(storage,state,1000);
  expect(readOwnerSnapshot(storage,1000+OWNER_UI_CACHE_MS+1)).toBeNull();
  expect(readOwnerSnapshot(storage,999)).toBeNull();
  const key=[...values.keys()][0]!;
  values.set(key,'not json');
  expect(readOwnerSnapshot(storage,1001)).toBeNull();
  values.set(key,JSON.stringify({savedAt:1000,...state,
   learners:[{...state.learners[0],id:'not-a-server-learner'}]}));
  expect(readOwnerSnapshot(storage,1001)).toBeNull();
 });
 it('explicit logout removes cached identity and never writes signed-out state',()=>{
  const {storage,values}=memory();writeOwnerSnapshot(storage,state,1000);
  clearOwnerSnapshot(storage);
  expect(values.size).toBe(0);
  writeOwnerSnapshot(storage,{status:'signed-out'},1001);
  expect(values.size).toBe(0);
 });
});
