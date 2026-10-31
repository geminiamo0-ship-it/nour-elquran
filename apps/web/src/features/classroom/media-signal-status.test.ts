import {describe,it,expect} from 'vitest';
import {remoteMediaStatus} from './media-signal-status';
describe('LiveKit peer stream diagnostics',()=>{
 it('does not call signaling success a received video or microphone',()=>{
  const status=remoteMediaStatus({audio:false,video:false},false);
  expect(status).toContain('غير مستلم');
  expect(status).not.toContain('مسار الصوت مستلم');
 });
 it('distinguishes subscribed media from autoplay permission',()=>{
  expect(remoteMediaStatus({audio:true,video:true},false)).toContain('مسار الصوت مستلم');
  expect(remoteMediaStatus({audio:true,video:true},true)).toContain('اضغط تشغيل الصوت');
 });
 it('reports audio-only or video-only explicitly',()=>{
  expect(remoteMediaStatus({audio:true,video:false},false)).toContain('فيديو الطرف الآخر غير مستلم');
  expect(remoteMediaStatus({audio:false,video:true},false)).toContain('صوت الطرف الآخر غير مستلم');
 });
});
