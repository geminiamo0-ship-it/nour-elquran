'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AccountError, accountErrorMessage, createAccountClient, type AccountLearner, type Credentials, type Registration, type LearnerProfileAction } from './api';
import { canApplyResult, type AccountState } from './state';
import {clearOwnerSnapshot,OWNER_UI_CACHE_MS,readOwnerSnapshot,writeOwnerSnapshot} from './account-cache';

import { ACCOUNT_UI_ENABLED } from './config';
const client = createAccountClient();
type AccountContextValue = {
  state: AccountState; refresh: () => Promise<void>;
  login: (input: Credentials) => Promise<void>; register: (input: Registration) => Promise<void>;
  logout: () => Promise<void>;
  createLearner: (input: Pick<AccountLearner, 'name' | 'learnerType'>) => Promise<AccountLearner>;
  profileAction: (learnerId:string, input:LearnerProfileAction) => Promise<void>;
};
const Context = createContext<AccountContextValue | null>(null);
const disabled: AccountContextValue = { state: { status: 'disabled' }, refresh: async () => {},
  login: async () => { throw new AccountError('DISABLED'); }, register: async () => { throw new AccountError('DISABLED'); },
  logout: async () => {}, createLearner: async () => { throw new AccountError('DISABLED'); },
  profileAction: async () => { throw new AccountError('DISABLED'); } };

export function AccountProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AccountState>({ status: ACCOUNT_UI_ENABLED ? 'checking' : 'disabled' });
  const lease = useRef(0), controller = useRef<AbortController | null>(null);
  const channel = useRef<BroadcastChannel | null>(null), mutation = useRef(false);
  const verifiedAt=useRef(0), verifying=useRef(false);
  const begin = useCallback((preserveAuthenticated=false) => {
    controller.current?.abort();controller.current=new AbortController();
    verifying.current=false;
    const id=++lease.current;
    setState(current=>preserveAuthenticated&&current.status==='authenticated'
      ?current:{status:'checking'});
    return {id,signal:controller.current.signal};
  }, []);
  const fail = useCallback((error: unknown, id: number) => {
    if (!canApplyResult(lease.current, id)) return;
    // Network errors must not erase a still-visible signed UI snapshot.
    // Any confirmed 401/403 revokes it immediately; protected APIs continue
    // checking live D1 independently, even while offline.
    if(error instanceof AccountError&&(error.status===401||error.status===403)){
      clearOwnerSnapshot(window.sessionStorage);verifiedAt.current=0;
      setState({status:'signed-out'});return;
    }
    setState(current=>current.status==='authenticated'
     ?current:{status:'error',message:accountErrorMessage(error)});
  }, []);
  const refresh = useCallback(async (force=false) => {
    if(!ACCOUNT_UI_ENABLED||verifying.current&&!force)return;
    const {id,signal}=begin(!force);
    verifying.current=true;
    try {
      const session=await client.session(signal);
      const learners=await client.learners(signal);
      if(canApplyResult(lease.current,id)){
        const next:AccountState={status:'authenticated',session,learners};
        setState(next);
        writeOwnerSnapshot(window.sessionStorage,next);
        verifiedAt.current=Date.now();
      }
    }catch(error){fail(error,id);}
    finally{if(canApplyResult(lease.current,id))verifying.current=false;}
  },[begin,fail]);
  useEffect(()=>{
    if(!ACCOUNT_UI_ENABLED)return;
    // One-time hydration is deliberately tab-only and capped at five minutes.
    // The server is revalidated immediately without blanking the student UI.
    const restored=readOwnerSnapshot(window.sessionStorage);
    if(restored){setState(restored);verifiedAt.current=0;}
    void refresh();
    const wake=()=>{
      if(document.visibilityState==='visible'&&
       Date.now()-verifiedAt.current>=OWNER_UI_CACHE_MS)void refresh();
    };
    window.addEventListener('pageshow',wake);
    document.addEventListener('visibilitychange',wake);
    if(typeof BroadcastChannel!=='undefined'){
      channel.current=new BroadcastChannel('noor-account-session');
      channel.current.onmessage=(event:MessageEvent)=>{
        if(event.data==='signed-out'){
          ++lease.current;controller.current?.abort();verifying.current=false;
          verifiedAt.current=0;clearOwnerSnapshot(window.sessionStorage);
          setState({status:'signed-out'});
        }else if(event.data==='changed'){
          verifiedAt.current=0;clearOwnerSnapshot(window.sessionStorage);
          void refresh(true);
        }else if(event.data==='updated'){
          verifiedAt.current=0;void refresh();
        }
      };
    }
    return()=>{
      ++lease.current;controller.current?.abort();verifying.current=false;
      channel.current?.close();
      window.removeEventListener('pageshow',wake);
      document.removeEventListener('visibilitychange',wake);
    };
  },[refresh]);

  async function authenticate(input: Credentials | Registration, register: boolean) {
    const { id, signal } = begin();
    try {
      const session = register ? await client.register(input as Registration) : await client.login(input);
      const learners = await client.learners(signal);
      if (!canApplyResult(lease.current, id)) throw new AccountError('SESSION_CHANGED');
      const next:AccountState={status:'authenticated',session,learners};
      setState(next);writeOwnerSnapshot(window.sessionStorage,next);
      verifiedAt.current=Date.now();verifying.current=false;
      channel.current?.postMessage('changed');
    } catch (error) { fail(error, id); throw error; }
  }
  async function logout() {
    const { id } = begin();
    try {
      await client.logout();
      if(canApplyResult(lease.current,id)){
        clearOwnerSnapshot(window.sessionStorage);verifiedAt.current=0;
        setState({status:'signed-out'});channel.current?.postMessage('signed-out');
      }
    } catch (error) { fail(error, id); throw error; }
  }
  async function createLearner(input: Pick<AccountLearner, 'name' | 'learnerType'>) {
    if (mutation.current) throw new AccountError('BUSY');
    const id = lease.current;
    mutation.current = true;
    try {
      const learner = await client.createLearner(input);
      if (!canApplyResult(lease.current, id)) throw new AccountError('SESSION_CHANGED');
      setState(current=>current.status==='authenticated'
        ?{...current,learners:[...current.learners.filter(row=>row.id!==learner.id),learner]}
        :current);
      return learner;
    } catch (error) {
      if (canApplyResult(lease.current, id) && error instanceof AccountError && (error.status === 401 || error.status === 403)) {
        ++lease.current;clearOwnerSnapshot(window.sessionStorage);
        setState({ status: 'signed-out' }); channel.current?.postMessage('signed-out');
      }
      throw error;
    } finally { mutation.current = false; }
  }
  async function profileAction(learnerId:string,input:LearnerProfileAction):Promise<void> {
    if (mutation.current) throw new AccountError('BUSY');
    if (state.status!=='authenticated' || !state.learners.some(row=>row.id===learnerId &&
        row.revision===input.expectedRevision))throw new AccountError('PROFILE_REVISION_CONFLICT',409);
    const requestLease=lease.current;
    mutation.current=true;
    try {
      const ack=await client.profileAction(learnerId,input);
      if(!canApplyResult(lease.current,requestLease))throw new AccountError('SESSION_CHANGED');
      setState(current=>current.status==='authenticated'?{
        ...current,learners:input.action==='archive'
          ? current.learners.filter(row=>row.id!==learnerId)
          : current.learners.map(row=>row.id===learnerId
            ? {...row,name:input.name,revision:ack.revision}:row),
      }:current);
      channel.current?.postMessage('updated');
    } catch(error) {
      if(canApplyResult(lease.current,requestLease) && error instanceof AccountError &&
          (error.status===401 || error.status===403)){
        ++lease.current;clearOwnerSnapshot(window.sessionStorage);
        setState({status:'signed-out'});channel.current?.postMessage('signed-out');
      }
      throw error;
    } finally {mutation.current=false;}
  }
  useEffect(()=>{if(state.status==='authenticated')writeOwnerSnapshot(window.sessionStorage,state);},
    [state]);
  const value: AccountContextValue = { state, refresh:()=>refresh(), logout, createLearner, profileAction,
    login: input => authenticate(input, false), register: input => authenticate(input, true) };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useAccount(): AccountContextValue {
  const value = useContext(Context);
  if (!value && ACCOUNT_UI_ENABLED) throw new Error('AccountProvider required');
  return value ?? disabled;
}
