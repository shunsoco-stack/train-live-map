import { NextRequest, NextResponse } from 'next/server';
import { RAILWAY_CATALOG } from '@/data/railwayCatalog';
import { validateNativeRegistration } from '@/lib/nativePush';
import { allowNativeMutation, mutateRegistration, nativeStoreConfiguration } from '@/server/nativePushStore';
import { clientAddress, pseudonymousHash, readLimitedJsonBody, validateMutationRequest } from '@/server/requestSecurity';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = {'Cache-Control':'no-store'};
async function mutate(request: NextRequest, removing: boolean) {
  try {
    const check = validateMutationRequest(request.headers,request.nextUrl,4096);
    if (!check.ok) return NextResponse.json({error:check.message},{status:check.status,headers});
    const config = nativeStoreConfiguration();
    if (!config) return NextResponse.json({error:'通知サービスを準備中です。'},{status:503,headers});
    const address = clientAddress(request.headers) ?? 'unknown';
    const source = pseudonymousHash(config.key.toString('hex'),'apns-rate',address);
    if (!await allowNativeMutation(source)) return NextResponse.json({error:'少し時間をおいて再試行してください。'},{status:429,headers:{...headers,'Retry-After':'600'}});
    const body = await readLimitedJsonBody(request,4096);
    if (!body.ok) return NextResponse.json({error:body.message},{status:body.status,headers});
    const value = validateNativeRegistration(body.value,config.bundle,new Set(RAILWAY_CATALOG.filter(x=>x.coverage!=='unavailable').map(x=>x.id)),removing);
    if (!value) return NextResponse.json({error:'通知設定を確認してください。'},{status:400,headers});
    if (!await mutateRegistration(value,removing)) return NextResponse.json({error:'この端末の登録を確認できません。'},{status:403,headers});
    return NextResponse.json({subscribed:!removing},{headers});
  } catch {
    console.error('[apns] device mutation failed'); // Never log request, token, IP or provider errors.
    return NextResponse.json({error:'通知設定を保存できませんでした。'},{status:503,headers});
  }
}
export const POST = (request: NextRequest) => mutate(request,false);
export const DELETE = (request: NextRequest) => mutate(request,true);
