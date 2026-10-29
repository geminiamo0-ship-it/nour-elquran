/** Private, opt-in staging boundary. Production routing is unaffected. */
export type StagingEnv = {
  NOOR_ENVIRONMENT?: string;
  STAGING_ACCESS_PASSWORD?: string;
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
