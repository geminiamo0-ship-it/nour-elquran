import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { phoneNumber } from 'better-auth/plugins/phone-number';
import { drizzle } from 'drizzle-orm/d1';
import type { Env } from '../bindings.ts';
import { authSchema } from './schema.ts';
import { authSettings } from './settings.ts';

export function createAuth(env: Env) {
  const settings = authSettings(env);
  if (!settings || !env.DB) throw Error('Authentication configuration unavailable');
  const db = drizzle(env.DB as unknown as Parameters<typeof drizzle>[0], { schema: authSchema });
  return betterAuth({
    appName: 'Noor Al-Quran',
    baseURL: settings.origin,
    basePath: '/internal-auth',
    secret: settings.secret,
    trustedOrigins: [settings.origin],
    database: drizzleAdapter(db, { provider: 'sqlite', schema: authSchema, transaction: false }),
    user: { modelName: 'authUsers' },
    session: {
      modelName: 'authSessions',
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: false },
    },
    account: { modelName: 'authCredentials' },
    verification: { modelName: 'authVerifications' },
    emailAndPassword: { enabled: true, minPasswordLength: 8, maxPasswordLength: 128 },
    advanced: {
      useSecureCookies: !settings.local,
      ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] },
      defaultCookieAttributes: { httpOnly: true, secure: !settings.local, sameSite: 'lax', path: '/' },
    },
    rateLimit: {
      enabled: true, storage: 'database', modelName: 'authRateLimits', window: 60, max: 30,
      customRules: {
        '/sign-in/phone-number': { window: 60, max: 5 },
        '/sign-up/email': { window: 60, max: 5 },
      },
    },
    plugins: [phoneNumber({
      sendOTP: async () => { throw Error('Phone verification delivery is not configured'); },
    })],
    logger: { disabled: true },
    telemetry: { enabled: false },
  });
}

