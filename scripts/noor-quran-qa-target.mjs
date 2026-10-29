/** #149: require explicit consent to synthetic writes on the existing Noor DEV Worker.
 * Never allow the public frontend, an arbitrary domain, a production API, or
 * a legacy Basic-protected QA hostname to become an automated write target.
 * Pin the Cloudflare account too: a pattern matching any *.workers.dev account
 * would permit synthetic account/D1 writes to an unrelated operator's Worker.
 */
const APPROVED_DEV_QA_ORIGIN='https://noor-site-staging.geminiamo0.workers.dev';

export function assertNoorDevQaTarget(env) {
  const origin=env.NOOR_QA_ORIGIN;
  if(env.NOOR_QA_RUN_SYNTHETIC!=='yes' ||
    origin!==APPROVED_DEV_QA_ORIGIN)
    throw Error('Synthetic Quran QA requires explicit opt-in and exact Noor development Worker origin');
  return origin;
}
