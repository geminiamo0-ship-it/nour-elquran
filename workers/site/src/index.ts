import { handleRequest } from '../../api/src/index.ts';
import type { Env } from '../../api/src/bindings.ts';
import { stagingAccessGuard, type StagingEnv } from './staging-access.ts';
export type SiteEnv = Env & StagingEnv & { ASSETS: { fetch: (request: Request) => Promise<Response> } };

/** Same-origin cookie API; static files and branded 404s retain their existing asset behavior. */
export async function handleSiteRequest(request: Request, env: SiteEnv): Promise<Response> {
  const blocked = stagingAccessGuard(request, env);
  if (blocked) return blocked;
  const path = new URL(request.url).pathname;
  const isApi = path.startsWith('/api/') || path === '/v1' || path.startsWith('/v1/') ||
    path.startsWith('/internal-auth/') || ['/health','/healthz','/ready','/readyz'].includes(path);
  return isApi ? handleRequest(request, env) : env.ASSETS.fetch(request);
}
export default { fetch: handleSiteRequest };
