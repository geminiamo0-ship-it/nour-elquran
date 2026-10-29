import type { Env } from './bindings.ts';

import { reply } from './responses.ts';
import { authSettings } from './auth/settings.ts';

export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const requestId = crypto.randomUUID();
  const path = new URL(request.url).pathname;
  if ((path === '/health' || path === '/healthz') && request.method === 'GET') {
    return reply(200, { service: 'noor-api', phase: 'foundation', status: 'up' }, requestId);
  }
  if (path.startsWith('/api/auth/') || path === '/v1' || path.startsWith('/v1/')) {
    if (!authSettings(env)) return reply(503, { code: 'AUTH_NOT_CONFIGURED', retryable: false }, requestId);
    try {
      const { handleAuthenticated } = await import('./auth/routes.ts');
      return await handleAuthenticated(request, env, requestId);
    } catch {
      return reply(503, { code: 'AUTH_UNAVAILABLE', retryable: true }, requestId);
    }
  }
  if ((path !== '/ready' && path !== '/readyz') || request.method !== 'GET') {
    return reply(404, { code: 'NOT_FOUND', retryable: false }, requestId);
  }
  if (!env.DB) {
    return reply(503, { code: 'DATABASE_NOT_CONFIGURED', retryable: false }, requestId);
  }
  try {
    const row = await env.DB.prepare(
      "SELECT version FROM noor_schema_meta WHERE component = 'core'",
    ).first<{ version: number }>();
    if (row?.version !== 1) {
      return reply(503, { code: 'SCHEMA_NOT_READY', retryable: false }, requestId);
    }
  } catch {
    return reply(503, { code: 'DATABASE_UNAVAILABLE', retryable: true }, requestId);
  }
  if (authSettings(env)) {
    try {
      const row = await env.DB.prepare("SELECT version FROM noor_schema_meta WHERE component='auth'").first<{ version: number }>();
      if (row?.version === 1) return reply(200, { database: 'ready', authentication: 'configured' }, requestId);
      return reply(503, { code: 'AUTH_SCHEMA_NOT_READY' }, requestId);
    } catch {
      return reply(503, { code: 'DATABASE_UNAVAILABLE', retryable: true }, requestId);
    }
  }
  // Storage readiness is not application readiness until auth is configured.
  return reply(503, { code: 'AUTH_NOT_CONFIGURED', database: 'ready', retryable: false }, requestId);
}

export default { fetch: handleRequest };
