import type { StyleSpecification } from "maplibre-gl";

/**
 * 地図タイルの設定。
 *
 * OpenStreetMap ベースの CARTO Voyager タイルを使用し、
 * Google Maps に近い「明るく・道路や公園・POI が色分けされた」地図にする。
 *
 * 注意: 地図タイルには各提供元の利用規約がある。
 * 本番運用や商用利用の際は必ず利用条件を確認し、必要に応じて
 * 自前のタイルサーバーや契約済みプロバイダに差し替えること。
 */
const CARTO_VOYAGER_TILES = [
  "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
  "https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
  "https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
];

const ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors, © <a href="https://carto.com/attributions" target="_blank" rel="noreferrer">CARTO</a>';

export const MAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    "osm-voyager": {
      type: "raster",
      tiles: CARTO_VOYAGER_TILES,
      tileSize: 256,
      attribution: ATTRIBUTION,
    },
  },
  layers: [
    {
      // タイル読み込み前・失敗時でも地図が必ず描画されるよう、下地の背景を敷く
      // (Google Maps の読み込み中に近い明るいグレー)
      id: "background",
      type: "background",
      paint: { "background-color": "#e8eaed" },
    },
    {
      id: "osm-voyager",
      type: "raster",
      source: "osm-voyager",
    },
  ],
};
