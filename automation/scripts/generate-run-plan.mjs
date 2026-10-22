#!/usr/bin/env node
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const automationRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const outputPath = path.resolve(
  process.argv[2] ??
    path.join(automationRoot, 'evidence', 'plans', 'pilot-v1-confirmatory.json'),
);

const primaryOrders = [
  ['injected-healthy', 'bumble-healthy', 'bumble-dropped', 'bumble-malformed'],
  ['bumble-healthy', 'bumble-dropped', 'bumble-malformed', 'injected-healthy'],
  ['bumble-dropped', 'bumble-malformed', 'injected-healthy', 'bumble-healthy'],
  ['bumble-malformed', 'injected-healthy', 'bumble-healthy', 'bumble-dropped'],
  ['injected-healthy', 'bumble-healthy', 'bumble-dropped', 'bumble-malformed'],
  ['bumble-healthy', 'bumble-dropped', 'bumble-malformed', 'injected-healthy'],
  ['bumble-dropped', 'bumble-malformed', 'injected-healthy', 'bumble-healthy'],
  ['bumble-malformed', 'injected-healthy', 'bumble-healthy', 'bumble-dropped'],
  ['injected-healthy', 'bumble-dropped', 'bumble-healthy', 'bumble-malformed'],
  ['bumble-dropped', 'injected-healthy', 'bumble-malformed', 'bumble-healthy'],
];

const conditions = {
  'injected-healthy': {route: 'injected', caseId: 'healthy-threshold'},
  'bumble-healthy': {route: 'bumble-ble', caseId: 'healthy-threshold'},
  'bumble-dropped': {
    route: 'bumble-ble',
    caseId: 'dropped-notification-recovery',
  },
  'bumble-malformed': {route: 'bumble-ble', caseId: 'malformed-notification'},
  'tablet-healthy': {route: 'tablet-ble', caseId: 'healthy-threshold'},
  'tablet-malformed': {route: 'tablet-ble', caseId: 'malformed-notification'},
};

const repetitions = new Map();
const schedule = [];

function addRun(block, conditionId, role) {
  const condition = conditions[conditionId];
  const repetition = (repetitions.get(conditionId) ?? 0) + 1;
  repetitions.set(conditionId, repetition);
  const sequence = schedule.length + 1;
  schedule.push({
    sequence,
    block,
    role,
    conditionId,
    route: condition.route,
    caseId: condition.caseId,
    repetition,
    plannedRunId: [
      `c${String(sequence).padStart(3, '0')}`,
      conditionId,
      `r${String(repetition).padStart(2, '0')}`,
    ].join('-'),
  });
}

primaryOrders.forEach((order, index) => {
  const block = index + 1;
  order.forEach(conditionId => addRun(block, conditionId, 'primary'));
  addRun(
    block,
    block % 2 === 1 ? 'tablet-healthy' : 'tablet-malformed',
    'reference',
  );
});

const expectedCounts = {
  'injected-healthy': 10,
  'bumble-healthy': 10,
  'bumble-dropped': 10,
  'bumble-malformed': 10,
  'tablet-healthy': 5,
  'tablet-malformed': 5,
};

for (const [conditionId, expected] of Object.entries(expectedCounts)) {
  const observed = repetitions.get(conditionId) ?? 0;
  if (observed !== expected) {
    throw new Error(`${conditionId}: expected ${expected} runs, generated ${observed}.`);
  }
}
for (let index = 1; index < schedule.length; index += 1) {
  if (schedule[index - 1].conditionId === schedule[index].conditionId) {
    throw new Error(`Adjacent duplicate condition at sequence ${index + 1}.`);
  }
}

const plan = {
  schemaVersion: '1',
  planId: 'pilot-v1-confirmatory',
  protocolVersion: 'pilot-v1-frozen',
  status: 'frozen',
  orderingRule:
    'Ten five-run blocks: each primary condition occurs once per block, followed by one alternating tablet reference run.',
  targets: {
    validRuns: 50,
    primaryValidRuns: 40,
    referenceValidRuns: 10,
    byCondition: expectedCounts,
  },
  retryRule:
    'Invalid pre-stimulus attempts receive a new run ID and do not advance the planned sequence; valid failures do.',
  schedule,
};

await mkdir(path.dirname(outputPath), {recursive: true});
await writeFile(outputPath, `${JSON.stringify(plan, null, 2)}\n`, 'utf8');
console.log(outputPath);
