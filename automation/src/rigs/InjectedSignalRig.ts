import {browser} from '@wdio/globals';
import {RunEvidence} from '../evidence/RunEvidence.js';
import type {FaultProfile, SignalRig} from './SignalRig.js';

export class InjectedSignalRig implements SignalRig {
  readonly routeName = 'injected' as const;
  private sequence = 0;
  private readonly evidence = RunEvidence.fromEnvironment();

  async start(): Promise<void> {}

  async reset(): Promise<void> {
    this.sequence = 0;
    await browser.terminateApp('com.seamscope');
    await browser.activateApp('com.seamscope');
  }

  async setSpeed(speed: number): Promise<void> {
    if (!Number.isFinite(speed) || speed < 0) {
      throw new Error(`Invalid speed: ${speed}`);
    }

    this.sequence += 1;
    this.evidence?.record(
      'runner',
      'stimulus-issued',
      {route: this.routeName, speed},
      this.sequence,
    );
    const url = new URL('seamscope://signal');
    url.searchParams.set('speed', speed.toString());
    url.searchParams.set('sequence', this.sequence.toString());
    url.searchParams.set('timestamp', Date.now().toString());

    await browser.execute('mobile: deepLink', {
      url: url.toString(),
      package: 'com.seamscope',
    });
  }

  async armFault(_profile: FaultProfile): Promise<void> {
    throw new Error(
      'Transport fault profiles are intentionally unavailable on the injected route.',
    );
  }

  async close(): Promise<void> {}
}

