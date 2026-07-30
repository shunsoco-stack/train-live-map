export type RequestToken = symbol;

/**
 * 同種のリクエストを1件だけ実行するための世代付きガード。
 * 古いリクエストの finally が、新しいリクエストを解放しないようにする。
 */
export class InFlightRequestGate {
  private activeToken: RequestToken | null = null;

  begin(): RequestToken | null {
    if (this.activeToken) return null;
    const token = Symbol("request");
    this.activeToken = token;
    return token;
  }

  release(token: RequestToken): boolean {
    if (this.activeToken !== token) return false;
    this.activeToken = null;
    return true;
  }

  reset(): void {
    this.activeToken = null;
  }

  isActive(): boolean {
    return this.activeToken !== null;
  }
}
