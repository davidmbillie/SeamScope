import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {
  companionRoot,
  createCompanionValidator,
  validateCompanion,
} from '../scripts/validate-claim-assessments.mjs';

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

test('validates four verdict-and-claim assessments and rejects the negative fixture', async () => {
  const result = await validateCompanion();
  assert.deepEqual(result, {
    valid: true,
    recordCount: 4,
    rejectedFixtureCount: 1,
    failures: [],
  });
});

test('rejects support when an identified material property is bypassed', async () => {
  const validate = await createCompanionValidator();
  const fixture = await readJson(
    path.join(
      companionRoot,
      'invalid-fixtures',
      'bypassed-property-cannot-support.json',
    ),
  );
  const result = validate(fixture);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /cannot be supports/);
});

test('keeps execution invalidity separate from a behavioral outcome', async () => {
  const validate = await createCompanionValidator();
  const source = await readJson(
    path.join(
      companionRoot,
      'records',
      'c001-claim-application-state.json',
    ),
  );
  const contradictory = {
    ...source,
    assessmentId: 'invalid-fixture--invalid-execution-with-pass',
    executionValidity: 'invalid',
    testOutcome: 'pass',
    claimDisposition: 'supports',
  };
  const result = validate(contradictory);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /testOutcome|claimDisposition/);
});
