import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {parseInboxAction} from '../src/in-app-inbox.ts';
const v={notificationId:'a'.repeat(32),operationId:'2145a6fa-1d94-4994-91e7-5819692ba3b6',
 action:'read',expectedRevision:0};
test('signed inbox mutation parses exact CAS envelope; never trusts client actor',()=>{
 assert.deepEqual(parseInboxAction(v),v);
 assert.deepEqual(parseInboxAction({...v,action:'unread',expectedRevision:1}),
  {...v,action:'unread',expectedRevision:1});
 for(const bad of [
  {...v,actorSubject:'teacher-a'},
  {...v,learnerId:'sibling'},
  {...v,notificationId:'invalid'},
  {...v,notificationId:'A'.repeat(32)},
  {...v,operationId:'not-a-uuid'},
  {...v,action:'delete'},
  {...v,expectedRevision:-1},
  {...v,expectedRevision:1.5},
  {...v,expectedRevision:'0'},
  null,[]
 ])assert.equal(parseInboxAction(bad),null,JSON.stringify(bad));
});
