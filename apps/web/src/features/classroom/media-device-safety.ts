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
  const value = await apply(enabled);
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
