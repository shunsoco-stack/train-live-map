import type { ProviderSource } from "../types/train.ts";

export interface RuntimeEnvironment {
  NODE_ENV?: string;
  ALLOW_MOCK_DATA?: string;
}

export const MOCK_NOTICE_NO_TOKEN =
  "現在モックデータを表示しています(ODPT 未設定)。";
export const MOCK_NOTICE_FALLBACK =
  "現在モックデータを表示しています(実データの取得に失敗したため)。";
export const MOCK_NOTICE_EMPTY =
  "現在モックデータを表示しています(ODPTから対象列車を取得できなかったため)。";
export const NO_RUNNING_TRAINS_NOTICE =
  "現在、運行中の列車情報がありません（終電後などの可能性があります）。";

export interface ProviderPolicyResult<T> {
  value: T;
  source: ProviderSource;
  isMock: boolean;
  /** 実データ取得後にモックへ切り替えたか。 */
  fallback: boolean;
  notice: string | null;
}

interface ResolveProviderOptions<T> {
  /** 実データプロバイダが未設定の場合は null。 */
  realCall: (() => Promise<T>) | null;
  /** 許可された環境でのみ遅延評価される。 */
  mockCall: () => Promise<T>;
  environment?: RuntimeEnvironment;
  isEmpty?: (value: T) => boolean;
  onFallback?: (reason: "failure" | "empty", error?: unknown) => void;
}

/** 本番では明示的に許可しない限りモックを返さない。 */
export function isMockAllowed(
  environment: RuntimeEnvironment = process.env,
): boolean {
  return (
    environment.NODE_ENV !== "production" ||
    environment.ALLOW_MOCK_DATA === "1"
  );
}

/**
 * 実データとモックの切り替え方針を一元化する。
 * 本番で実データが空の場合は正常な空結果として扱い、架空列車を補わない。
 */
export async function resolveProviderResult<T>({
  realCall,
  mockCall,
  environment = process.env,
  isEmpty,
  onFallback,
}: ResolveProviderOptions<T>): Promise<ProviderPolicyResult<T>> {
  const allowMock = isMockAllowed(environment);

  if (!realCall) {
    if (!allowMock) {
      throw new Error("実データプロバイダが設定されていません");
    }
    return {
      value: await mockCall(),
      source: "mock",
      isMock: true,
      fallback: false,
      notice: MOCK_NOTICE_NO_TOKEN,
    };
  }

  let value: T;
  try {
    value = await realCall();
  } catch (error) {
    if (!allowMock) throw error;
    onFallback?.("failure", error);
    return {
      value: await mockCall(),
      source: "mock",
      isMock: true,
      fallback: true,
      notice: MOCK_NOTICE_FALLBACK,
    };
  }

  if (isEmpty?.(value)) {
    if (!allowMock) {
      return {
        value,
        source: "odpt",
        isMock: false,
        fallback: false,
        notice: NO_RUNNING_TRAINS_NOTICE,
      };
    }
    onFallback?.("empty");
    return {
      value: await mockCall(),
      source: "mock",
      isMock: true,
      fallback: true,
      notice: MOCK_NOTICE_EMPTY,
    };
  }

  return {
    value,
    source: "odpt",
    isMock: false,
    fallback: false,
    notice: null,
  };
}
