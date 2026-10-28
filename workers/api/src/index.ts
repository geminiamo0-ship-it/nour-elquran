/* global URL, Response */
interface D1Query {
  first<T = unknown>(): Promise<T | null>;
}

interface D1Binding {
  prepare(sql: string): D1Query;
}

export interface Env {
  DB?: D1Binding;
}

const headers = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

function json(body: Record<string, string>, status: number): Response {
  return Response.json(body, { status, headers });
}

/**
 * Backend foundation only. No session verifier has been approved or installed.
 * Every learner/staff API path stays inaccessible, regardless of spoofed headers.
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const pathname = new URL(request.url).pathname;

    if (request.method === 'GET' && pathname === '/healthz') {
      return json({ status: 'ok' }, 200);
    }

    if (request.method === 'GET' && pathname === '/readyz') {
      if (!env.DB) return json({ status: 'unavailable' }, 503);
      try {
        const result = await env.DB.prepare('SELECT 1 AS ready').first<{ ready: number }>();
        if (result?.ready === 1) return json({ status: 'ready' }, 200);
      } catch {
        // Never disclose D1 internals or configuration to a public caller.
      }
      return json({ status: 'unavailable' }, 503);
    }

    if (pathname === '/v1' || pathname.startsWith('/v1/')) {
      // Do not trust client-supplied account IDs, demo state or unsigned JWTs.
      return json({ error: 'authentication_unavailable' }, 401);
    }

    return json({ error: 'not_found' }, 404);
  },
};
