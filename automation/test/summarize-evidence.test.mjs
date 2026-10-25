import assert from 'node:assert/strict';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  appendEvent,
  createRun,
  createStudy,
  writeVerdict,
} from '../scripts/evidence-store.mjs';
import {summarizeEvidence} from '../scripts/summarize-evidence.mjs';

test('reconciles retries from records without counting an invalid attempt as a result', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'seamscope-summary-'));
  try {
    const {studyRoot} = await createStudy({
      root,
      studyId: 'summary-test',
      protocolVersion: 'summary-test-frozen',
      repetitionTarget: 1,
    });
    const planPath = path.join(root, 'plan.json');
    await writeFile(
      planPath,
      `${JSON.stringify({
        schemaVersion: '1',
        planId: 'summary-test-plan',
        protocolVersion: 'summary-test-frozen',
        targets: {
          validRuns: 1,
          byCondition: {'injected-healthy': 1},
        },
        schedule: [
          {
            sequence: 1,
            block: 1,
            role: 'primary',
            conditionId: 'injected-healthy',
            route: 'injected',
            caseId: 'healthy-threshold',
            repetition: 1,
            plannedRunId: 'c001-injected-healthy-r01',
          },
        ],
      }, null, 2)}\n`,
      'utf8',
    );

    const invalid = await createRun({
      studyRoot,
      caseId: 'healthy-threshold',
      route: 'injected',
      repetition: 1,
      configurationId: 'test',
      runId: 'c001-injected-healthy-r01',
    });
    await writeVerdict({
      runRoot: invalid.runRoot,
      validity: 'invalid',
      outcome: 'not-evaluated',
      expectedObservation: 'setup ready',
      observedObservation: 'setup not ready',
      claimSupported: 'not evaluated',
      failureBoundary: 'application',
    });

    const retry = await createRun({
      studyRoot,
      caseId: 'healthy-threshold',
      route: 'injected',
      repetition: 1,
      configurationId: 'test',
      retryOf: invalid.manifest.runId,
      runId: 'c001-injected-healthy-r01-retry01',
    });
    await appendEvent({
      runRoot: retry.runRoot,
      source: 'runner',
      eventType: 'stimulus-issued',
      sequence: 1,
      sourceMonotonicMs: 100,
      details: {speed: 8},
    });
    await appendEvent({
      runRoot: retry.runRoot,
      source: 'app',
      eventType: 'app-state',
      sourceMonotonicMs: 250,
      details: {state: 'moving', speed: 8},
    });
    await writeVerdict({
      runRoot: retry.runRoot,
      validity: 'valid',
      outcome: 'pass',
      expectedObservation: 'motion',
      observedObservation: 'motion',
      claimSupported: 'semantic transition',
    });

    const result = await summarizeEvidence({
      studyRoot,
      planPath,
      diagnosticRunIds: [],
    });
    assert.equal(result.summary.confirmatoryAttempts, 2);
    assert.equal(result.summary.completedSchedulePositions, 1);
    assert.equal(result.summary.validRuns, 1);
    assert.equal(result.summary.invalidPreStimulusAttempts, 1);
    assert.equal(result.summary.nextIncompleteSequence, null);
    assert.equal(result.summary.collectionStatus, 'complete');
    assert.deepEqual(
      result.runs.map(run => [run.runId, run.attempt, run.stimulusIssued]),
      [
        ['c001-injected-healthy-r01', 1, false],
        ['c001-injected-healthy-r01-retry01', 2, true],
      ],
    );
    assert.equal(result.runs[1].motionObservationMs, 150);
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});
