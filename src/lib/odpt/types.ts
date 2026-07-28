/**
 * ODPT API のレスポンス型定義。
 *
 * odpt:Train(列車位置)と odpt:TrainInformation(運行情報)の
 * 主要フィールドを型付けする。実際のフィードには他にもフィールドがあるため、
 * 未知フィールドは無視する(any は使わない)。
 *
 * 参考: odpt:Train は多くの事業者で緯度経度(geo:lat/geo:long)を
 * 持たず、fromStation / toStation による「駅間」ベースの相対位置で表現される。
 */

/** odpt:Train 1 件 */
export interface OdptTrain {
  "@id"?: string;
  "@type"?: string;
  /** 固有 ID(例: odpt.Train:JR-East.Tokaido.123M) */
  "owl:sameAs"?: string;
  /** データ生成時刻(ISO8601) */
  "dc:date"?: string;
  /** データ有効期限(ISO8601) */
  "odpt:valid"?: string;
  /** 推奨再取得間隔(秒) */
  "odpt:frequency"?: number;
  /** 路線(例: odpt.Railway:JR-East.Tokaido) */
  "odpt:railway"?: string;
  /** 事業者(例: odpt.Operator:JR-East) */
  "odpt:operator"?: string;
  /** 列車番号 */
  "odpt:trainNumber"?: string;
  /** 列車種別(例: odpt.TrainType:JR-East.Local) */
  "odpt:trainType"?: string;
  /** 直前(出発)駅(例: odpt.Station:JR-East.Tokaido.Shimbashi) */
  "odpt:fromStation"?: string | null;
  /** 次駅。駅停車中は null のことがある */
  "odpt:toStation"?: string | null;
  /** 進行方向(例: odpt.RailDirection:Inbound / Outbound) */
  "odpt:railDirection"?: string | null;
  /** 遅延(秒) */
  "odpt:delay"?: number;
  /** 行先(配列) */
  "odpt:destinationStation"?: string[];
  /** 始発駅 */
  "odpt:startingStation"?: string[];
  /** 終着駅 */
  "odpt:terminalStation"?: string[];
  /** 緯度(提供される場合のみ) */
  "geo:lat"?: number;
  /** 経度(提供される場合のみ) */
  "geo:long"?: number;
}

/** odpt:Railway 1 件(路線情報。診断用に利用可能な路線 ID を調べる) */
export interface OdptRailway {
  "@id"?: string;
  "@type"?: string;
  /** 路線 ID(例: odpt.Railway:JR-East.Tokaido) */
  "owl:sameAs"?: string;
  /** 路線名(日本語) */
  "dc:title"?: string;
  "odpt:operator"?: string;
  "odpt:railwayTitle"?: string | { ja?: string; en?: string };
  "odpt:color"?: string;
  "odpt:stationOrder"?: Array<{
    "odpt:index"?: number;
    "odpt:station"?: string;
    "odpt:stationTitle"?: string | { ja?: string; en?: string };
  }>;
  "ug:region"?: {
    type?: "Feature";
    geometry?: {
      type?: "LineString" | "MultiLineString";
      coordinates?: unknown;
    };
  };
}

/** odpt:Station 1 件 */
export interface OdptStation {
  "@id"?: string;
  "@type"?: string;
  "owl:sameAs"?: string;
  "dc:title"?: string;
  "odpt:operator"?: string;
  "odpt:railway"?: string;
  "odpt:stationTitle"?: string | { ja?: string; en?: string };
  "geo:lat"?: number;
  "geo:long"?: number;
}

/** odpt:TrainInformation 1 件(運行情報) */
export interface OdptTrainInformation {
  "@id"?: string;
  "@type"?: string;
  "owl:sameAs"?: string;
  "dc:date"?: string;
  "odpt:operator"?: string;
  "odpt:railway"?: string;
  /** 運行情報テキスト(日本語) */
  "odpt:trainInformationText"?: string | { ja?: string; en?: string };
  /** 情報の種別(遅延・見合わせ等。事業者により有無が異なる) */
  "odpt:trainInformationStatus"?: string | { ja?: string; en?: string };
}
