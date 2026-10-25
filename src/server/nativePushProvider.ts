import { createPrivateKey, sign } from 'node:crypto';
import { connect } from 'node:http2';
import type { NativeRegistration } from '@/lib/nativePush';

let cachedJWT: {value:string; at:number} | undefined;
export function nativeDeliveryEnabled(environment: string) {
  return process.env.APNS_DELIVERY_ENABLED === 'true' &&
    (environment === 'development' || process.env.APNS_PRODUCTION_DELIVERY_APPROVED === 'true');
}
function providerJWT() {
  if (cachedJWT && Date.now()-cachedJWT.at < 45*60000) return cachedJWT.value;
  const keyId=process.env.APNS_KEY_ID, teamId=process.env.APNS_TEAM_ID, pem=process.env.APNS_PRIVATE_KEY;
  if (!keyId || !teamId || !pem) throw new Error('APNs provider unavailable');
  const header = Buffer.from(JSON.stringify({alg:'ES256',kid:keyId})).toString('base64url');
  const payload = Buffer.from(JSON.stringify({iss:teamId,iat:Math.floor(Date.now()/1000)})).toString('base64url');
  const unsigned = `${header}.${payload}`;
  const signature = sign('sha256',Buffer.from(unsigned),{key:createPrivateKey(pem.replace(/\\n/g,'\n')),dsaEncoding:'ieee-p1363'}).toString('base64url');
  cachedJWT={value:`${unsigned}.${signature}`,at:Date.now()};
  return cachedJWT.value;
}
export async function sendNativeNotification(registration: Omit<NativeRegistration,'installationSecret'>, lineId: string, body: string): Promise<'sent'|'expired'|'failed'|'disabled'> {
  if (!nativeDeliveryEnabled(registration.environment)) return 'disabled';
  const jwt = providerJWT();
  const host = registration.environment === 'development' ? 'https://api.sandbox.push.apple.com' : 'https://api.push.apple.com';
  return new Promise(resolve=> {
    const client = connect(host);
    let completed = false;
    const finish = (result:'sent'|'expired'|'failed') => {
      if (completed) return;
      completed=true; clearTimeout(timer); client.destroy(); resolve(result);
    };
    const timer = setTimeout(()=>finish('failed'),10000);
    client.on('error',()=>finish('failed'));
    const request = client.request({':method':'POST',':path':`/3/device/${registration.deviceToken}`,
      authorization:`bearer ${jwt}`,'apns-topic':registration.bundleId,'apns-push-type':'alert','apns-priority':'10',
      'apns-expiration':String(Math.floor(Date.now()/1000)+300),'apns-collapse-id':lineId});
    let status=0, response='';
    request.on('response',headers=>{status=Number(headers[':status']);});
    request.on('data',data=>{if (response.length<4096) response+=data;});
    request.on('error',()=>finish('failed'));
    request.on('end',()=> {
      let reason=''; try {reason=JSON.parse(response).reason;} catch { /* no content */ }
      finish(status===200 ? 'sent' : status===410 || (status===400 && reason==='BadDeviceToken') ? 'expired' : 'failed');
    });
    request.end(JSON.stringify({aps:{alert:{title:'Train Live Map',body},sound:'default'},lineId}));
  });
}
