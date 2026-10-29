export function normalizePhone(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  let phone = value.trim().replace(/[ ()-]/g, '');
  if (/^01[0125][0-9]{8}$/.test(phone)) phone = '+2' + phone;
  return /^\+[1-9][0-9]{7,14}$/.test(phone) ? phone : null;
}
export function validName(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 80;
}
export function onlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).every(key => keys.includes(key));
}
export async function readObject(request: Request, maxBytes = 16384): Promise<Record<string, unknown> | null> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json') || !request.body) return null;
  const reader = request.body.getReader();
  let bytes = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.length;
      if (bytes > maxBytes) { await reader.cancel(); return null; }
      chunks.push(part.value);
    }
    const buffer = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.length; }
    const value: unknown = JSON.parse(new TextDecoder().decode(buffer));
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown> : null;
  } catch { return null; }
}

