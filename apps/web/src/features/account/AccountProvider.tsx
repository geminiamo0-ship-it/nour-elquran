'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AccountError, accountErrorMessage, createAccountClient, type AccountLearner, type Credentials, type Registration, type LearnerProfileAction } from './api';
import { canApplyResult, type AccountState } from './state';

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
  const begin = useCallback(() => {
    controller.current?.abort(); controller.current = new AbortController();
    const id = ++lease.current;
    setState({ status: 'checking' });
    return { id, signal: controller.current.signal };
  }, []);
  const fail = useCallback((error: unknown, id: number) => {
    if (!canApplyResult(lease.current, id)) return;
    setState(error instanceof AccountError && error.status === 401
      ? { status: 'signed-out' } : { status: 'error', message: accountErrorMessage(error) });
  }, []);
  const refresh = useCallback(async () => {
    if (!ACCOUNT_UI_ENABLED) return;
    const { id, signal } = begin();
    try {
      const session = await client.session(signal), learners = await client.learners(signal);
      if (canApplyResult(lease.current, id)) setState({ status: 'authenticated', session, learners });
    } catch (error) { fail(error, id); }
  }, [begin, fail]);
  useEffect(() => {
    if (!ACCOUNT_UI_ENABLED) return;
    void refresh();
    const wake = () => { if (document.visibilityState === 'visible') void refresh(); };
    window.addEventListener('pageshow', wake);
    document.addEventListener('visibilitychange', wake);
    if (typeof BroadcastChannel !== 'undefined') {
      channel.current = new BroadcastChannel('noor-account-session');
      channel.current.onmessage = () => { void refresh(); };
    }
    return () => {
      ++lease.current; controller.current?.abort(); channel.current?.close();
      window.removeEventListener('pageshow', wake); document.removeEventListener('visibilitychange', wake);
    };
  }, [refresh]);

  async function authenticate(input: Credentials | Registration, register: boolean) {
    const { id, signal } = begin();
    try {
      const session = register ? await client.register(input as Registration) : await client.login(input);
      const learners = await client.learners(signal);
      if (!canApplyResult(lease.current, id)) throw new AccountError('SESSION_CHANGED');
      setState({ status: 'authenticated', session, learners }); channel.current?.postMessage('changed');
    } catch (error) { fail(error, id); throw error; }
  }
  async function logout() {
    const { id } = begin();
    try {
      await client.logout();
      if (canApplyResult(lease.current, id)) { setState({ status: 'signed-out' }); channel.current?.postMessage('changed'); }
    } catch (error) { fail(error, id); throw error; }
  }
  async function createLearner(input: Pick<AccountLearner, 'name' | 'learnerType'>) {
    if (mutation.current) throw new AccountError('BUSY');
    const id = lease.current;
    mutation.current = true;
    try {
      const learner = await client.createLearner(input);
      if (!canApplyResult(lease.current, id)) throw new AccountError('SESSION_CHANGED');
      setState(current => current.status === 'authenticated'
        ? { ...current, learners: [...current.learners.filter(row => row.id !== learner.id), learner] } : current);
      return learner;
    } catch (error) {
      if (canApplyResult(lease.current, id) && error instanceof AccountError && (error.status === 401 || error.status === 403)) {
        ++lease.current; setState({ status: 'signed-out' }); channel.current?.postMessage('changed');
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
      channel.current?.postMessage('changed');
    } catch(error) {
      if(canApplyResult(lease.current,requestLease) && error instanceof AccountError &&
          (error.status===401 || error.status===403)){
        ++lease.current;setState({status:'signed-out'});channel.current?.postMessage('changed');
      }
      throw error;
    } finally {mutation.current=false;}
  }
  const value: AccountContextValue = { state, refresh, logout, createLearner, profileAction,
    login: input => authenticate(input, false), register: input => authenticate(input, true) };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useAccount(): AccountContextValue {
  const value = useContext(Context);
  if (!value && ACCOUNT_UI_ENABLED) throw new Error('AccountProvider required');
  return value ?? disabled;
}
