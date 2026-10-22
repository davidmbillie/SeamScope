import {appendFile, mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';

export const CASE_IDS = [
  'healthy-threshold',
  'dropped-notification-recovery',
  'malformed-notification',
  'stale-sequence',
];

export const ROUTES = ['injected', 'bumble-ble', 'tablet-ble'];
export const SOURCES = ['fixture', 'appium', 'app', 'bumble', 'runner'];
export const EVENT_TYPES = [
  'run-started',
  'setup-ready',
  'stimulus-issued',
  'command-accepted',
  'tx',
  'drop',
  'malformed',
  'notification-status',
  'ble-connected',
  'ble-disconnected',
  'app-state',
  'assertion',
  'apparatus-reset',
  'manual-intervention',
  'run-finished',
];

const routeApplicability = {
  'healthy-threshold': new Set(ROUTES),
  'dropped-notification-recovery': new Set(['bumble-ble', 'tablet-ble']),
  'malformed-notification': new Set(['bumble-ble', 'tablet-ble']),
  'stale-sequence': new Set(ROUTES),
};

function assertEnum(value, allowed, label) {
  if (!allowed.includes(value)) {
    throw new Error(`${label} must be one of: ${allowed.join(', ')}.`);
  }
}

function assertPositiveInteger(value, label) {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive integer.`);
  }
}

function assertSafeSegment(value, label) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(value)) {
    throw new Error(`${label} must be a filesystem-safe identifier.`);
  }
}

async function writeNewJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
  });
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

export async function createStudy({
  root,
  studyId,
  protocolVersion = 'pilot-v1-draft',
  repetitionTarget = 10,
}) {
  assertSafeSegment(studyId, 'studyId');
  assertSafeSegment(protocolVersion, 'protocolVersion');
  assertPositiveInteger(repetitionTarget, 'repetitionTarget');

  const studyRoot = path.resolve(root, studyId);
  await mkdir(path.join(studyRoot, 'runs'), {recursive: true});
  await mkdir(path.join(studyRoot, 'derived'), {recursive: true});

  const manifest = {
    schemaVersion: '1',
    studyId,
    protocolVersion,
    protocolStatus: 'draft-calibration',
    createdAt: new Date().toISOString(),
    intendedResult: 'structural-evidence-distinction',
    repetitionTarget,
    repetitionTargetStatus: 'calibration-default',
    timeoutStatus: 'pending-dry-run-calibration',
    timeoutsMs: {
      readiness: null,
      postStimulus: null,
    },
    cases: [
      'healthy-threshold',
      'dropped-notification-recovery',
      'malformed-notification',
    ],
    primaryRoutes: ['injected', 'bumble-ble'],
    referenceRoute: 'tablet-ble',
    validityBoundary: 'stimulus-issued',
    orderingRule: 'balanced-alternation',
    environment: {},
    artifactHashes: {},
  };

  await writeNewJson(path.join(studyRoot, 'study-manifest.json'), manifest);
  return {studyRoot, manifest};
}

export async function createRun({
  studyRoot,
  caseId,
  route,
  repetition,
  configurationId,
  retryOf = null,
  runId,
}) {
  assertEnum(caseId, CASE_IDS, 'caseId');
  assertEnum(route, ROUTES, 'route');
  assertPositiveInteger(repetition, 'repetition');
  assertSafeSegment(configurationId, 'configurationId');
  if (!routeApplicability[caseId].has(route)) {
    throw new Error(`${caseId} is not applicable to the ${route} route.`);
  }

  const study = await readJson(path.join(studyRoot, 'study-manifest.json'));
  const generatedId = [
    new Date().toISOString().replace(/[:.]/g, '-'),
    caseId,
    route,
    `r${String(repetition).padStart(2, '0')}`,
  ].join('_');
  const selectedRunId = runId ?? generatedId;
  assertSafeSegment(selectedRunId, 'runId');
  if (retryOf !== null) {
    assertSafeSegment(retryOf, 'retryOf');
  }

  const runRoot = path.join(studyRoot, 'runs', selectedRunId);
  await mkdir(runRoot, {recursive: false});
  const manifest = {
    schemaVersion: '1',
    studyId: study.studyId,
    runId: selectedRunId,
    protocolVersion: study.protocolVersion,
    caseId,
    route,
    repetition,
    startedAt: new Date().toISOString(),
    configurationId,
    validityBoundary: study.validityBoundary,
    retryOf,
  };
  await writeNewJson(path.join(runRoot, 'manifest.json'), manifest);
  await writeFile(path.join(runRoot, 'events.jsonl'), '', {flag: 'wx'});
  for (const logName of ['serial.log', 'appium.log', 'logcat.log']) {
    await writeFile(path.join(runRoot, logName), '', {flag: 'wx'});
  }
  if (route === 'bumble-ble') {
    await writeFile(path.join(runRoot, 'bumble.log'), '', {flag: 'wx'});
  }

  await appendEvent({
    runRoot,
    source: 'runner',
    eventType: 'run-started',
    details: {caseId, route, repetition},
  });
  return {runRoot, manifest};
}

export async function appendEvent({
  runRoot,
  source,
  eventType,
  sequence,
  sourceMonotonicMs,
  details = {},
}) {
  assertEnum(source, SOURCES, 'source');
  assertEnum(eventType, EVENT_TYPES, 'eventType');
  if (sequence !== undefined && (!Number.isInteger(sequence) || sequence < 0)) {
    throw new Error('sequence must be a non-negative integer.');
  }
  if (
    sourceMonotonicMs !== undefined &&
    (!Number.isFinite(sourceMonotonicMs) || sourceMonotonicMs < 0)
  ) {
    throw new Error('sourceMonotonicMs must be a non-negative number.');
  }

  const manifest = await readJson(path.join(runRoot, 'manifest.json'));
  const eventsPath = path.join(runRoot, 'events.jsonl');
  const existing = await readFile(eventsPath, 'utf8');
  const eventIndex = existing.split(/\r?\n/).filter(Boolean).length;
  const event = {
    schemaVersion: '1',
    runId: manifest.runId,
    eventIndex,
    source,
    eventType,
    hostObservedAt: new Date().toISOString(),
    ...(sourceMonotonicMs === undefined ? {} : {sourceMonotonicMs}),
    ...(sequence === undefined ? {} : {sequence}),
    details,
  };
  await appendFile(eventsPath, `${JSON.stringify(event)}\n`, 'utf8');
  return event;
}

export async function writeVerdict({
  runRoot,
  validity,
  outcome,
  expectedObservation,
  observedObservation,
  claimSupported,
  failureBoundary = 'none',
  notes = [],
}) {
  assertEnum(validity, ['valid', 'invalid'], 'validity');
  assertEnum(outcome, ['pass', 'fail', 'not-evaluated'], 'outcome');
  assertEnum(
    failureBoundary,
    ['none', 'fixture', 'ble', 'application', 'ui', 'executor', 'unknown'],
    'failureBoundary',
  );
  if (validity === 'invalid' && outcome !== 'not-evaluated') {
    throw new Error('An invalid run must use the not-evaluated outcome.');
  }

  const manifest = await readJson(path.join(runRoot, 'manifest.json'));
  const eventsContents = await readFile(path.join(runRoot, 'events.jsonl'), 'utf8');
  const manualIntervention = eventsContents
    .split(/\r?\n/)
    .filter(Boolean)
    .some(line => JSON.parse(line).eventType === 'manual-intervention');
  const verdict = {
    schemaVersion: '1',
    runId: manifest.runId,
    validity,
    outcome,
    expectedObservation,
    observedObservation,
    claimSupported,
    failureBoundary,
    manualIntervention,
    retryOf: manifest.retryOf,
    notes,
  };
  await writeNewJson(path.join(runRoot, 'verdict.json'), verdict);
  await appendEvent({
    runRoot,
    source: 'runner',
    eventType: 'run-finished',
    details: {validity, outcome, failureBoundary},
  });
  return verdict;
}

export async function validateRun(runRoot, {requireVerdict = true} = {}) {
  const errors = [];
  let manifest;
  try {
    manifest = await readJson(path.join(runRoot, 'manifest.json'));
  } catch (error) {
    errors.push(`manifest.json: ${error.message}`);
    return {valid: false, errors};
  }

  let events = [];
  try {
    const contents = await readFile(path.join(runRoot, 'events.jsonl'), 'utf8');
    events = contents
      .split(/\r?\n/)
      .filter(Boolean)
      .map(line => JSON.parse(line));
  } catch (error) {
    errors.push(`events.jsonl: ${error.message}`);
  }
  events.forEach((event, index) => {
    if (event.runId !== manifest.runId) {
      errors.push(`event ${index} has a mismatched runId.`);
    }
    if (event.eventIndex !== index) {
      errors.push(`event ${index} has non-contiguous eventIndex ${event.eventIndex}.`);
    }
  });

  if (requireVerdict) {
    try {
      const verdict = await readJson(path.join(runRoot, 'verdict.json'));
      if (verdict.runId !== manifest.runId) {
        errors.push('verdict.json has a mismatched runId.');
      }
    } catch (error) {
      errors.push(`verdict.json: ${error.message}`);
    }
  }
  return {valid: errors.length === 0, errors};
}
