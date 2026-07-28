"use client";

import { useEffect, useRef } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  Gauge,
  MapPin,
  Ticket,
  TrainFront,
  X,
} from "lucide-react";
import type { TrainLocation } from "@/types/train";
import {
  dataAccuracyLabelJa,
  getStatusAppearance,
  statusLabelJa,
  trainTypeLabelJa,
} from "@/lib/trainStatus";
import { formatTimeJa } from "@/lib/time";
import { StoppedDuration } from "@/features/trains/StoppedDuration";
import { useNow } from "@/lib/useNow";

interface TrainDetailPanelProps {
  train: TrainLocation | null;
  onClose: () => void;
}

/**
 * 列車の詳細を表示するパネル。
 * スマホでは画面下から開くボトムシート風に表示する。
 */
export function TrainDetailPanel({ train, onClose }: TrainDetailPanelProps) {
  const now = useNow(1000);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const trainId = train?.id ?? null;

  // Esc キーで閉じる
  useEffect(() => {
    if (!train) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [train, onClose]);

  useEffect(() => {
    if (!trainId) return;
    const frame = window.requestAnimationFrame(() =>
      closeButtonRef.current?.focus(),
    );
    return () => window.cancelAnimationFrame(frame);
  }, [trainId]);

  if (!train) return null;

  const appearance = getStatusAppearance(train, now);
  const directionLabel = train.direction === "inbound" ? "上り" : "下り";
  const DirectionIcon = train.direction === "inbound" ? ArrowUpRight : ArrowDownRight;

  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={`${train.lineName} ${train.destination}行の詳細`}
      aria-describedby={
        train.dataAccuracy !== "actual"
          ? "train-detail-accuracy-note"
          : undefined
      }
    >
      {/* 背景 */}
      <button
        type="button"
        aria-label="閉じる"
        onClick={onClose}
        className="animate-scrim-enter absolute inset-0 bg-black/55 backdrop-blur-[2px]"
      />

      {/* シート本体 */}
      <div className="app-sheet animate-sheet-enter safe-bottom relative max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border">
        {/* ドラッグハンドル */}
        <div className="flex justify-center pt-2">
          <span
            className="h-1.5 w-10 rounded-full bg-orange-100/25"
            aria-hidden
          />
        </div>

        {/* ヘッダー */}
        <div className="flex items-start justify-between gap-2 px-4 pt-2">
          <div className="flex items-center gap-2">
            <span
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/25 text-white shadow-inner"
              style={{ backgroundColor: train.lineColor }}
              aria-hidden
            >
              <TrainFront className="h-5 w-5" />
            </span>
            <div className="leading-tight">
              <p className="mb-0.5 flex items-center gap-1.5 text-xs font-semibold text-rail-muted">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: train.lineColor }}
                  aria-hidden
                />
                {train.lineName}
              </p>
              <p className="text-base font-bold text-rail-text">
                {trainTypeLabelJa(train.trainType)}・{train.destination}行
              </p>
              <p className="text-xs text-rail-muted">{directionLabel}</p>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="詳細を閉じる"
            className="pressable flex h-11 w-11 items-center justify-center rounded-full text-rail-muted hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        {/* 状態バッジ */}
        <div className="px-4 pt-3">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold"
            style={{ backgroundColor: appearance.color, color: "#0a0a0a" }}
          >
            {statusLabelJa(train.status)}
            {train.delayMinutes > 0 && train.status !== "suspended" && (
              <span>／{train.delayMinutes}分遅れ</span>
            )}
          </span>
          {train.stoppedSince && (
            <span className="ml-2 text-sm font-medium text-amber-300">
              <StoppedDuration stoppedSince={train.stoppedSince} />
            </span>
          )}
        </div>

        {/* 詳細項目 */}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-4 text-sm">
          <DetailItem icon={Ticket} label="列車種別">
            {trainTypeLabelJa(train.trainType)}
          </DetailItem>
          <DetailItem icon={TrainFront} label="路線">
            {train.lineName}
          </DetailItem>
          <DetailItem icon={TrainFront} label="行先">
            {train.destination}
          </DetailItem>
          <DetailItem icon={DirectionIcon} label="上り・下り">
            {directionLabel}
          </DetailItem>
          <DetailItem icon={Clock} label="遅延時間">
            {train.delayMinutes > 0 ? `${train.delayMinutes}分` : "なし"}
          </DetailItem>
          <DetailItem icon={Gauge} label="速度">
            {train.speedKmh} km/h
          </DetailItem>
          <DetailItem icon={Clock} label="停止時間">
            {train.stoppedSince ? (
              <StoppedDuration stoppedSince={train.stoppedSince} prefix="" />
            ) : (
              "—"
            )}
          </DetailItem>
          <DetailItem icon={Clock} label="最終更新">
            {formatTimeJa(train.lastUpdatedAt)}
          </DetailItem>
          <DetailItem icon={MapPin} label="位置情報" full>
            <span>
              {train.dataAccuracy === "actual"
                ? "取得座標"
                : "駅間情報からの推定位置"}
            </span>
            <span className="mt-0.5 block text-[11px] font-normal tabular-nums text-rail-muted">
              緯度 {train.latitude.toFixed(5)} ／ 経度{" "}
              {train.longitude.toFixed(5)}
            </span>
          </DetailItem>
          <DetailItem icon={Gauge} label="データ精度" full>
            {dataAccuracyLabelJa(train.dataAccuracy)}
          </DetailItem>
        </dl>

        {/* 注意書き */}
        {train.dataAccuracy !== "actual" && (
          <p
            id="train-detail-accuracy-note"
            className="border-t border-rail-border px-4 py-3 text-[11px] leading-relaxed text-rail-muted"
          >
            ※ 位置情報はモックまたは駅間情報からの推定です。実際の列車位置とは異なる場合があります。
          </p>
        )}
      </div>
    </div>
  );
}

interface DetailItemProps {
  icon: typeof Clock;
  label: string;
  children: React.ReactNode;
  full?: boolean;
}

function DetailItem({ icon: Icon, label, children, full }: DetailItemProps) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <dt className="flex items-center gap-1 text-[11px] text-rail-muted">
        <Icon className="h-3 w-3" aria-hidden />
        {label}
      </dt>
      <dd className="mt-0.5 font-medium text-rail-text">{children}</dd>
    </div>
  );
}
