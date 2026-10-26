import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { encryptRegistration, decryptRegistration, registrationId, ownerHash } from './nativePushCrypto.ts';
import type { NativeRegistration } from './nativePush.ts';
const value: NativeRegistration = {deviceToken:'a'.repeat(64),installationSecret:'b'.repeat(64),platform:'ios',bundleId:'test.bundle',environment:'development',lineIds:['yamanote']};

test('encrypted device records omit the ownership secret and use fresh authenticated nonces', () => {
  const key=randomBytes(32), first=encryptRegistration(value,key), second=encryptRegistration(value,key);
  assert.notEqual(first,second);
  const decoded=decryptRegistration(first,key);
  assert.equal(decoded.deviceToken,value.deviceToken);
  assert.equal('installationSecret' in decoded,false);
  assert.throws(()=>decryptRegistration(first,randomBytes(32)));
  const tampered=Buffer.from(first,'base64'); tampered[tampered.length-1]^=1;
  assert.throws(()=>decryptRegistration(tampered.toString('base64'),key));
  assert.throws(()=>decryptRegistration('invalid',key));
});

test('token identity is separated by bundle and APNs environment; owner is one-way hashed', () => {
  assert.notEqual(registrationId(value),registrationId({...value,environment:'production'}));
  assert.notEqual(registrationId(value),registrationId({...value,bundleId:'other.bundle'}));
  assert.match(ownerHash(value),/^[a-f0-9]{64}$/);
  assert.notEqual(ownerHash(value),value.installationSecret);
  assert.notEqual(ownerHash(value),ownerHash({...value,installationSecret:'c'.repeat(64)}));
});
