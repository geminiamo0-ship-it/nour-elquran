/** #149: require explicit consent to synthetic writes on the existing Noor DEV Worker.
 * Never allow the public frontend, an arbitrary domain, a production API, or
 * a legacy Basic-protected QA hostname to become an automated write target.
 */
export function assertNoorDevQaTarget(env) {
  const origin=env.NOOR_QA_ORIGIN;
  if(env.NOOR_QA_RUN_SYNTHETIC!=='yes' ||
    typeof origin!=='string' ||
    !/^https:\/\/noor-site-staging\.[a-z0-9-]+\.workers\.dev$/.test(origin))
    throw Error('Synthetic Quran QA requires explicit opt-in and exact Noor development Worker origin');
  return origin;
}
