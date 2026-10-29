import type { Env } from '../bindings.ts';
export function authSettings(env: Env): { origin: string; local: boolean; secret: string } | null {
  if (env.AUTH_ENABLED !== 'true' || !env.AUTH_SECRET || env.AUTH_SECRET.length < 32 || !env.AUTH_ORIGIN) return null;
  try {
    const url = new URL(env.AUTH_ORIGIN);
    const local = env.AUTH_LOCAL_DEV === 'true' && url.protocol === 'http:' &&
      (url.hostname === '127.0.0.1' || url.hostname === 'localhost');
    if ((!local && url.protocol !== 'https:') || url.username || url.password ||
      url.origin !== env.AUTH_ORIGIN) return null;
    return { origin: url.origin, local, secret: env.AUTH_SECRET };
  } catch { return null; }
}

