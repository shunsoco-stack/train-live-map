import type { StyleSpecification } from "maplibre-gl";

/**
 * 地図タイルの設定。
 *
 * OpenStreetMap ベースの CARTO ダークタイルを使用し、
 * 鉄道アプリらしい落ち着いた暗色の地図にする。
 *
 * 注意: 地図タイルには各提供元の利用規約がある。
 * 本番運用や商用利用の際は必ず利用条件を確認し、必要に応じて
 * 自前のタイルサーバーや契約済みプロバイダに差し替えること。
 */
const CARTO_DARK_TILES = [
  "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
  "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
  "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
];

const ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors, © <a href="https://carto.com/attributions" target="_blank" rel="noreferrer">CARTO</a>';

export const MAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    "osm-dark": {
      type: "raster",
      tiles: CARTO_DARK_TILES,
      tileSize: 256,
      attribution: ATTRIBUTION,
    },
  },
  layers: [
    {
      id: "osm-dark",
      type: "raster",
      source: "osm-dark",
    },
  ],
};
