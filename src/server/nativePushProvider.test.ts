import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, verify } from 'node:crypto';
import { nativeDeliveryEnabled, providerJWT } from './nativePushProvider.ts';

const names = [
  'APNS_TEAM_ID', 'APNS_KEY_ID', 'APNS_PRIVATE_KEY',
  'APNS_SANDBOX_KEY_ID', 'APNS_SANDBOX_PRIVATE_KEY',
  'APNS_PRODUCTION_KEY_ID', 'APNS_PRODUCTION_PRIVATE_KEY',
  'APNS_DELIVERY_ENABLED', 'APNS_PRODUCTION_DELIVERY_APPROVED',
];
function isolateEnvironment(t: TestContext) {
  const previous = names.map(name => [name, process.env[name]] as const);
  for (const name of names) delete process.env[name];
  process.env.APNS_TEAM_ID = 'TESTTEAM01';
  t.after(() => {
    for (const [name, value] of previous) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });
}
function testKey() {
  const pair = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  return { publicKey: pair.publicKey, pem: pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString() };
}
function assertSignature(token: string, key: ReturnType<typeof testKey>, keyID: string) {
  const [header, payload, signature] = token.split('.');
  assert.equal(JSON.parse(Buffer.from(header, 'base64url').toString()).kid, keyID);
  assert.equal(JSON.parse(Buffer.from(payload, 'base64url').toString()).iss, 'TESTTEAM01');
  assert.equal(verify('sha256', Buffer.from(`${header}.${payload}`),
    { key: key.publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(signature, 'base64url')), true);
}

test('sandbox and production use their own signing keys and cached tokens', t => {
  isolateEnvironment(t);
  const sandbox = testKey(), production = testKey();
  process.env.APNS_SANDBOX_KEY_ID = 'SANDBOX001';
  process.env.APNS_SANDBOX_PRIVATE_KEY = sandbox.pem;
  process.env.APNS_PRODUCTION_KEY_ID = 'PRODKEY001';
  process.env.APNS_PRODUCTION_PRIVATE_KEY = production.pem;
  const first = providerJWT('development'), second = providerJWT('production');
  assertSignature(first, sandbox, 'SANDBOX001');
  assertSignature(second, production, 'PRODKEY001');
  assert.equal(providerJWT('development'), first);
  assert.equal(providerJWT('production'), second);
});

test('partial scoped settings fail closed instead of borrowing a legacy key', t => {
  isolateEnvironment(t);
  const legacy = testKey();
  process.env.APNS_KEY_ID = 'LEGACY0001';
  process.env.APNS_PRIVATE_KEY = legacy.pem;
  assertSignature(providerJWT('development'), legacy, 'LEGACY0001');
  process.env.APNS_SANDBOX_KEY_ID = 'SANDBOX001';
  assert.throws(() => providerJWT('development'), /provider unavailable/);
  process.env.APNS_SANDBOX_PRIVATE_KEY = '';
  assert.throws(() => providerJWT('development'), /provider unavailable/);
  assertSignature(providerJWT('production'), legacy, 'LEGACY0001');
});

test('configuration rotation and the 45-minute lifetime invalidate cached JWTs', t => {
  isolateEnvironment(t);
  let now = 1800000000000;
  t.mock.method(Date, 'now', () => now);
  const first = testKey(), replacement = testKey();
  process.env.APNS_SANDBOX_KEY_ID = 'SANDBOX001';
  process.env.APNS_SANDBOX_PRIVATE_KEY = first.pem;
  const original = providerJWT('development');
  process.env.APNS_SANDBOX_PRIVATE_KEY = replacement.pem;
  const rotated = providerJWT('development');
  assert.notEqual(rotated, original);
  assertSignature(rotated, replacement, 'SANDBOX001');
  now += 45 * 60000;
  const refreshed = providerJWT('development');
  assert.notEqual(refreshed, rotated);
  assertSignature(refreshed, replacement, 'SANDBOX001');
});

test('delivery remains disabled by default and production requires its own switch', t => {
  isolateEnvironment(t);
  assert.equal(nativeDeliveryEnabled('development'), false);
  process.env.APNS_DELIVERY_ENABLED = 'true';
  assert.equal(nativeDeliveryEnabled('development'), true);
  assert.equal(nativeDeliveryEnabled('production'), false);
  process.env.APNS_PRODUCTION_DELIVERY_APPROVED = 'true';
  assert.equal(nativeDeliveryEnabled('production'), true);
  assert.equal(nativeDeliveryEnabled('unexpected'), false);
});
