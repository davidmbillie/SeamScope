import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const automationRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const plan = JSON.parse(
  await readFile(
    path.join(automationRoot, 'evidence', 'plans', 'pilot-v1-confirmatory.json'),
    'utf8',
  ),
);

test('freezes a balanced 40-run primary and 10-run reference schedule', () => {
  assert.equal(plan.schedule.length, 50);
  assert.deepEqual(
    plan.schedule.map(run => run.sequence),
    Array.from({length: 50}, (_, index) => index + 1),
  );
  assert.equal(
    new Set(plan.schedule.map(run => run.plannedRunId)).size,
    plan.schedule.length,
  );

  const counts = Object.fromEntries(
    Object.keys(plan.targets.byCondition).map(conditionId => [
      conditionId,
      plan.schedule.filter(run => run.conditionId === conditionId).length,
    ]),
  );
  assert.deepEqual(counts, plan.targets.byCondition);

  for (let block = 1; block <= 10; block += 1) {
    const runs = plan.schedule.filter(run => run.block === block);
    assert.equal(runs.length, 5);
    assert.equal(runs.filter(run => run.role === 'primary').length, 4);
    assert.equal(runs.at(-1).role, 'reference');
    assert.equal(
      runs.at(-1).conditionId,
      block % 2 === 1 ? 'tablet-healthy' : 'tablet-malformed',
    );
  }

  for (let index = 1; index < plan.schedule.length; index += 1) {
    assert.notEqual(
      plan.schedule[index - 1].conditionId,
      plan.schedule[index].conditionId,
    );
  }
});
