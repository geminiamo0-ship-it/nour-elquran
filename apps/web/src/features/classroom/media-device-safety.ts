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
