import {describe,expect,it,vi} from 'vitest';
import {createRoomGenerationGuard,resumeRemoteAudioIfCurrent,setDeviceWithEpochGuard,stopLocalCaptureBestEffort,stopRemotePlaybackBestEffort} from './media-device-safety';

describe('LiveKit device permission race safety (#221)',()=>{
  it('commits a toggle only for the same active room generation',async()=>{
    const apply=vi.fn(async(enabled:boolean)=>({enabled}));
    expect(await setDeviceWithEpochGuard(true,apply,()=>true))
      .toEqual({current:true,value:{enabled:true}});
    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledWith(true);
  });

  it('stops a late camera track and disables capture after Stop/leave',async()=>{
    let resolvePermission!:()=>void;
    const permission=new Promise<void>(resolve=>{resolvePermission=resolve;});
    let current=true;
    let capturing=false;
    const stop=vi.fn();
    const apply=vi.fn(async(enabled:boolean)=>{
      if(enabled)await permission;
      capturing=enabled;
      return {videoTrack:{stop}};
    });
    const pending=setDeviceWithEpochGuard(true,apply,()=>current,
      publication=>publication.videoTrack.stop());
    current=false;
    resolvePermission();
    expect(await pending).toEqual({current:false});
    expect(stop).toHaveBeenCalledOnce();
    expect(apply.mock.calls.map(call=>call[0])).toEqual([true,false]);
    expect(capturing).toBe(false);
  });

  it('stops a late microphone track even if disconnected Room rejects disable',async()=>{
    const stop=vi.fn();
    const apply=vi.fn(async(enabled:boolean)=>{
      if(!enabled)throw new Error('room already disconnected');
      return {audioTrack:{stop}};
    });
    await expect(setDeviceWithEpochGuard(true,apply,()=>false,
      publication=>publication.audioTrack.stop())).resolves.toEqual({current:false});
    expect(stop).toHaveBeenCalledOnce();
    expect(apply.mock.calls.map(call=>call[0])).toEqual([true,false]);
  });

  it('disables stale capture even when the returned track has already been disposed',async()=>{
    const stop=vi.fn(()=>{throw new Error('track already disposed');});
    const apply=vi.fn(async(enabled:boolean)=>({enabled}));
    await expect(setDeviceWithEpochGuard(true,apply,()=>false,stop))
      .resolves.toEqual({current:false});
    expect(stop).toHaveBeenCalledOnce();
    expect(apply.mock.calls.map(call=>call[0])).toEqual([true,false]);
  });

  it('tries to disable stale capture when the SDK returns no track publication',async()=>{
    const apply=vi.fn(async(enabled:boolean)=>{void enabled;return undefined;});
    const stop=vi.fn();
    await expect(setDeviceWithEpochGuard(true,apply,()=>false,stop))
      .resolves.toEqual({current:false});
    expect(stop).toHaveBeenCalledWith(undefined);
    expect(apply.mock.calls.map(call=>call[0])).toEqual([true,false]);
  });

  it('does not re-enable devices for stale disable operations',async()=>{
    const apply=vi.fn(async(enabled:boolean)=>{void enabled;return undefined;});
    expect(await setDeviceWithEpochGuard(false,apply,()=>false))
      .toEqual({current:false});
    expect(apply.mock.calls.map(call=>call[0])).toEqual([false]);
  });

  it('disables stale capture if the SDK rejects after capture begins',async()=>{
    let rejectPermission!:(error:Error)=>void;
    const permission=new Promise<void>((_,reject)=>{rejectPermission=reject;});
    let current=true;
    let capturing=false;
    const apply=vi.fn(async(enabled:boolean)=>{
      if(enabled){
        capturing=true;
        await permission;
      }else capturing=false;
      return undefined;
    });
    const pending=setDeviceWithEpochGuard(true,apply,()=>current);
    current=false;
    rejectPermission(new Error('disconnected during grant'));
    await expect(pending).rejects.toThrow('disconnected during grant');
    expect(apply.mock.calls.map(call=>call[0])).toEqual([true,false]);
    expect(capturing).toBe(false);
  });

  it('preserves the original stale SDK rejection if cleanup also fails',async()=>{
    const apply=vi.fn(async(enabled:boolean)=>{
      throw new Error(enabled?'original enable failure':'cleanup failure');
    });
    await expect(setDeviceWithEpochGuard(true,apply,()=>false))
      .rejects.toThrow('original enable failure');
    expect(apply.mock.calls.map(call=>call[0])).toEqual([true,false]);
  });

  it('does not issue an extra disable after a current SDK rejection',async()=>{
    const apply=vi.fn(async(enabled:boolean)=>{
      if(enabled)throw new Error('permission denied');
      return undefined;
    });
    await expect(setDeviceWithEpochGuard(true,apply,()=>true))
      .rejects.toThrow('permission denied');
    expect(apply.mock.calls.map(call=>call[0])).toEqual([true]);
  });

  it('preserves a late rejected permission and attempts old-room cleanup',async()=>{
    const apply=vi.fn(async(enabled:boolean)=>{void enabled;throw new Error('denied');});
    await expect(setDeviceWithEpochGuard(true,apply,()=>false))
      .rejects.toThrow('denied');
    expect(apply.mock.calls.map(call=>call[0])).toEqual([true,false]);
  });
});

describe('Room-scoped remote audio resume (#221)',()=>{
  it('never plays new-room audio when an old startAudio finishes after leave',async()=>{
    let resolveStart!:()=>void;
    const start=new Promise<void>(resolve=>{resolveStart=resolve;});
    let current=true;
    const play=vi.fn(async()=>{});
    const list=vi.fn(()=>[{play,pause:vi.fn()}]);
    const pending=resumeRemoteAudioIfCurrent(()=>start,()=>current,list);
    current=false;
    resolveStart();
    await expect(pending).resolves.toBe(false);
    expect(list).not.toHaveBeenCalled();
    expect(play).not.toHaveBeenCalled();
  });
  it('stops playback sequence when Stop occurs during first play',async()=>{
    let current=true;
    const first=vi.fn(async()=>{current=false;});
    const second=vi.fn(async()=>{});
    await expect(resumeRemoteAudioIfCurrent(async()=>{},()=>current,()=>[{play:first,pause:vi.fn()},{play:second,pause:vi.fn()}]))
      .resolves.toBe(false);
    expect(first).toHaveBeenCalledOnce();
    expect(second).not.toHaveBeenCalled();
  });
  it('pauses only the old audio element if Stop happens during pending play',async()=>{
    let finish!:()=>void;
    let signalStarted!:()=>void;
    const started=new Promise<void>(resolve=>{signalStarted=resolve;});
    const pendingPlay=new Promise<void>(resolve=>{finish=resolve;});
    let current=true;
    const play=vi.fn(()=>{signalStarted();return pendingPlay;});
    const pause=vi.fn();
    const pending=resumeRemoteAudioIfCurrent(async()=>{},()=>current,
      ()=>[{play,pause}]);
    await started;
    current=false;
    finish();
    await expect(pending).resolves.toBe(false);
    expect(pause).toHaveBeenCalledOnce();
  });
  it('pauses a stale element even if pending play rejects after Stop',async()=>{
    let rejectPlay!:(error:Error)=>void;
    let signalStarted!:()=>void;
    const started=new Promise<void>(resolve=>{signalStarted=resolve;});
    const pendingPlay=new Promise<void>((_,reject)=>{rejectPlay=reject;});
    let current=true;
    const pause=vi.fn();
    const pending=resumeRemoteAudioIfCurrent(async()=>{},()=>current,
      ()=>[{play:()=>{signalStarted();return pendingPlay;},pause}]);
    await started;
    current=false;
    rejectPlay(new Error('play aborted'));
    await expect(pending).rejects.toThrow('play aborted');
    expect(pause).toHaveBeenCalledOnce();
  });
  it('resumes explicitly requested audio for the still-current Room',async()=>{
    const play=vi.fn(async()=>{});
    await expect(resumeRemoteAudioIfCurrent(async()=>{},()=>true,()=>[{play,pause:vi.fn()}]))
      .resolves.toBe(true);
    expect(play).toHaveBeenCalledOnce();
  });
});

describe('LiveKit event identity after disconnect (#221)',()=>{
  it('rejects queued old-room tracks and reconnect events after disconnect/rejoin',()=>{
    const oldRoom={id:'old'};
    const newRoom={id:'new'};
    let currentRoom:typeof oldRoom|null=oldRoom;
    const generation=7;
    const oldEventAllowed=createRoomGenerationGuard(
      oldRoom,7,()=>currentRoom,()=>generation,
    );
    const attached=vi.fn();
    const onSubscribed=()=>{if(oldEventAllowed())attached();};
    onSubscribed();
    expect(attached).toHaveBeenCalledOnce();
    currentRoom=null; // SDK Disconnected clears the Room ref
    onSubscribed();
    currentRoom=newRoom; // a fresh join can happen before queued events run
    onSubscribed();
    expect(oldEventAllowed()).toBe(false);
    expect(attached).toHaveBeenCalledOnce();
  });

  it('rejects an old generation even if the same Room reference is reused',()=>{
    const media={id:'room'};
    let generation=4;
    const isCurrent=createRoomGenerationGuard(media,4,()=>media,()=>generation);
    expect(isCurrent()).toBe(true);
    generation++;
    expect(isCurrent()).toBe(false);
  });
});

describe('Local capture teardown on unexpected LiveKit disconnect (#221)',()=>{
  it('stops every published track synchronously even when one stop throws',()=>{
    const first=vi.fn(()=>{throw new Error('already disposed');});
    const second=vi.fn();
    const disableMic=vi.fn(async()=>{throw new Error('room closed');});
    const disableCamera=vi.fn(async()=>{throw new Error('room closed');});
    stopLocalCaptureBestEffort([{stop:first},undefined,{stop:second}],disableMic,disableCamera);
    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
    expect(disableMic).toHaveBeenCalledOnce();
    expect(disableCamera).toHaveBeenCalledOnce();
  });
  it('still requests both SDK disables when one call throws synchronously',()=>{
    const disableMic=vi.fn(()=>{throw new Error('disconnected');}) as () => Promise<unknown>;
    const disableCamera=vi.fn(async()=>{});
    stopLocalCaptureBestEffort([],disableMic,disableCamera);
    expect(disableMic).toHaveBeenCalledOnce();
    expect(disableCamera).toHaveBeenCalledOnce();
  });
});


describe('Remote media playback cleanup on leave and participant loss (#221)',()=>{
  it('pauses, releases and removes both audio and video media elements',()=>{
    const audio={pause:vi.fn(),srcObject:{stream:'audio'} as unknown,remove:vi.fn()};
    const video={pause:vi.fn(),srcObject:{stream:'video'} as unknown,remove:vi.fn()};
    stopRemotePlaybackBestEffort([audio,video]);
    for(const element of [audio,video]){
      expect(element.pause).toHaveBeenCalledOnce();
      expect(element.srcObject).toBeNull();
      expect(element.remove).toHaveBeenCalledOnce();
    }
  });
  it('still releases and removes media if pause fails, and continues to next element',()=>{
    const first={pause:vi.fn(()=>{throw new Error('detached');}),srcObject:{} as unknown,remove:vi.fn()};
    const second={pause:vi.fn(),srcObject:{} as unknown,remove:vi.fn()};
    stopRemotePlaybackBestEffort([first,second]);
    expect(first.srcObject).toBeNull();
    expect(first.remove).toHaveBeenCalledOnce();
    expect(second.pause).toHaveBeenCalledOnce();
    expect(second.srcObject).toBeNull();
    expect(second.remove).toHaveBeenCalledOnce();
  });
  it('still removes a detached element when clearing its srcObject throws',()=>{
    const remove=vi.fn();
    const element={pause:vi.fn(),get srcObject():unknown{return 'stream';},
      set srcObject(_value:unknown){throw new Error('not writable');},remove};
    stopRemotePlaybackBestEffort([element]);
    expect(element.pause).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledOnce();
  });
});
