import {$, expect} from '@wdio/globals';

export class MotionPage {
  private get screen() {
    return $('~seamscope-motion');
  }

  private get speed() {
    return $('~observed-speed');
  }

  private get sequence() {
    return $('~observed-sequence');
  }

  async waitForDisplayed(): Promise<void> {
    await this.screen.waitForDisplayed();
  }

  async expectSpeed(expected: number): Promise<void> {
    await expect(this.speed).toHaveText(expected.toFixed(1));
  }

  async expectSequence(expected: number): Promise<void> {
    await expect(this.sequence).toHaveText(`Observation #${expected}`);
  }
}
