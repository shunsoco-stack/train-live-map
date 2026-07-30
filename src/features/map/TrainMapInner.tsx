"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { TrainLocation } from "@/types/train";
import type { RailwayMapLine } from "@/types/railway";
import { MAP_STYLE } from "@/features/map/mapStyle";
import { getStatusAppearance } from "@/lib/trainStatus";
import { getRouteIndex } from "@/lib/routeGeometry";
import { advanceEstimatedFraction } from "@/lib/trainMotion";
import {
  DEFAULT_MAP_BOUNDS,
  getVisibleRailwayBounds,
} from "@/lib/mapViewport";
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

// 実速度相当ではスマホ画面上の移動がほぼ見えないため、表示用の推定移動だけを少し強調する。
// 詳細画面の速度値や、駅間を越えない制限には影響しない。
const ESTIMATED_MOTION_SPEED_MULTIPLIER = 3;
const ROUTE_LABEL_PIXEL_RATIO = 2;

function routeLabelText(name: string): string {
  return name.replace(/[（(][^）)]*[）)]/g, "").trim();
}

/**
 * ラスタ地図スタイルはglyphsを持たないため、路線名をCanvasで画像化する。
 * MapLibreのsymbolレイヤーに載せることで、線路に沿った回転・重なり回避が効く。
 */
let routeLabelCanvasWarningShown = false;

function createRouteLabelImage(
  name: string,
  lineColor: string,
): ImageData | null {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    if (!routeLabelCanvasWarningShown) {
      routeLabelCanvasWarningShown = true;
      console.warn(
        "路線名ラベル用のCanvasを初期化できないため、ラベルなしで続行します。",
      );
    }
    return null;
  }

  const fontSize = 12 * ROUTE_LABEL_PIXEL_RATIO;
  const horizontalPadding = 9 * ROUTE_LABEL_PIXEL_RATIO;
  const height = 24 * ROUTE_LABEL_PIXEL_RATIO;
  const roundedFontFamily =
    getComputedStyle(document.documentElement)
      .getPropertyValue("--font-rounded-web")
      .trim() || '"Hiragino Maru Gothic ProN"';
  const canvasFont = `700 ${fontSize}px ${roundedFontFamily}, "Hiragino Maru Gothic ProN", sans-serif`;
  context.font = canvasFont;
  const width = Math.ceil(
    Math.max(
      54 * ROUTE_LABEL_PIXEL_RATIO,
      context.measureText(name).width + horizontalPadding * 2,
    ),
  );

  canvas.width = width;
  canvas.height = height;

  context.font = canvasFont;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.lineJoin = "round";

  const inset = 2 * ROUTE_LABEL_PIXEL_RATIO;
  const radius = 10 * ROUTE_LABEL_PIXEL_RATIO;
  context.beginPath();
  context.roundRect(
    inset,
    inset,
    width - inset * 2,
    height - inset * 2,
    radius,
  );
  context.fillStyle = "rgba(36, 23, 13, 0.88)";
  context.fill();
  context.lineWidth = 2 * ROUTE_LABEL_PIXEL_RATIO;
  context.strokeStyle = lineColor;
  context.stroke();

  context.fillStyle = "#fffaf0";
  context.shadowColor = "rgba(0, 0, 0, 0.45)";
  context.shadowBlur = ROUTE_LABEL_PIXEL_RATIO;
  context.fillText(name, width / 2, height / 2 + ROUTE_LABEL_PIXEL_RATIO / 2);

  return context.getImageData(0, 0, width, height);
}

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
  const [geolocationError, setGeolocationError] = useState<string | null>(
    null,
  );
  const trainMarkersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const trainMotionRef = useRef<Map<string, TrainMotionState>>(new Map());
  const trainStyleArgsRef = useRef<WeakMap<HTMLElement, TrainStyleArgs>>(
    new WeakMap(),
  );
  const routeSourceIdsRef = useRef<Set<string>>(new Set());
  // 最新の onSelect を参照するための ref(マーカー生成時のクロージャ固定を回避)
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const visibleBounds = useMemo(
    () => getVisibleRailwayBounds(railwayLines, visibleLineIds),
    [railwayLines, visibleLineIds],
  );

  // --- 地図の初期化(一度だけ) ---
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    // クリーンアップ時に参照する Map を固定
    const trainMarkers = trainMarkersRef.current;
    const trainMotions = trainMotionRef.current;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      bounds: DEFAULT_MAP_BOUNDS,
      fitBoundsOptions: { padding: 40, maxZoom: 10.5 },
      attributionControl: false,
      locale: {
        "GeolocateControl.FindMyLocation": "現在地を表示",
        "GeolocateControl.LocationNotAvailable":
          "現在地を取得できません",
      },
    });
    mapRef.current = map;

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    const geolocateControl = new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: false },
      showAccuracyCircle: true,
      showUserLocation: true,
      trackUserLocation: false,
    });
    geolocateControl.on("geolocate", () => setGeolocationError(null));
    geolocateControl.on("error", () => {
      setGeolocationError(
        "現在地を取得できません。ブラウザの位置情報設定をご確認ください。",
      );
    });
    map.addControl(geolocateControl, "top-right");
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
      trainStyleArgsRef.current = new WeakMap();
      routeSourceIdsRef.current.clear();
    };
  }, []);

  // --- 路線レイヤーの追加・表示切り替え ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const activeSourceIds = new Set<string>();
    for (const line of railwayLines) {
      const visible = visibleLineIds.has(line.id);
      const sourceId = `railway-route-${line.id}`;
      const casingId = `${sourceId}-casing`;
      const lineId = `${sourceId}-line`;
      const labelId = `${sourceId}-label`;
      const labelImageId = `${sourceId}-label-image`;
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
      }

      if (visible && !map.hasImage(labelImageId)) {
        const labelImage = createRouteLabelImage(
          routeLabelText(line.name),
          line.color,
        );
        if (labelImage) {
          map.addImage(labelImageId, labelImage, {
            pixelRatio: ROUTE_LABEL_PIXEL_RATIO,
          });
        }
      }

      if (!map.getLayer(casingId)) {
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
      }
      if (!map.getLayer(lineId)) {
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
      if (map.hasImage(labelImageId) && !map.getLayer(labelId)) {
        map.addLayer({
          id: labelId,
          type: "symbol",
          source: sourceId,
          minzoom: 7,
          layout: {
            "symbol-placement": "line",
            "symbol-spacing": 250,
            "icon-image": labelImageId,
            "icon-size": [
              "interpolate",
              ["linear"],
              ["zoom"],
              7,
              0.82,
              11,
              1,
              14,
              1.08,
            ],
            "icon-rotation-alignment": "map",
            "icon-pitch-alignment": "map",
            "icon-keep-upright": true,
            "icon-padding": 7,
            "icon-allow-overlap": false,
            "icon-ignore-placement": false,
          },
        });
      }

      const visibility = visible ? "visible" : "none";
      if (map.getLayer(casingId)) {
        map.setLayoutProperty(casingId, "visibility", visibility);
      }
      if (map.getLayer(lineId)) {
        map.setLayoutProperty(lineId, "visibility", visibility);
        map.setPaintProperty(lineId, "line-color", line.color);
      }
      if (map.getLayer(labelId)) {
        map.setLayoutProperty(labelId, "visibility", visibility);
      }
    }

    for (const sourceId of routeSourceIdsRef.current) {
      if (activeSourceIds.has(sourceId)) continue;
      const casingId = `${sourceId}-casing`;
      const lineId = `${sourceId}-line`;
      const labelId = `${sourceId}-label`;
      const labelImageId = `${sourceId}-label-image`;
      if (map.getLayer(labelId)) map.removeLayer(labelId);
      if (map.getLayer(lineId)) map.removeLayer(lineId);
      if (map.getLayer(casingId)) map.removeLayer(casingId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
      if (map.hasImage(labelImageId)) map.removeImage(labelImageId);
    }
    routeSourceIdsRef.current = activeSourceIds;
  }, [mapReady, railwayLines, visibleLineIds]);

  // --- 選択路線が画面の主役になるよう、表示範囲を自動調整 ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !visibleBounds) return;

    const compact = window.matchMedia("(max-width: 639px)").matches;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    map.stop();
    map.resize();
    map.fitBounds(visibleBounds, {
      padding: compact
        ? { top: 72, right: 32, bottom: 116, left: 32 }
        : { top: 76, right: 72, bottom: 84, left: 72 },
      maxZoom: 10.5,
      duration: reducedMotion ? 0 : 650,
    });
  }, [mapReady, visibleBounds]);

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

      const styleArgs: TrainStyleArgs = {
        color: appearance.color,
        ring: appearance.ring,
        symbol: appearance.symbol,
        label: [
          train.lineName,
          train.directionLabel,
          `${train.destination}行`,
          appearance.label,
        ]
          .filter(Boolean)
          .join(" "),
        lineColor: train.lineColor,
        directionKind: train.directionKind,
        directionLabel: train.directionLabel,
        face:
          train.status === "suspended"
            ? "suspended"
            : train.status === "delayed" || train.delayMinutes > 0
              ? "delayed"
              : "normal",
        delayMinutes:
          train.status === "suspended"
            ? 0
            : Math.max(0, Math.round(train.delayMinutes)),
        selected: isSelected,
      };
      const markerElement = marker.getElement();
      const previousStyleArgs = trainStyleArgsRef.current.get(markerElement);
      if (
        !previousStyleArgs ||
        !sameTrainStyleArgs(previousStyleArgs, styleArgs)
      ) {
        styleTrainElement(markerElement, styleArgs);
        trainStyleArgsRef.current.set(markerElement, styleArgs);
      }
    }

    // 消えた列車のマーカーを削除
    for (const [id, marker] of markers) {
      if (!seen.has(id)) {
        trainStyleArgsRef.current.delete(marker.getElement());
        marker.remove();
        markers.delete(id);
        trainMotionRef.current.delete(id);
      }
    }
  }, [trains, selectedId, now]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !selectedId) return;
    const marker = trainMarkersRef.current.get(selectedId);
    if (!marker) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    map.stop();
    map.easeTo({
      center: marker.getLngLat(),
      zoom: Math.max(map.getZoom(), 13),
      duration: reducedMotion ? 0 : 650,
    });
  }, [mapReady, selectedId]);

  return (
    <>
      <div
        ref={containerRef}
        className="absolute inset-0 h-full w-full"
        aria-label="関東エリアのJR列車位置地図"
        role="application"
      />
      {geolocationError && (
        <p
          role="status"
          className="app-material pointer-events-none absolute right-3 top-24 z-20 max-w-[17rem] rounded-xl border border-amber-300/50 px-3 py-2 text-xs leading-5 text-amber-100 shadow-lg"
        >
          {geolocationError}
        </p>
      )}
    </>
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
  <g data-train-face="normal">
    <circle cx="11.5" cy="12.4" r="1.35" fill="#493b38"/>
    <circle cx="20.5" cy="12.4" r="1.35" fill="#493b38"/>
    <path d="M13.2 14.6c.8.9 1.7 1.3 2.8 1.3s2-.4 2.8-1.3"
          fill="none" stroke="#493b38" stroke-width="1.2" stroke-linecap="round"/>
  </g>
  <g data-train-face="delayed" style="display:none">
    <path d="m9.4 11.5 3.5-.9M19.1 10.6l3.5.9"
          fill="none" stroke="#493b38" stroke-width="1.1" stroke-linecap="round"/>
    <circle cx="11.5" cy="13" r="1.15" fill="#493b38"/>
    <circle cx="20.5" cy="13" r="1.15" fill="#493b38"/>
    <path d="M13.2 15.6c.8-.8 1.7-1.2 2.8-1.2s2 .4 2.8 1.2"
          fill="none" stroke="#493b38" stroke-width="1.2" stroke-linecap="round"/>
  </g>
  <g data-train-face="suspended" style="display:none">
    <path d="m9.3 11.5 3.6-.9M19.1 10.6l3.6.9"
          fill="none" stroke="#493b38" stroke-width="1.1" stroke-linecap="round"/>
    <path d="M9.7 12.8c1.1.7 2.3.7 3.5 0M18.8 12.8c1.2.7 2.4.7 3.5 0"
          fill="none" stroke="#493b38" stroke-width="1.15" stroke-linecap="round"/>
    <path d="M13.1 16c.8-.9 1.8-1.3 2.9-1.3s2.1.4 2.9 1.3"
          fill="none" stroke="#493b38" stroke-width="1.2" stroke-linecap="round"/>
    <path d="M11.5 13.4v2.2M20.5 13.4v2.2"
          fill="none" stroke="#38bdf8" stroke-width="1.25" stroke-linecap="round"/>
    <circle cx="11.5" cy="16.1" r=".72" fill="#38bdf8" stroke="#258bb5" stroke-width=".3"/>
    <circle cx="20.5" cy="16.1" r=".72" fill="#38bdf8" stroke="#258bb5" stroke-width=".3"/>
  </g>
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
  el.className = "train-marker cursor-pointer outline-none";
  el.innerHTML = `
    <div data-pill class="relative flex h-[40px] w-[40px] items-center justify-center transition-transform">
      <span data-delay
            class="pointer-events-none absolute bottom-[calc(100%-1px)] left-1/2 z-10 hidden -translate-x-1/2 items-center justify-center rounded-full border-2 border-white bg-[#e84462] px-2 py-1 text-[11px] font-black leading-none text-white whitespace-nowrap shadow-[0_2px_5px_rgba(0,0,0,0.38)]">
        <span data-delay-text></span>
        <span aria-hidden="true"
              class="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 -translate-y-[5px] rotate-45 border-b-2 border-r-2 border-white bg-[#e84462]"></span>
      </span>
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
  directionKind: TrainLocation["directionKind"];
  directionLabel: TrainLocation["directionLabel"];
  face: "normal" | "delayed" | "suspended";
  delayMinutes: number;
  selected: boolean;
}

function sameTrainStyleArgs(
  previous: TrainStyleArgs,
  next: TrainStyleArgs,
): boolean {
  return (
    previous.color === next.color &&
    previous.ring === next.ring &&
    previous.symbol === next.symbol &&
    previous.label === next.label &&
    previous.lineColor === next.lineColor &&
    previous.directionKind === next.directionKind &&
    previous.directionLabel === next.directionLabel &&
    previous.face === next.face &&
    previous.delayMinutes === next.delayMinutes &&
    previous.selected === next.selected
  );
}

function styleTrainElement(el: HTMLElement, args: TrainStyleArgs): void {
  el.setAttribute(
    "aria-label",
    args.delayMinutes > 0
      ? `${args.label} ${args.delayMinutes}分遅れ`
      : args.label,
  );
  const pill = el.querySelector<HTMLElement>("[data-pill]");
  const trainBody = el.querySelector<SVGElement>("[data-train-body]");
  const faces =
    el.querySelectorAll<SVGGElement>("[data-train-face]");
  const badge = el.querySelector<HTMLElement>("[data-badge]");
  const direction = el.querySelector<HTMLElement>("[data-direction]");
  const delay = el.querySelector<HTMLElement>("[data-delay]");
  const delayText = el.querySelector<HTMLElement>("[data-delay-text]");

  el.style.zIndex = args.selected ? "20" : "";
  el.dataset.selected = args.selected ? "true" : "false";
  if (pill) {
    pill.style.transform = args.selected ? "scale(1.18)" : "scale(1)";
    pill.style.filter = args.selected
      ? "drop-shadow(0 0 4px rgba(255,255,255,0.95)) drop-shadow(0 4px 4px rgba(0,0,0,0.55))"
      : "drop-shadow(0 3px 3px rgba(0,0,0,0.48))";
  }
  if (trainBody) trainBody.style.fill = args.lineColor;
  for (const face of faces) {
    face.style.display =
      face.dataset.trainFace === args.face ? "inline" : "none";
  }
  if (delay && delayText) {
    delay.style.display = args.delayMinutes > 0 ? "flex" : "none";
    delayText.textContent =
      args.delayMinutes > 0 ? `+${args.delayMinutes}分` : "";
  }
  if (direction) {
    const directionStyle = directionBadgeStyle(args.directionKind);
    direction.style.display =
      args.directionLabel && directionStyle ? "inline-flex" : "none";
    if (args.directionLabel && directionStyle) {
      direction.textContent = `${directionStyle.symbol} ${args.directionLabel}`;
      direction.style.backgroundColor = directionStyle.backgroundColor;
      direction.style.borderColor = directionStyle.borderColor;
    }
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

interface DirectionBadgeStyle {
  symbol: string;
  backgroundColor: string;
  borderColor: string;
}

function directionBadgeStyle(
  directionKind: TrainLocation["directionKind"],
): DirectionBadgeStyle | null {
  switch (directionKind) {
    case "up":
      return { symbol: "↑", backgroundColor: "#1e3a8a", borderColor: "#93c5fd" };
    case "down":
      return { symbol: "↓", backgroundColor: "#7c2d12", borderColor: "#fdba74" };
    case "inner-loop":
      return { symbol: "↻", backgroundColor: "#581c87", borderColor: "#d8b4fe" };
    case "outer-loop":
      return { symbol: "↺", backgroundColor: "#581c87", borderColor: "#d8b4fe" };
    case "north":
      return { symbol: "↑", backgroundColor: "#115e59", borderColor: "#5eead4" };
    case "south":
      return { symbol: "↓", backgroundColor: "#115e59", borderColor: "#5eead4" };
    case "east":
      return { symbol: "→", backgroundColor: "#115e59", borderColor: "#5eead4" };
    case "west":
      return { symbol: "←", backgroundColor: "#115e59", borderColor: "#5eead4" };
    case "unknown":
    default:
      return null;
  }
}
