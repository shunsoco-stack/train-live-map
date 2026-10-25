import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateNativeRegistration, officialState, notificationForTransition } from './nativePush.ts';
import type { ServiceStatus } from '../types/train.ts';
const preferences={enabled:true,includeCommunity:false,suspension:true,resumption:true,delay:false};
const valid={deviceToken:'a'.repeat(64),installationSecret:'b'.repeat(64),platform:'ios',bundleId:'test.bundle',environment:'development',lineIds:['yamanote'],preferences};
const known=new Set(['yamanote']);
test('native contract validates ownership key, target and every route',()=> {
 assert.ok(validateNativeRegistration(valid,'test.bundle',known));
 for (const change of [{deviceToken:'bad'}, {installationSecret:'bad'}, {bundleId:'wrong'}, {lineIds:['unknown']}, {lineIds:[1]}, {preferences:{enabled:true}}, {environment:'arbitrary'}, {platform:'web'}]) assert.equal(validateNativeRegistration({...valid,...change},'test.bundle',known),null);
 assert.ok(validateNativeRegistration({...valid,lineIds:undefined,preferences:undefined},'test.bundle',known,true));
});
const now=Date.now();
const status=(message:string): ServiceStatus=>({lineId:'yamanote',lineName:'山手線',severity:'major',message,updatedAt:new Date(now).toISOString(),dataAccuracy:'actual'});
test('forecast is not a resumption; stale, synthetic and train-derived data do not alert',()=> {
 assert.equal(officialState(status('上下線で運転を見合わせています。運転再開見込みは20時です。'),now),'suspended');
 assert.equal(officialState(status('運転を再開しました。'),now),'resumed');
 assert.equal(officialState(status('列車位置情報では最大2分程度の遅れが確認されています。'),now),null);
 assert.equal(officialState({...status('運転見合わせ'),dataAccuracy:'mock'},now),null);
 assert.equal(officialState(status('運転見合わせ'),now+700000),null);
 assert.equal(officialState(status('情報を取得できません'),now),null);
});
test('initial snapshot and duplicate states are silent, settings are enforced',()=> {
 assert.equal(notificationForTransition(undefined,'suspended',preferences),false);
 assert.equal(notificationForTransition('suspended','suspended',preferences),false);
 assert.equal(notificationForTransition('normal','suspended',preferences),true);
 assert.equal(notificationForTransition('suspended','normal',preferences),true);
 assert.equal(notificationForTransition('normal','delay',preferences),false);
 assert.equal(notificationForTransition('normal','suspended',{...preferences,enabled:false}),false);
 assert.equal(notificationForTransition('normal','suspended',{...preferences,suspension:false}),false);
});
