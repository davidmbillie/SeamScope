import {$, expect} from '@wdio/globals';
import {performance} from 'node:perf_hooks';

export interface BleConnectionTiming {
  appControlReadyMs: number;
  subscribedMs: number;
}

export class BleRoutePanel {
  private get toggle() {
    return $('~seamscope-ble-toggle');
  }

  private get status() {
    return $('~seamscope-ble-status');
  }

  private get detail() {
    return $('~seamscope-ble-detail');
  }

  async connect(): Promise<BleConnectionTiming> {
    const startedAt = performance.now();
    const appReadyTimeout = Number(
      process.env.SEAMSCOPE_APP_READY_TIMEOUT_MS ?? 45_000,
    );
    const subscriptionTimeout = Number(
      process.env.SEAMSCOPE_BLE_SUBSCRIBE_TIMEOUT_MS ?? 30_000,
    );
    await this.toggle.waitForDisplayed({
      timeout: appReadyTimeout,
      interval: 500,
    });
    const appControlReadyMs = performance.now() - startedAt;
    await this.toggle.click();
    await expect(this.status).toHaveText('SUBSCRIBED', {
      wait: subscriptionTimeout,
    });
    return {
      appControlReadyMs,
      subscribedMs: performance.now() - startedAt - appControlReadyMs,
    };
  }

  async expectDetail(expected: string): Promise<void> {
    await expect(this.detail).toHaveText(expected);
  }

  async disconnectIfConnected(): Promise<void> {
    if (!(await this.status.isExisting())) {
      return;
    }
    if ((await this.status.getText()) !== 'SUBSCRIBED') {
      return;
    }
    await this.toggle.click();
    await expect(this.status).toHaveText('IDLE');
  }
}
