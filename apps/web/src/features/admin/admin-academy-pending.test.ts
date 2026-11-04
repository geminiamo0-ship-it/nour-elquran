import {describe,expect,it} from 'vitest';
import {createAcademyPendingStore} from './admin-academy-pending';

const first=()=>({actorId:'synthetic-staff-a',path:'activate',
 payload:{operationId:'44444444-4444-4444-8444-444444444444',
  learnerId:'11111111-1111-4111-8111-111111111111',note:'synthetic only'}});

describe('academy pending settlement fence across component remount #315',()=>{
 it('keeps exact operation and payload across same-actor remount, without browser storage',()=>{
  const store=createAcademyPendingStore();
  const pending=first();
  expect(store.hold(pending)).toBe(true);
  // A new component instance can recover the exact original reference.
  expect(store.forActor('synthetic-staff-a')).toBe(pending);
  expect(store.hold({...pending})).toBe(false);
  expect(store.hold(pending)).toBe(true);
  store.clearIfSame({...pending});
  expect(store.forActor('synthetic-staff-a')).toBe(pending);
  store.clearIfSame(pending);
  expect(store.forActor('synthetic-staff-a')).toBeNull();
 });
 it('prevents a remounted panel from racing the original in-flight POST',()=>{
  const store=createAcademyPendingStore();
  const pending=first();
  const originalAttempt={};
  const retryAttempt={};
  expect(store.hold(pending)).toBe(true);
  expect(store.beginAttempt(pending,originalAttempt)).toBe(true);
  expect(store.forActor('synthetic-staff-a')).toBe(pending);
  expect(store.beginAttempt(pending,retryAttempt)).toBe(false);
  store.finishAttempt({}); // unrelated request cannot unlock the original
  expect(store.beginAttempt(pending,retryAttempt)).toBe(false);
  store.finishAttempt(originalAttempt);
  expect(store.beginAttempt(pending,retryAttempt)).toBe(true);
  store.clearIfSame(pending);
  expect(store.forActor('synthetic-staff-a')).toBeNull();
  store.finishAttempt(retryAttempt);
 });
 it('discards the old actor payload on account switch and protects newer attempts',()=>{
  const store=createAcademyPendingStore();
  const old=first();
  const next={actorId:'synthetic-staff-b',path:'activate',payload:{operationId:'new'}};
  store.hold(old);
  const oldAttempt={};
  expect(store.beginAttempt(old,oldAttempt)).toBe(true);
  expect(store.forActor('synthetic-staff-b')).toBeNull();
  expect(store.hold(next)).toBe(true);
  const nextAttempt={};
  expect(store.beginAttempt(next,nextAttempt)).toBe(true);
  store.finishAttempt(oldAttempt); // old finally cannot unlock new POST
  expect(store.beginAttempt(next,{})).toBe(false);
  store.clearIfSame(old); // late old ACK cannot erase new actor
  expect(store.forActor('synthetic-staff-b')).toBe(next);
  store.finishAttempt(nextAttempt);
 });
 it('does not claim survival of a full reload or a separate tab',()=>{
  const current=createAcademyPendingStore();
  current.hold(first());
  expect(createAcademyPendingStore().forActor('synthetic-staff-a')).toBeNull();
 });
});
