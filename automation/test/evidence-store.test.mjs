import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  appendEvent,
  createRun,
  createStudy,
  validateRun,
  writeVerdict,
} from '../scripts/evidence-store.mjs';

async function withTempStudy(callback) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'seamscope-evidence-'));
  try {
    const {studyRoot} = await createStudy({root, studyId: 'pilot-test'});
    await callback(studyRoot);
  } finally {
    await rm(root, {recursive: true, force: true});
  }
}

test('creates an auditable completed run', async () => {
  await withTempStudy(async studyRoot => {
    const {runRoot} = await createRun({
      studyRoot,
      caseId: 'healthy-threshold',
      route: 'injected',
      repetition: 1,
      configurationId: 'pixel-api35-debug',
      runId: 'test-run-001',
    });
    await appendEvent({
      runRoot,
      source: 'runner',
      eventType: 'stimulus-issued',
      sequence: 1,
      details: {speed: 8},
    });
    const verdict = await writeVerdict({
      runRoot,
      validity: 'valid',
      outcome: 'pass',
      expectedObservation: 'In Motion view displays 8.0',
      observedObservation: 'In Motion view displayed 8.0',
      claimSupported: 'Accepted observations cause the configured transition',
    });
    assert.equal(verdict.manualIntervention, false);

    const result = await validateRun(runRoot);
    assert.deepEqual(result, {valid: true, errors: []});
    const lines = (await readFile(path.join(runRoot, 'events.jsonl'), 'utf8'))
      .trim()
      .split(/\r?\n/)
      .map(line => JSON.parse(line));
    assert.deepEqual(
      lines.map(event => event.eventIndex),
      [0, 1, 2],
    );
  });
});

test('derives manual intervention from the event record', async () => {
  await withTempStudy(async studyRoot => {
    const {runRoot} = await createRun({
      studyRoot,
      caseId: 'healthy-threshold',
      route: 'injected',
      repetition: 1,
      configurationId: 'pixel-api35-debug',
      runId: 'test-run-intervention',
    });
    await appendEvent({
      runRoot,
      source: 'runner',
      eventType: 'manual-intervention',
      details: {action: 'restarted application'},
    });
    const verdict = await writeVerdict({
      runRoot,
      validity: 'invalid',
      outcome: 'not-evaluated',
      expectedObservation: 'setup ready',
      observedObservation: 'application required restart',
      claimSupported: 'not evaluated',
      failureBoundary: 'executor',
    });
    assert.equal(verdict.manualIntervention, true);
  });
});

test('rejects a BLE-only fault case on the injected route', async () => {
  await withTempStudy(async studyRoot => {
    await assert.rejects(
      createRun({
        studyRoot,
        caseId: 'malformed-notification',
        route: 'injected',
        repetition: 1,
        configurationId: 'pixel-api35-debug',
      }),
      /not applicable/,
    );
  });
});

test('keeps validity separate from outcome', async () => {
  await withTempStudy(async studyRoot => {
    const {runRoot} = await createRun({
      studyRoot,
      caseId: 'healthy-threshold',
      route: 'bumble-ble',
      repetition: 1,
      configurationId: 'pixel-bumble-nano',
      runId: 'test-run-invalid',
    });
    await assert.rejects(
      writeVerdict({
        runRoot,
        validity: 'invalid',
        outcome: 'fail',
        expectedObservation: 'setup ready',
        observedObservation: 'COM port unavailable',
        claimSupported: 'not evaluated',
        failureBoundary: 'executor',
      }),
      /invalid run must use the not-evaluated outcome/,
    );
  });
});
