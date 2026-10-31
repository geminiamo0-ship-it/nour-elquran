/** Distinguish a successful LiveKit room connection from actual media reception. */
export type RemoteTrackState=Readonly<{audio:boolean;video:boolean}>;
export function remoteMediaStatus(tracks:RemoteTrackState,audioGestureBlocked:boolean):string{
 const video=tracks.video?'مسار الفيديو مستلم':'فيديو الطرف الآخر غير مستلم';
 const audio=tracks.audio
  ?audioGestureBlocked?'الصوت مستلم؛ اضغط تشغيل الصوت':'مسار الصوت مستلم'
  :'صوت الطرف الآخر غير مستلم';
 return video+' · '+audio;
}
