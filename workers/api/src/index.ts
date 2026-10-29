import type { Env } from './bindings.ts';

function reply(status: number, body: Record<string, unknown>, requestId: string): Response {
  return Response.json({ ...body, requestId }, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Request-Id': requestId,
    },
  });
}

export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const requestId = crypto.randomUUID();
  const path = new URL(request.url).pathname;
  if (path === '/health' && request.method === 'GET') {
    return reply(200, { service: 'noor-api', phase: 'foundation', status: 'up' }, requestId);
  }
  // No JWT/header/demo identity fallback. Real authentication is the next #46 slice.
  if (path.startsWith('/v1/')) {
    return reply(503, { code: 'AUTH_NOT_CONFIGURED', retryable: false }, requestId);
  }
  if (path !== '/ready' || request.method !== 'GET') {
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
  // Storage readiness is not application readiness until real auth is integrated.
  return reply(503, { code: 'AUTH_NOT_CONFIGURED', database: 'ready', retryable: false }, requestId);
}

export default { fetch: handleRequest };
