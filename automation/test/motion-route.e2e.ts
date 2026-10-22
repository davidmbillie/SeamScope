import {$, browser} from '@wdio/globals';
import {RunEvidence} from '../src/evidence/RunEvidence.js';
import {ActivityLogPage} from '../src/pages/ActivityLogPage.js';
import {BleRoutePanel} from '../src/pages/BleRoutePanel.js';
import {MotionPage} from '../src/pages/MotionPage.js';
import {createSignalRig} from '../src/rigs/createSignalRig.js';

describe('claim-bounded motion evidence', () => {
  const caseId = process.env.SEAMSCOPE_CASE ?? 'healthy-threshold';
  const activity = new ActivityLogPage();
  const bleRoute = new BleRoutePanel();
  const motion = new MotionPage();
  const rig = createSignalRig();
  const evidence = RunEvidence.fromEnvironment();

  async function captureFailure(stage: string, error: unknown): Promise<void> {
    evidence?.record('appium', 'assertion', {
      assertion: stage,
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    });
    if (evidence) {
      await browser.saveScreenshot(evidence.artifactPath('failure.png'));
      evidence.writeArtifact('failure-ui.xml', await browser.getPageSource());
    }
  }

  before(async () => {
    try {
      if (rig.routeName === 'serial-ble') {
        await browser.activateApp('com.seamscope');
        const resetState = $('~seamscope-reset-state');
        await resetState.waitForDisplayed({
          timeout: Number(process.env.SEAMSCOPE_APP_READY_TIMEOUT_MS ?? 45_000),
          interval: 500,
        });
        await bleRoute.disconnectIfConnected();
        await resetState.click();
      }
      await rig.start();
      await rig.reset();
      const connectionTiming =
        rig.routeName === 'serial-ble' ? await bleRoute.connect() : undefined;
      evidence?.record('runner', 'setup-ready', {
        route: rig.routeName,
        ...(connectionTiming ?? {}),
      });
    } catch (error) {
      await captureFailure('setup-readiness', error);
      throw error;
    }
  });

  after(async () => {
    try {
      if (rig.routeName === 'serial-ble') {
        await bleRoute.disconnectIfConnected();
      }
    } finally {
      await rig.close();
    }
  });

  async function expectInitialState(): Promise<void> {
    await activity.waitForDisplayed(
      Number(process.env.SEAMSCOPE_APP_READY_TIMEOUT_MS ?? 45_000),
    );
    await activity.expectCompletedIntervals(0);
    if (evidence) {
      await browser.saveScreenshot(evidence.artifactPath('start.png'));
    }
    evidence?.record('appium', 'assertion', {
      assertion: 'initial-completed-interval-count',
      expected: 0,
      passed: true,
    });
  }

  async function completeHealthyInterval(): Promise<void> {
    const controlledFault = process.env.SEAMSCOPE_CONTROLLED_FAULT;
    if (controlledFault !== undefined) {
      if (rig.routeName !== 'serial-ble') {
        throw new Error('A controlled BLE fault requires the BLE route.');
      }
      if (
        controlledFault !== 'DROP_NEXT' &&
        controlledFault !== 'MALFORM_NEXT'
      ) {
        throw new Error(
          `Unsupported SEAMSCOPE_CONTROLLED_FAULT: ${controlledFault}`,
        );
      }
      await rig.armFault(controlledFault);
    }
    await rig.setSpeed(8);
    await motion.waitForDisplayed();
    await motion.expectSpeed(8);
    evidence?.record('app', 'app-state', {state: 'moving', speed: 8});
    evidence?.record('appium', 'assertion', {
      assertion: 'in-motion-speed',
      expected: 8,
      passed: true,
    });

    await rig.setSpeed(0);
    await activity.waitForDisplayed();
    await activity.expectCompletedIntervals(1);
    evidence?.record('app', 'app-state', {
      state: 'stopped',
      completedIntervals: 1,
    });
    evidence?.record('appium', 'assertion', {
      assertion: 'completed-interval-count',
      expected: 1,
      passed: true,
    });
  }

  async function observeDroppedNotificationRecovery(): Promise<void> {
    if (rig.routeName !== 'serial-ble') {
      throw new Error('The dropped-notification case requires the BLE route.');
    }
    const negativeObservationMs = Number(
      process.env.SEAMSCOPE_NEGATIVE_OBSERVATION_MS ?? 2_000,
    );
    await rig.armFault('DROP_NEXT');
    await rig.setSpeed(8);
    await browser.pause(negativeObservationMs);
    await activity.waitForDisplayed();
    await activity.expectCompletedIntervals(0);
    evidence?.record('app', 'app-state', {
      state: 'stopped',
      completedIntervals: 0,
      observationWindowMs: negativeObservationMs,
    });
    evidence?.record('appium', 'assertion', {
      assertion: 'dropped-notification-no-transition',
      expected: 'activity-log',
      passed: true,
      observationWindowMs: negativeObservationMs,
    });

    await rig.setSpeed(8);
    await motion.waitForDisplayed();
    await motion.expectSpeed(8);
    await motion.expectSequence(2);
    evidence?.record('app', 'app-state', {
      state: 'moving',
      speed: 8,
      sequence: 2,
    });
    evidence?.record('appium', 'assertion', {
      assertion: 'post-drop-sequence-gap',
      expected: 2,
      passed: true,
    });

    await rig.setSpeed(0);
    await activity.waitForDisplayed();
    await activity.expectCompletedIntervals(1);
    evidence?.record('app', 'app-state', {
      state: 'stopped',
      completedIntervals: 1,
    });
    evidence?.record('appium', 'assertion', {
      assertion: 'completed-interval-count',
      expected: 1,
      passed: true,
    });
  }

  async function observeMalformedNotificationRecovery(): Promise<void> {
    if (rig.routeName !== 'serial-ble') {
      throw new Error('The malformed-notification case requires the BLE route.');
    }
    await rig.armFault('MALFORM_NEXT');
    await rig.setSpeed(8);
    await bleRoute.expectDetail('Rejected malformed observation');
    await activity.waitForDisplayed();
    await activity.expectCompletedIntervals(0);
    evidence?.record('app', 'app-state', {
      state: 'stopped',
      completedIntervals: 0,
      diagnostic: 'rejected-malformed-observation',
    });
    evidence?.record('appium', 'assertion', {
      assertion: 'malformed-notification-rejected',
      expected: 'Rejected malformed observation',
      passed: true,
    });

    await rig.setSpeed(8);
    await motion.waitForDisplayed();
    await motion.expectSpeed(8);
    await motion.expectSequence(2);
    evidence?.record('app', 'app-state', {
      state: 'moving',
      speed: 8,
      sequence: 2,
    });
    evidence?.record('appium', 'assertion', {
      assertion: 'post-malformed-recovery',
      expected: 2,
      passed: true,
    });

    await rig.setSpeed(0);
    await activity.waitForDisplayed();
    await activity.expectCompletedIntervals(1);
    evidence?.record('app', 'app-state', {
      state: 'stopped',
      completedIntervals: 1,
    });
    evidence?.record('appium', 'assertion', {
      assertion: 'completed-interval-count',
      expected: 1,
      passed: true,
    });
  }

  it(`observes ${caseId} through the ${rig.routeName} route`, async () => {
    try {
      await expectInitialState();
      if (caseId === 'healthy-threshold') {
        await completeHealthyInterval();
      } else if (caseId === 'dropped-notification-recovery') {
        await observeDroppedNotificationRecovery();
      } else if (caseId === 'malformed-notification') {
        await observeMalformedNotificationRecovery();
      } else {
        throw new Error(`Unsupported SEAMSCOPE_CASE: ${caseId}`);
      }
      if (evidence) {
        await browser.saveScreenshot(evidence.artifactPath('final.png'));
      }
    } catch (error) {
      await captureFailure('scenario', error);
      throw error;
    }
  });
});

