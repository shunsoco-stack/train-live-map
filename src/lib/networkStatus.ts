export const OFFLINE_ERROR_MESSAGE =
  "オフラインです。接続が戻ると自動で再取得します";

export function errorMessageForConnection(
  isOnline: boolean,
  requestError: string | null,
): string | null {
  return isOnline ? requestError : OFFLINE_ERROR_MESSAGE;
}
