import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { normalizePhone, readObject } from '../src/auth/input.ts';
import { authSettings } from '../src/auth/settings.ts';

test('Egyptian mobile normalization and E164 input preserve phone-first signup', () => {
  assert.equal(normalizePhone('010 1234 5678'), '+201012345678');
  assert.equal(normalizePhone('+12025550101'), '+12025550101');
  for (const input of ['02012345678','+0000','abc',null,'+1',{},'+12025550101<script>'])
    assert.equal(normalizePhone(input), null);
});
test('auth configuration is explicit, strong-secret and canonical HTTPS in production', () => {
  const common = { AUTH_ENABLED: 'true', AUTH_SECRET: 'a'.repeat(48) };
  assert.equal(authSettings({}), null);
  assert.equal(authSettings({ ...common, AUTH_ORIGIN: 'http://example.com' }), null);
  assert.equal(authSettings({ ...common, AUTH_ORIGIN: 'https://example.com/path' }), null);
  assert.equal(authSettings({ ...common, AUTH_ORIGIN: 'https://example.com', AUTH_SECRET: 'short' }), null);
  assert.equal(authSettings({ ...common, AUTH_ORIGIN: 'https://example.com' })?.local, false);
  assert.equal(authSettings({ ...common, AUTH_ORIGIN: 'http://127.0.0.1:8795', AUTH_LOCAL_DEV: 'true' })?.local, true);
  assert.equal(authSettings({ ...common, AUTH_ORIGIN: 'http://example.com', AUTH_LOCAL_DEV: 'true' }), null);
});
test('bounded JSON parser rejects arrays, invalid JSON, wrong content type and oversized streams', async () => {
  for (const body of ['[]','null','bad','{"name":"' + 'x'.repeat(20000) + '"}']) {
    const req = new Request('https://noor.invalid', { method: 'POST', headers: { 'content-type':'application/json' }, body });
    assert.equal(await readObject(req), null);
  }
  assert.equal(await readObject(new Request('https://noor.invalid',{ method:'POST',body:'{}' })), null);
  assert.deepEqual(await readObject(new Request('https://noor.invalid',{ method:'POST',headers:{'content-type':'application/json'},body:'{"name":"Fixture"}' })),{name:'Fixture'});
});

