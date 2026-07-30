"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { apiErrorMessage } from "@/lib/apiClient";
import type { ProviderSource } from "@/types/train";

/**
 * 開発用デバッグ画面(/dev/debug)。
 * ODPT 取得の成否・件数・所要時間・使用中プロバイダ・エラー・生 JSON を表示する。
 */

interface DebugResponse {
  snapshot: {
    odptConfigured: boolean;
    railway: string;
    baseUrl: string;
    activeSource: ProviderSource;
    success: boolean;
    count: number;
    durationMs: number | null;
    fetchedAt: string;
    error: string | null;
    rawSample: unknown;
    probes: { label: string; success: boolean; count: number; error: string | null }[];
    availableRailways: string[];
  };
  service: {
    trains: {
      source: ProviderSource;
      isMock: boolean;
      fallback: boolean;
      notice: string | null;
      count: number;
    };
    serviceStatus: {
      source: ProviderSource;
      isMock: boolean;
      fallback: boolean;
      severity: string;
      message: string;
    };
  };
  totalDurationMs: number;
}

export function DebugView() {
  const [data, setData] = useState<DebugResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dev/debug", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData((await res.json()) as DebugResponse);
    } catch (err) {
      setError(apiErrorMessage(err, "取得に失敗しました"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 text-rail-text">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">
            Train Live Map｜JR東日本・関東版 — Debug
          </h1>
          <p className="text-xs text-rail-muted">/dev/debug(開発時のみ)</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="flex min-h-[40px] items-center gap-1.5 rounded-lg border border-rail-border bg-rail-surface px-3 text-sm hover:border-rail-accent"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden />
          再取得
        </button>
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-red-500/50 bg-red-500/15 px-3 py-2 text-sm text-red-100">
          {error}
        </p>
      )}

      {data && (
        <div className="space-y-4">
          <Section title="ODPT 直接取得(生データ)">
            <Row label="ODPT 設定済み" value={data.snapshot.odptConfigured ? "はい" : "いいえ(未設定)"} />
            <Row label="取得成功" value={data.snapshot.success ? "✅ 成功" : "❌ 失敗"} />
            <Row label="使用中 Provider" value={data.snapshot.activeSource} />
            <Row label="対象路線 (railway)" value={data.snapshot.railway} />
            <Row label="ベース URL" value={data.snapshot.baseUrl} />
            <Row label="取得件数" value={String(data.snapshot.count)} />
            <Row
              label="通信時間"
              value={data.snapshot.durationMs === null ? "—" : `${data.snapshot.durationMs} ms`}
            />
            <Row label="取得時刻" value={data.snapshot.fetchedAt} />
            {data.snapshot.error && <Row label="エラー内容" value={data.snapshot.error} danger />}
          </Section>

          {data.snapshot.probes.length > 0 && (
            <Section title="接続診断">
              {data.snapshot.probes.map((probe) => (
                <div
                  key={probe.label}
                  className="border-b border-rail-border/50 py-1.5 text-sm last:border-0"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-rail-muted break-all">{probe.label}</span>
                    <span className="shrink-0 text-right">
                      {probe.success ? (
                        <span className="text-emerald-300">✅ {probe.count} 件</span>
                      ) : (
                        <span className="text-red-300">❌ 失敗</span>
                      )}
                    </span>
                  </div>
                  {probe.error && (
                    <p className="mt-0.5 text-xs text-red-300 break-all">{probe.error}</p>
                  )}
                </div>
              ))}
            </Section>
          )}

          {data.snapshot.availableRailways.length > 0 && (
            <Section title={`利用可能な路線 ID(${data.snapshot.availableRailways.length}件)`}>
              <p className="mb-2 text-xs text-rail-muted">
                対象路線が一覧に無い場合は、.env.local の ODPT_RAILWAY を正しい ID
                に変更してください。
              </p>
              <ul className="max-h-56 overflow-y-auto text-xs leading-relaxed">
                {data.snapshot.availableRailways.map((id) => (
                  <li
                    key={id}
                    className={`break-all ${
                      id === data.snapshot.railway
                        ? "font-semibold text-emerald-300"
                        : "text-rail-text"
                    }`}
                  >
                    {id === data.snapshot.railway ? "▶ " : "・"}
                    {id}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section title="サービス層の結果(フォールバック込み)">
            <Row label="列車 source" value={data.service.trains.source} />
            <Row label="列車 isMock" value={String(data.service.trains.isMock)} />
            <Row label="列車 fallback" value={String(data.service.trains.fallback)} />
            <Row label="列車 件数" value={String(data.service.trains.count)} />
            <Row label="notice" value={data.service.trains.notice ?? "—"} />
            <Row label="運行情報 source" value={data.service.serviceStatus.source} />
            <Row label="運行情報 severity" value={data.service.serviceStatus.severity} />
            <Row label="運行情報 message" value={data.service.serviceStatus.message} />
            <Row label="合計処理時間" value={`${data.totalDurationMs} ms`} />
          </Section>

          <Section title="レスポンス JSON(先頭3件)">
            <pre className="overflow-x-auto rounded-lg bg-black/40 p-3 text-[11px] leading-relaxed text-emerald-100">
              {JSON.stringify(data.snapshot.rawSample, null, 2)}
            </pre>
          </Section>
        </div>
      )}
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-rail-border bg-rail-surface p-4">
      <h2 className="mb-2 text-sm font-semibold text-rail-accent">{title}</h2>
      <dl className="space-y-1">{children}</dl>
    </section>
  );
}

function Row({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="flex justify-between gap-4 border-b border-rail-border/50 py-1 text-sm last:border-0">
      <dt className="shrink-0 text-rail-muted">{label}</dt>
      <dd className={`text-right break-all ${danger ? "text-red-300" : "text-rail-text"}`}>
        {value}
      </dd>
    </div>
  );
}
