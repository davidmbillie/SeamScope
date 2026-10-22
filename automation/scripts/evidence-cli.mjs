#!/usr/bin/env node
import path from 'node:path';
import {
  appendEvent,
  createRun,
  createStudy,
  validateRun,
  writeVerdict,
} from './evidence-store.mjs';

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = {};
  for (let index = 0; index < rest.length; index += 2) {
    const key = rest[index];
    if (!key?.startsWith('--') || rest[index + 1] === undefined) {
      throw new Error(`Expected --name value pairs; received ${key ?? 'nothing'}.`);
    }
    options[key.slice(2)] = rest[index + 1];
  }
  return {command, options};
}

function required(options, name) {
  const value = options[name];
  if (!value) {
    throw new Error(`--${name} is required.`);
  }
  return value;
}

async function main() {
  const {command, options} = parseArgs(process.argv.slice(2));
  if (command === 'init-study') {
    const result = await createStudy({
      root: path.resolve(options.root ?? '../artifacts/evidence'),
      studyId: required(options, 'study-id'),
      protocolVersion: options['protocol-version'],
      repetitionTarget: options.repetitions
        ? Number(options.repetitions)
        : undefined,
    });
    console.log(result.studyRoot);
    return;
  }
  if (command === 'start-run') {
    const result = await createRun({
      studyRoot: path.resolve(required(options, 'study')),
      caseId: required(options, 'case'),
      route: required(options, 'route'),
      repetition: Number(required(options, 'repetition')),
      configurationId: required(options, 'configuration'),
      retryOf: options['retry-of'] ?? null,
      runId: options['run-id'],
    });
    console.log(result.runRoot);
    return;
  }
  if (command === 'event') {
    const event = await appendEvent({
      runRoot: path.resolve(required(options, 'run')),
      source: required(options, 'source'),
      eventType: required(options, 'type'),
      sequence: options.sequence === undefined ? undefined : Number(options.sequence),
      sourceMonotonicMs:
        options['source-ms'] === undefined
          ? undefined
          : Number(options['source-ms']),
      details: options.details ? JSON.parse(options.details) : {},
    });
    console.log(JSON.stringify(event));
    return;
  }
  if (command === 'verdict') {
    const verdict = await writeVerdict({
      runRoot: path.resolve(required(options, 'run')),
      validity: required(options, 'validity'),
      outcome: required(options, 'outcome'),
      expectedObservation: required(options, 'expected'),
      observedObservation: required(options, 'observed'),
      claimSupported: required(options, 'claim'),
      failureBoundary: options.boundary ?? 'none',
      notes: options.notes ? [options.notes] : [],
    });
    console.log(JSON.stringify(verdict));
    return;
  }
  if (command === 'validate-run') {
    const result = await validateRun(path.resolve(required(options, 'run')));
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.valid ? 0 : 1;
    return;
  }
  throw new Error(
    'Command must be init-study, start-run, event, verdict, or validate-run.',
  );
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
