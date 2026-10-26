import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getRailwayCatalogLine } from '@/data/railwayCatalog';
import { detectSuspensionSpike } from '@/lib/communityPush';
import { notificationForTransition, officialState } from '@/lib/nativePush';
import { trainLocationService } from '@/services/trainLocationService';
import { getCommunityReportStore } from '@/server/communityReportStore';
import { acquireDispatchLease, releaseDispatchLease, claimNativeKey, decryptRegistration, listNativeRegistrations, nativeStoreConfiguration, readStates, removeExpiredDevice, saveStates } from '@/server/nativePushStore';
import { nativeDeliveryEnabled, sendNativeNotification } from '@/server/nativePushProvider';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const actual=Buffer.from(request.headers.get('authorization') ?? ''), expected=Buffer.from(`Bearer ${secret ?? ''}`);
  if (!secret || actual.length!==expected.length || !timingSafeEqual(actual,expected)) return new NextResponse(null,{status:401});
  const config=nativeStoreConfiguration();
  if (!config || process.env.APNS_DELIVERY_ENABLED !== 'true') return NextResponse.json({enabled:false});
  // Scheduler invokes every minute only after operator approval. No registration request sends a push.
  const lease=await acquireDispatchLease();
  if (!lease) return NextResponse.json({busy:true});
  try {
    const result=await trainLocationService.getServiceStatuses();
    const statuses=result.isMock || result.fallback ? [] : result.serviceStatuses;
    const reports=(await getCommunityReportStore().listActive()).map(x=>x.record);
    const registrations=await listNativeRegistrations();
    let sent=0, failed=0;
    for (let offset=0; offset<registrations.length; offset+=20) {
      await Promise.all(registrations.slice(offset,offset+20).map(async record=> {
        const registration=decryptRegistration(record.encrypted,config.key);
        if (!registration.preferences?.enabled || !nativeDeliveryEnabled(registration.environment)) return;
        const previous=await readStates(record.id), next={...previous};
        const messages: {lineId:string;body:string}[]=[];
        let communityLine: string | undefined;
        for (const lineId of registration.lineIds ?? []) {
          const status=statuses.find(x=>x.lineId===lineId);
          const current=status ? officialState(status) : null;
          if (status && current) {
            if (notificationForTransition(previous[lineId],current,registration.preferences)) {
              messages.push({lineId,body:`${status.lineName}：${status.message}`});
            }
            next[lineId]=current;
          }
          if (!communityLine && registration.preferences.includeCommunity && registration.preferences.suspension && detectSuspensionSpike(reports,lineId).detected) communityLine=lineId;
        }
        // One bounded delivery per device per tick, even when many lines change together.
        let body=messages.slice(0,3).map(x=>x.body).join("\n").slice(0,350);
        let lineId=messages[0]?.lineId;
        if (!lineId && communityLine && await claimNativeKey(`community:${record.id}:${communityLine}`,1800)) {
          lineId=communityLine;
          const name=getRailwayCatalogLine(lineId)?.name ?? lineId;
          body=`${name}で運転見合わせの報告が増えています。公式情報もご確認ください。`;
        }
        if (lineId) {
          const delivery=await sendNativeNotification(registration,lineId,body);
          if (delivery==='expired') {await removeExpiredDevice(record.id); return;}
          if (delivery==='failed') {failed++; return;}
          if (delivery==='sent') sent++;
        }
        await saveStates(record.id,next);
      }));
    }
    return NextResponse.json({sent,failed},{headers:{'Cache-Control':'no-store'}});
  } catch {
    console.error('[apns] dispatch failed');
    return NextResponse.json({error:'Notification dispatch unavailable'},{status:503});
  } finally {
    await releaseDispatchLease(lease);
  }
}
