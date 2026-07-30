export interface PagePollingTask {
  intervalMs: number;
  run: (signal: AbortSignal) => void;
}

export interface PagePollingClock {
  setInterval: (callback: () => void, delayMs: number) => unknown;
  clearInterval: (handle: unknown) => void;
}

/**
 * ページの表示状態と通信状態に応じて、即時取得と定期取得を管理する。
 * DOMへの依存を外から渡し、ブラウザなしでも境界動作を検証できる形にする。
 */
export class PagePollingController {
  private controller: AbortController | null = null;
  private intervalHandles: unknown[] = [];
  private readonly tasks: readonly PagePollingTask[];
  private readonly clock: PagePollingClock;
  private readonly onStop: () => void;

  constructor(
    tasks: readonly PagePollingTask[],
    clock: PagePollingClock,
    onStop: () => void = () => undefined,
  ) {
    this.tasks = tasks;
    this.clock = clock;
    this.onStop = onStop;
  }

  get signal(): AbortSignal | undefined {
    return this.controller?.signal;
  }

  start(visible: boolean, online: boolean): void {
    this.stop();
    if (!visible) return;

    const controller = new AbortController();
    this.controller = controller;
    for (const task of this.tasks) {
      task.run(controller.signal);
    }
    if (!online) return;

    this.intervalHandles = this.tasks.map((task) =>
      this.clock.setInterval(
        () => task.run(controller.signal),
        task.intervalMs,
      ),
    );
  }

  handleVisibilityChange(visible: boolean, online: boolean): void {
    if (visible) this.start(true, online);
    else this.stop();
  }

  handleOnline(visible: boolean): void {
    this.start(visible, true);
  }

  handleOffline(): void {
    this.stop();
  }

  stop(): void {
    for (const handle of this.intervalHandles) {
      this.clock.clearInterval(handle);
    }
    this.intervalHandles = [];
    this.controller?.abort();
    this.controller = null;
    this.onStop();
  }
}
