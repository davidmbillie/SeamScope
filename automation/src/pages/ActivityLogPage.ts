import {$, expect} from '@wdio/globals';

export class ActivityLogPage {
  private get screen() {
    return $('~seamscope-activity-log');
  }

  private get intervalCount() {
    return $('~completed-interval-count');
  }

  async waitForDisplayed(timeout?: number): Promise<void> {
    await this.screen.waitForDisplayed(
      timeout === undefined ? undefined : {timeout},
    );
  }

  async expectCompletedIntervals(expected: number): Promise<void> {
    await expect(this.intervalCount).toHaveText(expected.toString());
  }
}
