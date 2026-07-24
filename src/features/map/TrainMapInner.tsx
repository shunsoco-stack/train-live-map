"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { TrainLocation } from "@/types/train";
import { STATIONS } from "@/data/stations";
import { ROUTE_LINE } from "@/data/routeLine";
import { MAP_STYLE } from "@/features/map/mapStyle";
import { getStatusAppearance } from "@/lib/trainStatus";

interface TrainMapInnerProps {
  trains: TrainLocation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** 色再計算のための現在時刻(1秒ごとに更新される) */
  now: Date;
}

// 東京〜横浜が収まる初期表示範囲(バウンディングボックス)
const INITIAL_BOUNDS: [[number, number], [number, number]] = [
  [139.58, 35.44], // 南西
  [139.8, 35.7], // 北東
];

/**
 * MapLibre GL による地図描画コンポーネント。
 * SSR では読み込まれない(dynamic import + ssr:false)前提のクライアント専用。
 */
export default function TrainMapInner({
  trains,
  selectedId,
  onSelect,
  now,
}: TrainMapInnerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const loadedRef = useRef(false);
  const trainMarkersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  // 最新の onSelect を参照するための ref(マーカー生成時のクロージャ固定を回避)
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // --- 地図の初期化(一度だけ) ---
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    // クリーンアップ時に参照する Map を固定
    const trainMarkers = trainMarkersRef.current;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      bounds: INITIAL_BOUNDS,
      fitBoundsOptions: { padding: 48 },
      attributionControl: false,
    });
    mapRef.current = map;

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-right",
    );

    map.on("load", () => {
      loadedRef.current = true;

      // 路線(LineString)
      map.addSource("route", { type: "geojson", data: ROUTE_LINE });
      map.addLayer({
        id: "route-line-casing",
        type: "line",
        source: "route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#052e22", "line-width": 8 },
      });
      map.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#10b981", "line-width": 4 },
      });

      // 駅マーカー(HTML マーカーで駅名ラベルも表示)
      for (const station of STATIONS) {
        const el = document.createElement("div");
        el.className = "flex flex-col items-center pointer-events-none select-none";
        el.innerHTML = `
          <span class="block h-3 w-3 rounded-full border-2 border-emerald-300 bg-rail-bg shadow"></span>
          <span class="mt-1 rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-medium leading-none text-emerald-100 whitespace-nowrap">${station.name}</span>
        `;
        new maplibregl.Marker({ element: el, anchor: "top" })
          .setLngLat([station.longitude, station.latitude])
          .addTo(map);
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
      loadedRef.current = false;
      trainMarkers.clear();
    };
  }, []);

  // --- 列車マーカーの更新 ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;

    const markers = trainMarkersRef.current;
    const seen = new Set<string>();

    for (const train of trains) {
      seen.add(train.id);
      const appearance = getStatusAppearance(train, now);
      const isSelected = train.id === selectedId;

      let marker = markers.get(train.id);
      if (!marker) {
        const el = createTrainElement();
        el.addEventListener("click", () => onSelectRef.current(train.id));
        el.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelectRef.current(train.id);
          }
        });
        marker = new maplibregl.Marker({ element: el, anchor: "center" });
        marker.setLngLat([train.longitude, train.latitude]).addTo(map);
        markers.set(train.id, marker);
      } else {
        marker.setLngLat([train.longitude, train.latitude]);
      }

      styleTrainElement(marker.getElement(), {
        color: appearance.color,
        ring: appearance.ring,
        symbol: appearance.symbol,
        label: `${train.trainNumber} ${appearance.label}`,
        trainNumber: train.trainNumber,
        selected: isSelected,
      });
    }

    // 消えた列車のマーカーを削除
    for (const [id, marker] of markers) {
      if (!seen.has(id)) {
        marker.remove();
        markers.delete(id);
      }
    }
  }, [trains, selectedId, now]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 h-full w-full"
      aria-label="東海道線の列車位置地図"
      role="application"
    />
  );
}

/** 列車マーカーの DOM 要素を生成する(スタイルは styleTrainElement で適用)。 */
function createTrainElement(): HTMLDivElement {
  const el = document.createElement("div");
  el.tabIndex = 0;
  el.setAttribute("role", "button");
  // タップ領域を十分に確保
  el.className = "cursor-pointer";
  el.innerHTML = `
    <div data-pill class="flex items-center gap-1 rounded-full border-2 px-2 py-1 shadow-lg transition-transform">
      <span data-symbol class="text-[13px] leading-none font-bold"></span>
      <span data-num class="text-[11px] leading-none font-semibold whitespace-nowrap"></span>
    </div>
  `;
  return el;
}

interface TrainStyleArgs {
  color: string;
  ring: string;
  symbol: string;
  label: string;
  trainNumber: string;
  selected: boolean;
}

function styleTrainElement(el: HTMLElement, args: TrainStyleArgs): void {
  el.setAttribute("aria-label", args.label);
  const pill = el.querySelector<HTMLElement>("[data-pill]");
  const symbol = el.querySelector<HTMLElement>("[data-symbol]");
  const num = el.querySelector<HTMLElement>("[data-num]");
  if (pill) {
    pill.style.backgroundColor = args.color;
    pill.style.borderColor = args.selected ? "#ffffff" : args.ring;
    pill.style.color = pillTextColor(args.color);
    pill.style.transform = args.selected ? "scale(1.18)" : "scale(1)";
    pill.style.boxShadow = args.selected
      ? "0 0 0 3px rgba(255,255,255,0.5), 0 4px 10px rgba(0,0,0,0.5)"
      : "0 2px 6px rgba(0,0,0,0.5)";
  }
  if (symbol) symbol.textContent = args.symbol;
  if (num) num.textContent = args.trainNumber;
}

/** 背景色に応じて文字色(黒/白)を選ぶ。可読性確保。 */
function pillTextColor(bg: string): string {
  // 明るい黄色系のみ黒文字、それ以外は白
  return bg.toLowerCase() === "#eab308" ? "#1a1a1a" : "#ffffff";
}
