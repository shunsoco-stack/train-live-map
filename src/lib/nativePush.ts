import type { ServiceStatus } from '../types/train.ts';

export interface NativePreferences {
  enabled: boolean;
  includeCommunity: boolean;
  suspension: boolean;
  resumption: boolean;
  delay: boolean;
}
export interface NativeRegistration {
  deviceToken: string;
  installationSecret: string;
  bundleId: string;
  environment: 'development' | 'production';
  platform: 'ios';
  lineIds?: string[];
  preferences?: NativePreferences;
}
export function validateNativeRegistration(value: unknown, bundleId: string, knownLines: ReadonlySet<string>, removing = false): NativeRegistration | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (v.platform !== 'ios' || v.bundleId !== bundleId || !['development', 'production'].includes(String(v.environment)) ||
      typeof v.deviceToken !== 'string' || !/^[a-f0-9]{64,200}$/.test(v.deviceToken) || v.deviceToken.length % 2 !== 0 ||
      typeof v.installationSecret !== 'string' || !/^[a-f0-9]{64}$/.test(v.installationSecret)) return null;
  if (!removing) {
    if (!Array.isArray(v.lineIds) || v.lineIds.length > 44 || v.lineIds.some(id => typeof id !== 'string' || !knownLines.has(id))) return null;
    const p = v.preferences as Record<string, unknown> | undefined;
    if (!p || ['enabled','includeCommunity','suspension','resumption','delay'].some(key => typeof p[key] !== 'boolean')) return null;
  }
  return value as NativeRegistration;
}
export type OfficialState = 'suspended' | 'resumed' | 'delay' | 'normal';
export function officialState(status: ServiceStatus, now = Date.now()): OfficialState | null {
  const age = now - Date.parse(status.updatedAt);
  if (status.dataAccuracy === 'mock' || !Number.isFinite(age) || age < -30000 || age > 600000 || status.message.startsWith('列車位置情報')) return null;
  const text = status.message;
  if (/見合わせています|見合わせております|再開見込|再開を予定/.test(text)) return 'suspended';
  if (/運転(?:を|が)?再開|運転を再開しました/.test(text)) return 'resumed';
  if (/運転(?:を)?見合[わせせ]|抑止/.test(text)) return 'suspended';
  if (/遅れ|遅延/.test(text)) return 'delay';
  if (/平常|通常どおり|通常通り/.test(text)) return 'normal';
  return null;
}
export function notificationForTransition(previous: OfficialState | undefined, current: OfficialState, preferences: NativePreferences): boolean {
  if (!preferences.enabled || previous === undefined || previous === current) return false;
  if (current === 'suspended') return preferences.suspension;
  if (current === 'resumed' || (current === 'normal' && previous === 'suspended')) return preferences.resumption;
  return current === 'delay' && preferences.delay;
}
