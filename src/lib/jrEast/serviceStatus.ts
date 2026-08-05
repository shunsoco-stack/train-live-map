import { RAILWAY_CATALOG } from "../../data/railwayCatalog.ts";
import type { ServiceStatus, TrainLocation } from "../../types/train.ts";
import { classifyServiceStatusSeverity } from "../serviceStatus.ts";

export const JR_EAST_KANTO_STATUS_URL =
  "https://traininfo.jreast.co.jp/train_info/kanto.aspx";

const FETCH_TIMEOUT_MS = 5_000;
const CACHE_TTL_MS = 30_000;
const MAX_RESPONSE_BYTES = 1_000_000;
const MAX_STATUS_AGE_MS = 10 * 60 * 1000;

let cachedStatuses: ServiceStatus[] | null = null;
let cacheExpiresAt = 0;
let pendingRequest: Promise<ServiceStatus[]> | null = null;

function decodeHtml(value: string): string {
  return value
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 10)),
    )
    .replace(/\s+/g, " ")
    .trim();
}

function pageUpdatedAt(html: string): string {
  const match = html.match(
    /(20\d{2})年\s*(\d{1,2})月\s*(\d{1,2})日\s*(\d{1,2})時\s*(\d{1,2})分\s*現在/,
  );
  if (!match) return new Date().toISOString();

  const [, year, month, day, hour, minute] = match;
  return new Date(
    `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${hour.padStart(2, "0")}:${minute.padStart(2, "0")}:00+09:00`,
  ).toISOString();
}

function catalogIdForOfficialName(name: string): string | null {
  const exact = RAILWAY_CATALOG.find(
    (line) => line.name.normalize("NFKC") === name.normalize("NFKC"),
  );
  if (exact) return exact.id;

  const withoutTrainSuffix = name.replace(/電車$/, "");
  return (
    RAILWAY_CATALOG.find((line) =>
      [line.name, ...line.aliases].some(
        (candidate) =>
          candidate.normalize("NFKC").replace(/電車$/, "") ===
          withoutTrainSuffix.normalize("NFKC"),
      ),
    )?.id ?? null
  );
}

/** JR東日本の公開運行情報HTMLをアプリ共通の運行情報へ変換する。 */
export function parseJrEastKantoServiceStatuses(
  html: string,
): ServiceStatus[] {
  const updatedAt = pageUpdatedAt(html);
  const statuses = new Map<string, ServiceStatus>();
  const items = html.matchAll(
    /<li\b[^>]*class=["'][^"']*traininfo-routes__table__item[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi,
  );

  for (const item of items) {
    const block = item[1];
    const nameMatch = block.match(
      /class=["'][^"']*traininfo-routes__name[^"']*["'][^>]*>([\s\S]*?)<\/span>/i,
    );
    const statusMatch = block.match(
      /class=["'][^"']*traininfo-routes__status[^"']*["'][^>]*>([\s\S]*?)<\/p>/i,
    );
    if (!nameMatch || !statusMatch) continue;

    const lineName = decodeHtml(nameMatch[1]);
    const lineId = catalogIdForOfficialName(lineName);
    if (!lineId) continue;

    const statusText = decodeHtml(statusMatch[1]);
    const noteMatch = block.match(
      /class=["'][^"']*traininfo-routes__note[^"']*["'][^>]*>([\s\S]*?)<\/p>/i,
    );
    const note = noteMatch ? decodeHtml(noteMatch[1]) : "";
    const message = note || statusText || "運行情報をご確認ください。";

    statuses.set(lineId, {
      lineId,
      lineName,
      severity: classifyServiceStatusSeverity(`${statusText} ${note}`),
      message,
      updatedAt,
      dataAccuracy: "actual",
      sourceLabel: "JR東日本公式",
      sourceUrl: JR_EAST_KANTO_STATUS_URL,
    });
  }

  return [...statuses.values()];
}

async function requestStatuses(): Promise<ServiceStatus[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(JR_EAST_KANTO_STATUS_URL, {
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "TrainLiveMap/1.0 (+https://train-live-map.vercel.app)",
      },
      next: { revalidate: 30 },
    });
    if (!response.ok) {
      throw new Error(`JR East status responded ${response.status}`);
    }
    const declaredLength = Number.parseInt(
      response.headers.get("content-length") ?? "0",
      10,
    );
    if (declaredLength > MAX_RESPONSE_BYTES) {
      throw new Error("JR East status response was too large");
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let receivedBytes = 0;
    let html = "";
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        receivedBytes += value.byteLength;
        if (receivedBytes > MAX_RESPONSE_BYTES) {
          await reader.cancel();
          throw new Error("JR East status response was too large");
        }
        html += decoder.decode(value, { stream: true });
      }
      html += decoder.decode();
    }

    const statuses = parseJrEastKantoServiceStatuses(html);
    if (statuses.length === 0) {
      throw new Error("JR East status page contained no recognized lines");
    }
    cachedStatuses = statuses;
    cacheExpiresAt = Date.now() + CACHE_TTL_MS;
    return statuses;
  } finally {
    clearTimeout(timeout);
  }
}

/** 公式サイトへのアクセスを30秒単位に集約する。取得失敗は呼び出し側で処理する。 */
export async function fetchJrEastKantoServiceStatuses(): Promise<
  ServiceStatus[]
> {
  if (cachedStatuses && Date.now() < cacheExpiresAt) return cachedStatuses;
  if (!pendingRequest) {
    pendingRequest = requestStatuses().finally(() => {
      pendingRequest = null;
    });
  }
  return pendingRequest;
}

export function mergeOfficialServiceStatus(
  current: ServiceStatus,
  official: ServiceStatus | undefined,
  nowMs = Date.now(),
): ServiceStatus {
  const officialUpdatedAt = official ? Date.parse(official.updatedAt) : NaN;
  if (
    !official ||
    official.severity === "normal" ||
    !Number.isFinite(officialUpdatedAt) ||
    officialUpdatedAt > nowMs + 2 * 60 * 1000 ||
    nowMs - officialUpdatedAt > MAX_STATUS_AGE_MS
  ) {
    return current;
  }
  if (current.severity === "major" && official.severity !== "major") {
    return current;
  }
  return official;
}

/** 「全線または全方向が見合わせ」と読める場合だけ全車両を見合わせ表示にする。 */
export function applyFullSuspensionsToTrains(
  trains: readonly TrainLocation[],
  statuses: readonly ServiceStatus[],
  nowMs = Date.now(),
): TrainLocation[] {
  const fullySuspendedLineIds = new Set(
    statuses
      .filter(
        (status) =>
          status.severity === "major" &&
          Number.isFinite(Date.parse(status.updatedAt)) &&
          Date.parse(status.updatedAt) <= nowMs + 2 * 60 * 1000 &&
          nowMs - Date.parse(status.updatedAt) <= MAX_STATUS_AGE_MS &&
          /運転(?:を)?見合わせ|運転見合せ|抑止/.test(status.message) &&
          /全線|内[・･]外回り|内回り[、・･と及び]外回り|上下線/.test(
            status.message,
          ) &&
          !/一部区間|一部列車/.test(status.message),
      )
      .map((status) => status.lineId),
  );

  if (fullySuspendedLineIds.size === 0) return [...trains];
  return trains.map((train) =>
    fullySuspendedLineIds.has(train.lineId)
      ? {
          ...train,
          status: "suspended",
          speedKmh: 0,
        }
      : train,
  );
}
