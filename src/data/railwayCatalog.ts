import type {
  RailwayCatalogLine,
  RailwayFilterOption,
} from "@/types/railway";
import { createLogger } from "../lib/logger.ts";

function line(
  id: string,
  name: string,
  category: string,
  color: string,
  aliases: string[],
  coverage: RailwayCatalogLine["coverage"] = "unknown",
  coverageNote: string | null = null,
  kind: RailwayCatalogLine["kind"] = "line",
): RailwayCatalogLine {
  return {
    id,
    name,
    category,
    color,
    aliases,
    coverage,
    coverageNote,
    kind,
  };
}

/**
 * JR東日本「関東エリアの運行情報」に掲載される路線・運行系統。
 * 重複掲載される路線は1件にまとめ、直通サービスは独立した表示単位にする。
 */
export const RAILWAY_CATALOG: RailwayCatalogLine[] = [
  line("yamanote", "山手線", "山手線", "#9acd32", ["山手", "Yamanote"]),

  line("ueno-tokyo", "上野東京ライン", "直通系統", "#f68b1e", ["上野東京", "UenoTokyo"], "unknown", null, "service"),
  line("shonan-shinjuku", "湘南新宿ライン", "直通系統", "#e21f26", ["湘南新宿", "ShonanShinjuku"], "unknown", null, "service"),
  line("sotetsu-through", "相鉄線直通列車", "直通系統", "#00a7e3", ["相鉄線直通", "Sotetsu"], "unknown", null, "service"),

  line("tokaido", "東海道線", "東海道方面", "#f68b1e", ["東海道", "Tokaido"], "realtime"),
  line("keihin-tohoku", "京浜東北線", "東海道方面", "#00a7e3", ["京浜東北", "KeihinTohoku", "KeihinTohokuNegishi"]),
  line("yokosuka", "横須賀線", "東海道方面", "#0067c0", ["横須賀", "Yokosuka"]),
  line("nambu", "南武線", "東海道方面", "#ffd400", ["南武", "Nambu"]),
  line("yokohama", "横浜線", "東海道方面", "#9acd32", ["横浜", "Yokohama"]),
  line("ito", "伊東線", "東海道方面", "#f68b1e", ["伊東", "Ito"]),
  line("sagami", "相模線", "東海道方面", "#009793", ["相模", "Sagami"], "unavailable", "ODPT列車位置情報の対象外"),
  line("tsurumi", "鶴見線", "東海道方面", "#ffd400", ["鶴見", "Tsurumi"], "unavailable", "ODPT列車位置情報の対象外"),

  line("utsunomiya", "宇都宮線", "東北・高崎方面", "#f68b1e", ["宇都宮", "Tohoku", "Utsunomiya"]),
  line("takasaki", "高崎線", "東北・高崎方面", "#f68b1e", ["高崎", "Takasaki"], "limited", "神保原駅以南のみ"),
  line("saikyo", "埼京線", "東北・高崎方面", "#00ac9a", ["埼京", "Saikyo"]),
  line("kawagoe", "川越線", "東北・高崎方面", "#00ac9a", ["川越", "Kawagoe"]),
  line("musashino", "武蔵野線", "東北・高崎方面", "#f15a22", ["武蔵野", "Musashino"]),
  line("joetsu", "上越線", "東北・高崎方面", "#00b3e6", ["上越", "Joetsu"]),
  line("shinetsu", "信越本線", "東北・高崎方面", "#00b3e6", ["信越", "Shinetsu"]),
  line("agatsuma", "吾妻線", "東北・高崎方面", "#00b3e6", ["吾妻", "Agatsuma"]),
  line("karasuyama", "烏山線", "東北・高崎方面", "#3b82f6", ["烏山", "Karasuyama"]),
  line("hachiko", "八高線", "東北・高崎方面", "#a8a39d", ["八高", "Hachiko"], "unavailable", "ODPT列車位置情報の対象外"),
  line("nikko", "日光線", "東北・高崎方面", "#884898", ["日光", "Nikko"]),
  line("ryomo", "両毛線", "東北・高崎方面", "#ffd400", ["両毛", "Ryomo"]),

  line("chuo-rapid", "中央線快速電車", "中央方面", "#f15a22", ["中央線快速", "ChuoRapid"]),
  line("chuo-sobu-local", "中央・総武線各駅停車", "中央方面", "#ffd400", ["中央総武", "中央・総武", "ChuoSobuLocal"]),
  line("chuo-main", "中央本線", "中央方面", "#f15a22", ["中央本", "Chuo"], "limited", "甲府駅以東のみ"),
  line("itsukaichi", "五日市線", "中央方面", "#f15a22", ["五日市", "Itsukaichi"]),
  line("ome", "青梅線", "中央方面", "#f15a22", ["青梅", "Ome"], "limited", "立川〜青梅間のみ"),
  line("koumi", "小海線", "中央方面", "#2f9e44", ["小海", "Koumi"]),

  line("joban", "常磐線", "常磐方面", "#00a68c", ["常磐線", "Joban"], "limited", "羽鳥駅以南のみ"),
  line("joban-rapid", "常磐線快速電車", "常磐方面", "#00a68c", ["常磐快速", "JobanRapid"], "limited", "羽鳥駅以南のみ"),
  line("joban-local", "常磐線各駅停車", "常磐方面", "#8684d8", ["常磐各駅", "JobanLocal"], "limited", "羽鳥駅以南のみ"),
  line("suigun", "水郡線", "常磐方面", "#3b82f6", ["水郡", "Suigun"]),
  line("mito", "水戸線", "常磐方面", "#3b82f6", ["水戸", "Mito"]),

  line("sobu-rapid", "総武快速線", "総武方面", "#0067c0", ["総武快速", "SobuRapid"]),
  line("sobu-main", "総武本線", "総武方面", "#ffd400", ["総武本", "Sobu"]),
  line("keiyo", "京葉線", "総武方面", "#c9242f", ["京葉", "Keiyo"]),
  line("uchibo", "内房線", "総武方面", "#00a6b2", ["内房", "Uchibo"]),
  line("kashima", "鹿島線", "総武方面", "#8b5cf6", ["鹿島", "Kashima"]),
  line("kururi", "久留里線", "総武方面", "#00a68c", ["久留里", "Kururi"]),
  line("sotobo", "外房線", "総武方面", "#c9242f", ["外房", "Sotobo"]),
  line("togane", "東金線", "総武方面", "#c9242f", ["東金", "Togane"]),
  line("narita", "成田線", "総武方面", "#00a6b2", ["成田", "Narita"]),
];

/**
 * 公開APIで確認したJR東日本のODPT路線IDと、アプリ内表示単位の明示対応。
 * 未確認IDを名称の部分一致で推測せず、実データ確認後にこの表へ追加する。
 */
export const ODPT_RAILWAY_TO_CATALOG: Readonly<Record<string, string>> = {
  "odpt.Railway:JR-East.Agatsuma": "agatsuma",
  "odpt.Railway:JR-East.Chuo": "chuo-main",
  "odpt.Railway:JR-East.ChuoRapid": "chuo-rapid",
  "odpt.Railway:JR-East.ChuoSobuLocal": "chuo-sobu-local",
  "odpt.Railway:JR-East.Hachiko": "hachiko",
  "odpt.Railway:JR-East.Ito": "ito",
  "odpt.Railway:JR-East.Itsukaichi": "itsukaichi",
  "odpt.Railway:JR-East.Joban": "joban",
  "odpt.Railway:JR-East.JobanLocal": "joban-local",
  "odpt.Railway:JR-East.JobanRapid": "joban-rapid",
  "odpt.Railway:JR-East.Joetsu": "joetsu",
  "odpt.Railway:JR-East.Kashima": "kashima",
  "odpt.Railway:JR-East.Kawagoe": "kawagoe",
  "odpt.Railway:JR-East.KeihinTohokuNegishi": "keihin-tohoku",
  "odpt.Railway:JR-East.Keiyo": "keiyo",
  "odpt.Railway:JR-East.Kururi": "kururi",
  "odpt.Railway:JR-East.Musashino": "musashino",
  "odpt.Railway:JR-East.NambuBranch": "nambu",
  "odpt.Railway:JR-East.NaritaAbikoBranch": "narita",
  "odpt.Railway:JR-East.Ome": "ome",
  "odpt.Railway:JR-East.Sagami": "sagami",
  "odpt.Railway:JR-East.SaikyoKawagoe": "saikyo",
  "odpt.Railway:JR-East.ShonanShinjuku": "shonan-shinjuku",
  "odpt.Railway:JR-East.Sobu": "sobu-main",
  "odpt.Railway:JR-East.SobuRapid": "sobu-rapid",
  "odpt.Railway:JR-East.SotetsuDirect": "sotetsu-through",
  "odpt.Railway:JR-East.Sotobo": "sotobo",
  "odpt.Railway:JR-East.Takasaki": "takasaki",
  "odpt.Railway:JR-East.Togane": "togane",
  "odpt.Railway:JR-East.Tokaido": "tokaido",
  "odpt.Railway:JR-East.TsurumiOkawaBranch": "tsurumi",
  "odpt.Railway:JR-East.Uchibo": "uchibo",
  "odpt.Railway:JR-East.Utsunomiya": "utsunomiya",
  "odpt.Railway:JR-East.Yamanote": "yamanote",
  "odpt.Railway:JR-East.Yokohama": "yokohama",
  "odpt.Railway:JR-East.Yokosuka": "yokosuka",
};

const log = createLogger("railway-catalog");
const warnedUnknownRailwayIds = new Set<string>();

/** ODPTの路線IDを完全一致でアプリ内の表示単位へ対応付ける。 */
export function findRailwayCatalogLine(
  odptId: string,
  title: string,
): RailwayCatalogLine | null {
  const catalogId = ODPT_RAILWAY_TO_CATALOG[odptId];
  if (catalogId) return getRailwayCatalogLine(catalogId) ?? null;

  if (odptId && !warnedUnknownRailwayIds.has(odptId)) {
    warnedUnknownRailwayIds.add(odptId);
    log.warn("未対応のODPT路線IDを無視します", { odptId, title });
  }
  return null;
}

export function railwayFilterOptions(
  availableIds: ReadonlySet<string>,
): RailwayFilterOption[] {
  return RAILWAY_CATALOG
    .filter((item) => item.coverage !== "unavailable")
    .map((item) => ({
      ...item,
      available: availableIds.has(item.id),
    }));
}

/**
 * 初回表示は、利用可能な路線を方面ごとに1件だけ選ぶ。
 * カタログ順がそのまま各方面の表示優先順になる。
 */
export function defaultVisibleRailwayIds(
  options: readonly RailwayFilterOption[],
): Set<string> {
  const selectedCategories = new Set<string>();
  const selectedIds = new Set<string>();

  for (const option of options) {
    if (!option.available || selectedCategories.has(option.category)) continue;
    selectedCategories.add(option.category);
    selectedIds.add(option.id);
  }

  return selectedIds;
}

export function getRailwayCatalogLine(
  id: string,
): RailwayCatalogLine | undefined {
  return RAILWAY_CATALOG.find((item) => item.id === id);
}
