/** A local LiveKit device permission prompt can resolve after Stop/leave.
 * Keep the result only for the same still-connected Room generation.
 * A stale successful enable must stop its new track and try to disable it.
 * The caller must independently disconnect the old Room on Stop.
 */
export async function setDeviceWithEpochGuard<T>(
  enabled: boolean,
  apply: (enabled: boolean) => Promise<T>,
  isCurrent: () => boolean,
  stopLateTrack?: (value: T) => void,
): Promise<{current: true; value: T} | {current: false}> {
  let value: T;
  try {
    value = await apply(enabled);
  } catch (error) {
    // A device can start capturing before the SDK rejects (e.g. disconnect
    // during an asynchronous permission grant). Never leave that stale Room
    // with a potentially active device merely because no track was returned.
    if (enabled && !isCurrent()) {
      try { await apply(false); } catch { /* old Room may already be gone */ }
    }
    throw error;
  }
  if (!isCurrent()) {
    if (enabled) {
      // A browser permission dialog may have completed after Room.disconnect().
      try { stopLateTrack?.(value); } catch { /* cleanup best effort */ }
      try { await apply(false); } catch { /* old Room may be disconnected */ }
    }
    return {current: false};
  }
  return {current: true, value};
}

/** An old Room's pending startAudio must never play a newly joined Room's tracks. */
export async function resumeRemoteAudioIfCurrent(
  startAudio: () => Promise<void>,
  isCurrent: () => boolean,
  audioPlays: () => Iterable<{play: () => Promise<unknown>; pause: () => void}>,
): Promise<boolean> {
  await startAudio();
  if (!isCurrent()) return false;
  for (const audio of audioPlays()) {
    if (!isCurrent()) return false;
    try {
      await audio.play();
    } finally {
      // An in-flight HTMLMediaElement.play() can settle after Stop/leave.
      // The room teardown already paused it, but a late play may resume it.
      // Pause only the captured old element, never the newly joined room.
      if (!isCurrent()) {
        try { audio.pause(); } catch { /* element already detached */ }
      }
    }
  }
  return isCurrent();
}

/** A LiveKit event belongs to the active Room AND its original generation.
 * A disconnected Room can emit queued events after a new Room is assigned.
 */
export function createRoomGenerationGuard<TRoom>(
  expectedRoom: TRoom,
  expectedGeneration: number,
  readRoom: () => TRoom | null,
  readGeneration: () => number,
): () => boolean {
  return () => readRoom() === expectedRoom && readGeneration() === expectedGeneration;
}

/** Detaching a remote media element from the DOM does not guarantee playback
 * stops immediately. Pause, release its MediaStream and remove it independently,
 * including if an earlier cleanup step throws. Never stop a remote provider track.
 */
export function stopRemotePlaybackBestEffort(
  elements: Iterable<{pause: () => void; srcObject: unknown; remove: () => void}>,
): void {
  for (const element of elements) {
    try { element.pause(); } catch { /* already disposed */ }
    try { element.srcObject = null; } catch { /* browser may reject */ }
    try { element.remove(); } catch { /* detached */ }
  }
}

/** On explicit Stop or unexpected provider disconnect, revoke local capture
 * immediately, even if the SDK's asynchronous disable rejects on a dead Room.
 * Each track/operation is independent so one failure cannot strand the other.
 */
export function stopLocalCaptureBestEffort(
  tracks: Iterable<{stop: () => void} | null | undefined>,
  disableMicrophone: () => Promise<unknown>,
  disableCamera: () => Promise<unknown>,
): void {
  for (const track of tracks) {
    try { track?.stop(); } catch { /* disposed track; continue */ }
  }
  try { void disableMicrophone().catch(() => {}); } catch { /* disconnected */ }
  try { void disableCamera().catch(() => {}); } catch { /* disconnected */ }
}
