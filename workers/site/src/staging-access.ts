/** Optional staging-only Basic gate. The owner may opt into fully open development mode. */
export type StagingEnv = {
  NOOR_ENVIRONMENT?: string;
  STAGING_ACCESS_PASSWORD?: string;
  NOOR_DEV_OPEN?: string;
  NOOR_PUBLIC_PREVIEW?: string;
};

function equalConstantTime(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let i = 0; i < left.length; i++) difference |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return difference === 0;
}

export function stagingAccessGuard(request: Request, env: StagingEnv): Response | null {
  const hostname = new URL(request.url).hostname;
  const staging = env.NOOR_ENVIRONMENT === 'staging' || hostname.startsWith('noor-site-staging.');
  if (!staging) return null;

  // This is the owner's public development URL: no staging-wide login dialog
  // for any route or HTTP method. App-level Better Auth and owner checks stay.
  if (env.NOOR_DEV_OPEN === 'true') return null;

  const path = new URL(request.url).pathname;
  const api = path === '/api' || path.startsWith('/api/') ||
    path === '/v1' || path.startsWith('/v1/') ||
    path === '/internal-auth' || path.startsWith('/internal-auth/') ||
    ['/health','/healthz','/ready','/readyz'].includes(path);
  if (env.NOOR_PUBLIC_PREVIEW === 'true' &&
      (request.method === 'GET' || request.method === 'HEAD') && !api) return null;

  const password = env.STAGING_ACCESS_PASSWORD;
  if (!password || password.length < 32) return new Response('Staging access is not configured', {
    status: 503,
    headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow, noarchive' },
  });

  const expected = 'Basic ' + btoa('noor-preview:' + password);
  if (!equalConstantTime(request.headers.get('Authorization') ?? '', expected)) {
    return new Response('Staging is private', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Noor Staging", charset="UTF-8"',
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex, nofollow, noarchive',
      },
    });
  }
  return null;
}
