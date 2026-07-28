"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { TrainLocation } from "@/types/train";
import type { RailwayMapLine } from "@/types/railway";
import { MAP_STYLE } from "@/features/map/mapStyle";
import { getStatusAppearance } from "@/lib/trainStatus";
import { getRouteIndex } from "@/lib/routeGeometry";
import { advanceEstimatedFraction } from "@/lib/trainMotion";
import {
  buildPolylineIndex,
  positionAtFraction,
  type PolylineIndex,
} from "@/lib/geo";

interface TrainMapInnerProps {
  trains: TrainLocation[];
  railwayLines: RailwayMapLine[];
  visibleLineIds: ReadonlySet<string>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** 色再計算のための現在時刻(1秒ごとに更新される) */
  now: Date;
}

interface TrainMotionState {
  currentFraction: number;
  fromFraction: number;
  toFraction: number;
  speedKmh: number;
  routeIndex: PolylineIndex;
  pathKey: string;
  marker: maplibregl.Marker;
}

// 東京〜横浜が収まる初期表示範囲(バウンディングボックス)
const INITIAL_BOUNDS: [[number, number], [number, number]] = [
  [138.45, 34.75], // 関東南西
  [141.0, 36.95], // 関東北東
];

// 実速度相当ではスマホ画面上の移動がほぼ見えないため、表示用の推定移動だけを少し強調する。
// 詳細画面の速度値や、駅間を越えない制限には影響しない。
const ESTIMATED_MOTION_SPEED_MULTIPLIER = 3;

/**
 * MapLibre GL による地図描画コンポーネント。
 * SSR では読み込まれない(dynamic import + ssr:false)前提のクライアント専用。
 */
export default function TrainMapInner({
  trains,
  railwayLines,
  visibleLineIds,
  selectedId,
  onSelect,
  now,
}: TrainMapInnerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const loadedRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  const trainMarkersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const trainMotionRef = useRef<Map<string, TrainMotionState>>(new Map());
  // 最新の onSelect を参照するための ref(マーカー生成時のクロージャ固定を回避)
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // --- 地図の初期化(一度だけ) ---
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    // クリーンアップ時に参照する Map を固定
    const trainMarkers = trainMarkersRef.current;
    const trainMotions = trainMotionRef.current;

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
      setMapReady(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      loadedRef.current = false;
      setMapReady(false);
      trainMarkers.clear();
      trainMotions.clear();
    };
  }, []);

  // --- 路線レイヤーの追加・表示切り替え ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const activeSourceIds = new Set<string>();
    for (const line of railwayLines) {
      const sourceId = `railway-route-${line.id}`;
      const casingId = `${sourceId}-casing`;
      const lineId = `${sourceId}-line`;
      activeSourceIds.add(sourceId);

      const data = {
        type: "Feature" as const,
        properties: { id: line.id, name: line.name },
        geometry: {
          type: "MultiLineString" as const,
          coordinates: line.coordinates,
        },
      };

      const source = map.getSource(sourceId) as
        | maplibregl.GeoJSONSource
        | undefined;
      if (source) {
        source.setData(data);
      } else {
        map.addSource(sourceId, { type: "geojson", data });
        map.addLayer({
          id: casingId,
          type: "line",
          source: sourceId,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": "#24170d",
            "line-width": 7,
            "line-opacity": 0.85,
          },
        });
        map.addLayer({
          id: lineId,
          type: "line",
          source: sourceId,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": line.color,
            "line-width": 4,
            "line-opacity": 0.9,
          },
        });
      }

      const visibility = visibleLineIds.has(line.id) ? "visible" : "none";
      if (map.getLayer(casingId)) {
        map.setLayoutProperty(casingId, "visibility", visibility);
      }
      if (map.getLayer(lineId)) {
        map.setLayoutProperty(lineId, "visibility", visibility);
        map.setPaintProperty(lineId, "line-color", line.color);
      }
    }

    const style = map.getStyle();
    for (const sourceId of Object.keys(style.sources ?? {})) {
      if (
        !sourceId.startsWith("railway-route-") ||
        activeSourceIds.has(sourceId)
      ) {
        continue;
      }
      const casingId = `${sourceId}-casing`;
      const lineId = `${sourceId}-line`;
      if (map.getLayer(lineId)) map.removeLayer(lineId);
      if (map.getLayer(casingId)) map.removeLayer(casingId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    }
  }, [mapReady, railwayLines, visibleLineIds]);

  // --- ODPT の駅間情報を越えない範囲で、推定位置を滑らかに進める ---
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let animationFrame = 0;
    let previousTimestamp: number | null = null;
    const animate = (timestamp: number) => {
      if (previousTimestamp !== null) {
        const elapsedMs = Math.min(100, timestamp - previousTimestamp);

        for (const motion of trainMotionRef.current.values()) {
          const nextFraction = advanceEstimatedFraction({
            currentFraction: motion.currentFraction,
            fromFraction: motion.fromFraction,
            toFraction: motion.toFraction,
            speedKmh: motion.speedKmh,
            routeLengthMeters: motion.routeIndex.totalLength,
            elapsedMs,
          });

          if (nextFraction !== motion.currentFraction) {
            motion.currentFraction = nextFraction;
            const [longitude, latitude] = positionAtFraction(
              motion.routeIndex,
              nextFraction,
            );
            motion.marker.setLngLat([longitude, latitude]);
          }
        }
      }

      previousTimestamp = timestamp;
      animationFrame = window.requestAnimationFrame(animate);
    };

    animationFrame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(animationFrame);
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

      const routeSegment = train.routeSegment;
      const shouldAnimate =
        train.dataAccuracy === "estimated" &&
        appearance.level === "running" &&
        train.speedKmh > 0 &&
        routeSegment !== null &&
        routeSegment.fromFraction !== routeSegment.toFraction;

      if (shouldAnimate && routeSegment) {
        const routeIndex =
          routeSegment.coordinates && routeSegment.coordinates.length >= 2
            ? buildPolylineIndex(routeSegment.coordinates)
            : getRouteIndex();
        const pathKey = routeSegment.coordinates
          ? routeSegment.coordinates.flat().join(",")
          : "tokaido";
        const existingMotion = trainMotionRef.current.get(train.id);
        const segmentChanged =
          !existingMotion ||
          existingMotion.fromFraction !== routeSegment.fromFraction ||
          existingMotion.toFraction !== routeSegment.toFraction ||
          existingMotion.pathKey !== pathKey;

        let currentFraction =
          (routeSegment.fromFraction + routeSegment.toFraction) / 2;
        if (existingMotion && segmentChanged) {
          const minFraction = Math.min(
            routeSegment.fromFraction,
            routeSegment.toFraction,
          );
          const maxFraction = Math.max(
            routeSegment.fromFraction,
            routeSegment.toFraction,
          );
          currentFraction = Math.min(
            maxFraction,
            Math.max(minFraction, existingMotion.currentFraction),
          );
        } else if (existingMotion) {
          currentFraction = existingMotion.currentFraction;
        }

        const [animatedLongitude, animatedLatitude] =
          positionAtFraction(routeIndex, currentFraction);
        marker.setLngLat([animatedLongitude, animatedLatitude]);
        trainMotionRef.current.set(train.id, {
          currentFraction,
          fromFraction: routeSegment.fromFraction,
          toFraction: routeSegment.toFraction,
          speedKmh: train.speedKmh * ESTIMATED_MOTION_SPEED_MULTIPLIER,
          routeIndex,
          pathKey,
          marker,
        });
      } else {
        trainMotionRef.current.delete(train.id);
        marker.setLngLat([train.longitude, train.latitude]);
      }

      const directionLabel = train.direction === "inbound" ? "上り" : "下り";
      styleTrainElement(marker.getElement(), {
        color: appearance.color,
        ring: appearance.ring,
        symbol: appearance.symbol,
        label: `${train.lineName} ${directionLabel} ${train.destination}行 ${appearance.label}`,
        lineColor: train.lineColor,
        direction: train.direction,
        selected: isSelected,
      });
    }

    // 消えた列車のマーカーを削除
    for (const [id, marker] of markers) {
      if (!seen.has(id)) {
        marker.remove();
        markers.delete(id);
        trainMotionRef.current.delete(id);
      }
    }
  }, [trains, selectedId, now]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 h-full w-full"
      aria-label="関東エリアのJR列車位置地図"
      role="application"
    />
  );
}

/** 小さな表示でも表情が分かる、丸みのある正面向き電車アイコン。 */
const TRAIN_ICON_SVG = `
<svg viewBox="0 0 32 32" class="h-[36px] w-[36px]" aria-hidden="true">
  <path d="M9 4.5h14c3 0 5 2.2 5 5v12.2c0 3.2-2.5 5.8-5.7 5.8H9.7C6.5 27.5 4 24.9 4 21.7V9.5c0-2.8 2-5 5-5Z"
        fill="none" stroke="#fffdf9" stroke-width="4.5" stroke-linejoin="round"/>
  <path d="M9 4.5h14c3 0 5 2.2 5 5v12.2c0 3.2-2.5 5.8-5.7 5.8H9.7C6.5 27.5 4 24.9 4 21.7V9.5c0-2.8 2-5 5-5Z"
        data-train-body fill="#f68b1e" stroke="#493b38" stroke-width="1.5"/>
  <rect x="7" y="7.5" width="18" height="10" rx="4" fill="#fffaf7" stroke="#493b38" stroke-width="1.2"/>
  <circle cx="11.5" cy="12.4" r="1.35" fill="#493b38"/>
  <circle cx="20.5" cy="12.4" r="1.35" fill="#493b38"/>
  <path d="M13.2 14.6c.8.9 1.7 1.3 2.8 1.3s2-.4 2.8-1.3"
        fill="none" stroke="#493b38" stroke-width="1.2" stroke-linecap="round"/>
  <circle cx="9" cy="21.5" r="2" fill="#ffafc2"/>
  <circle cx="23" cy="21.5" r="2" fill="#ffafc2"/>
  <path d="M12 22.2h8" stroke="#493b38" stroke-width="1.4" stroke-linecap="round"/>
  <path d="m9 27.2-2 2.3M23 27.2l2 2.3" stroke="#493b38" stroke-width="1.7" stroke-linecap="round"/>
</svg>`;

/**
 * 列車マーカーの DOM 要素を生成する(スタイルは styleTrainElement で適用)。
 *
 * 構成:
 *   - 路線カラーで塗られた、表情のある電車アイコン
 *   - 状態記号のバッジ(色に依存せず状態がわかるようにする)
 */
function createTrainElement(): HTMLDivElement {
  const el = document.createElement("div");
  el.tabIndex = 0;
  el.setAttribute("role", "button");
  // タップ領域を十分に確保
  el.className = "cursor-pointer";
  el.innerHTML = `
    <div data-pill class="relative flex h-[40px] w-[40px] items-center justify-center transition-transform">
      <span data-icon class="flex shrink-0 items-center">${TRAIN_ICON_SVG}</span>
      <span data-badge
            class="absolute -right-1.5 -top-1.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full border text-[9px] font-bold leading-none"></span>
      <span data-direction
            class="pointer-events-none absolute left-1/2 top-[calc(100%+2px)] -translate-x-1/2 rounded-full border px-1.5 py-0.5 text-[10px] font-black leading-none text-white whitespace-nowrap shadow-md"></span>
    </div>
  `;
  return el;
}

interface TrainStyleArgs {
  color: string;
  ring: string;
  symbol: string;
  label: string;
  lineColor: string;
  direction: TrainLocation["direction"];
  selected: boolean;
}

function styleTrainElement(el: HTMLElement, args: TrainStyleArgs): void {
  el.setAttribute("aria-label", args.label);
  const pill = el.querySelector<HTMLElement>("[data-pill]");
  const trainBody = el.querySelector<SVGElement>("[data-train-body]");
  const badge = el.querySelector<HTMLElement>("[data-badge]");
  const direction = el.querySelector<HTMLElement>("[data-direction]");

  if (pill) {
    pill.style.transform = args.selected ? "scale(1.18)" : "scale(1)";
    pill.style.filter = args.selected
      ? "drop-shadow(0 0 4px rgba(255,255,255,0.95)) drop-shadow(0 4px 4px rgba(0,0,0,0.55))"
      : "drop-shadow(0 3px 3px rgba(0,0,0,0.48))";
  }
  if (trainBody) trainBody.style.fill = args.lineColor;
  if (direction) {
    const isInbound = args.direction === "inbound";
    direction.textContent = isInbound ? "↑ 上り" : "↓ 下り";
    direction.style.backgroundColor = isInbound ? "#1e3a8a" : "#7c2d12";
    direction.style.borderColor = isInbound ? "#93c5fd" : "#fdba74";
  }
  if (badge) {
    // 通常走行時は余分な三角記号を出さず、注意が必要な状態だけ表示する。
    badge.style.display = args.symbol === "▶" ? "none" : "flex";
    badge.textContent = args.symbol;
    badge.style.backgroundColor = args.ring;
    badge.style.borderColor = args.color;
    badge.style.color = "#ffffff";
  }
}
