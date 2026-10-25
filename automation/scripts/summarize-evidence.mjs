import {mkdir, readFile, readdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateRun} from './evidence-store.mjs';

const scriptPath = fileURLToPath(import.meta.url);
const repositoryRoot = path.resolve(path.dirname(scriptPath), '..', '..');
const DEFAULT_STUDY = path.join(repositoryRoot, 'artifacts', 'evidence', 'pilot-v1');
const DEFAULT_PLAN = path.join(
  repositoryRoot,
  'automation',
  'evidence',
  'plans',
  'pilot-v1-confirmatory.json',
);
const DEFAULT_DIAGNOSTICS = [
  'calibration-isolation-tablet-005',
  'calibration-isolation-bumble-001',
  'calibration-isolation-bumble-002',
];

function parseArguments(argv) {
  const options = {
    studyRoot: DEFAULT_STUDY,
    planPath: DEFAULT_PLAN,
    outputRoot: null,
    diagnosticRunIds: DEFAULT_DIAGNOSTICS,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = argv[index + 1];
    if (argument === '--study' && value) {
      options.studyRoot = path.resolve(value);
      index += 1;
    } else if (argument === '--plan' && value) {
      options.planPath = path.resolve(value);
      index += 1;
    } else if (argument === '--output' && value) {
      options.outputRoot = path.resolve(value);
      index += 1;
    } else if (argument === '--diagnostic-run' && value) {
      if (options.diagnosticRunIds === DEFAULT_DIAGNOSTICS) {
        options.diagnosticRunIds = [];
      }
      options.diagnosticRunIds.push(value);
      index += 1;
    } else {
      throw new Error(`Unknown or incomplete argument: ${argument}`);
    }
  }
  options.outputRoot ??= path.join(options.studyRoot, 'derived', 'interim-results');
  return options;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function readEvents(filePath) {
  return (await readFile(filePath, 'utf8'))
    .split(/\r?\n/)
    .filter(Boolean)
    .map(line => JSON.parse(line));
}

function plannedRunIdFor(runId) {
  return runId.replace(/^(c\d{3})-retry\d+-/, '$1-');
}

function retryNumber(runId) {
  return Number(runId.match(/^c\d{3}-retry(\d+)-/)?.[1] ?? 0);
}

function round(value) {
  return value === null || value === undefined ? null : Number(value.toFixed(3));
}

function latencyBetween(events, stimulusSpeed, state) {
  const stateEvent = events.find(
    event =>
      event.eventType === 'app-state' &&
      event.details?.state === state &&
      Number.isFinite(event.sourceMonotonicMs),
  );
  if (!stateEvent) return null;
  const stimuli = events.filter(
    event =>
      event.eventType === 'stimulus-issued' &&
      event.details?.speed === stimulusSpeed &&
      Number.isFinite(event.sourceMonotonicMs) &&
      event.sourceMonotonicMs <= stateEvent.sourceMonotonicMs,
  );
  const stimulus = stimuli.at(-1);
  return stimulus ? round(stateEvent.sourceMonotonicMs - stimulus.sourceMonotonicMs) : null;
}

function elapsedBetween(events, firstPredicate, secondPredicate) {
  const first = events.find(
    event => firstPredicate(event) && Number.isFinite(event.sourceMonotonicMs),
  );
  const second = events.find(
    event =>
      secondPredicate(event) &&
      Number.isFinite(event.sourceMonotonicMs) &&
      (!first || event.sourceMonotonicMs >= first.sourceMonotonicMs),
  );
  return first && second ? round(second.sourceMonotonicMs - first.sourceMonotonicMs) : null;
}

function extractTiming(events) {
  const setup = events.find(event => event.eventType === 'setup-ready');
  return {
    appControlReadyMs: round(setup?.details?.appControlReadyMs),
    subscribedMs: round(setup?.details?.subscribedMs),
    resetToBleConnectedMs: elapsedBetween(
      events,
      event =>
        event.eventType === 'command-accepted' && event.details?.line === 'OK RESET',
      event => event.eventType === 'ble-connected',
    ),
    motionObservationMs: latencyBetween(events, 8, 'moving'),
    completionObservationMs: latencyBetween(events, 0, 'stopped'),
  };
}

async function loadRun(studyRoot, runId) {
  const runRoot = path.join(studyRoot, 'runs', runId);
  const validation = await validateRun(runRoot);
  if (!validation.valid) {
    throw new Error(`${runId} is not structurally valid: ${validation.errors.join(' ')}`);
  }
  const [manifest, verdict, events] = await Promise.all([
    readJson(path.join(runRoot, 'manifest.json')),
    readJson(path.join(runRoot, 'verdict.json')),
    readEvents(path.join(runRoot, 'events.jsonl')),
  ]);
  const stimulusIssued = events.some(event => event.eventType === 'stimulus-issued');
  if ((verdict.validity === 'valid') !== stimulusIssued) {
    throw new Error(
      `${runId} violates the frozen stimulus validity boundary ` +
        `(validity=${verdict.validity}, stimulusIssued=${stimulusIssued}).`,
    );
  }
  return {manifest, verdict, events, timing: extractTiming(events)};
}

function statistics(values) {
  const numbers = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (numbers.length === 0) return {n: 0, min: null, median: null, mean: null, max: null};
  const middle = Math.floor(numbers.length / 2);
  const median =
    numbers.length % 2 === 0
      ? (numbers[middle - 1] + numbers[middle]) / 2
      : numbers[middle];
  return {
    n: numbers.length,
    min: round(numbers[0]),
    median: round(median),
    mean: round(numbers.reduce((sum, value) => sum + value, 0) / numbers.length),
    max: round(numbers.at(-1)),
  };
}

function csvValue(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(rows, columns) {
  return [
    columns.join(','),
    ...rows.map(row => columns.map(column => csvValue(row[column])).join(',')),
  ].join('\n') + '\n';
}

function markdownTable(rows, columns) {
  const header = `| ${columns.join(' | ')} |`;
  const divider = `| ${columns.map(() => '---').join(' | ')} |`;
  const body = rows.map(row => `| ${columns.map(column => row[column] ?? '').join(' | ')} |`);
  return [header, divider, ...body].join('\n');
}

export async function summarizeEvidence({
  studyRoot,
  planPath,
  diagnosticRunIds = DEFAULT_DIAGNOSTICS,
}) {
  const [study, plan, directoryEntries] = await Promise.all([
    readJson(path.join(studyRoot, 'study-manifest.json')),
    readJson(planPath),
    readdir(path.join(studyRoot, 'runs'), {withFileTypes: true}),
  ]);
  if (study.protocolVersion !== plan.protocolVersion) {
    throw new Error('The study and run plan protocol versions differ.');
  }

  const scheduleByRunId = new Map(plan.schedule.map(item => [item.plannedRunId, item]));
  const confirmatoryNames = directoryEntries
    .filter(entry => entry.isDirectory() && /^c\d{3}(?:-retry\d+)?-/.test(entry.name))
    .map(entry => entry.name)
    .sort((left, right) => {
      const leftItem = scheduleByRunId.get(plannedRunIdFor(left));
      const rightItem = scheduleByRunId.get(plannedRunIdFor(right));
      return leftItem.sequence - rightItem.sequence || retryNumber(left) - retryNumber(right);
    });

  const runs = [];
  for (const runId of confirmatoryNames) {
    const schedule = scheduleByRunId.get(plannedRunIdFor(runId));
    if (!schedule) throw new Error(`${runId} does not resolve to a frozen schedule item.`);
    const record = await loadRun(studyRoot, runId);
    for (const field of ['caseId', 'route', 'repetition']) {
      if (record.manifest[field] !== schedule[field]) {
        throw new Error(`${runId} manifest ${field} differs from the frozen plan.`);
      }
    }
    runs.push({
      sequence: schedule.sequence,
      block: schedule.block,
      role: schedule.role,
      conditionId: schedule.conditionId,
      plannedRunId: schedule.plannedRunId,
      runId,
      attempt: retryNumber(runId) + 1,
      route: schedule.route,
      caseId: schedule.caseId,
      repetition: schedule.repetition,
      startedAt: record.manifest.startedAt,
      validity: record.verdict.validity,
      outcome: record.verdict.outcome,
      failureBoundary: record.verdict.failureBoundary,
      manualIntervention: record.verdict.manualIntervention,
      stimulusIssued: record.events.some(event => event.eventType === 'stimulus-issued'),
      ...record.timing,
    });
  }

  const diagnosticRuns = [];
  for (const runId of diagnosticRunIds) {
    const record = await loadRun(studyRoot, runId);
    diagnosticRuns.push({
      runId,
      route: record.manifest.route,
      caseId: record.manifest.caseId,
      startedAt: record.manifest.startedAt,
      validity: record.verdict.validity,
      outcome: record.verdict.outcome,
      failureBoundary: record.verdict.failureBoundary,
      stimulusIssued: record.events.some(event => event.eventType === 'stimulus-issued'),
      ...record.timing,
    });
  }

  const conditionRows = Object.entries(plan.targets.byCondition).map(
    ([conditionId, plannedValidRuns]) => {
      const matching = runs.filter(run => run.conditionId === conditionId);
      return {
        conditionId,
        plannedValidRuns,
        attempts: matching.length,
        schedulePositionsAttempted: new Set(matching.map(run => run.sequence)).size,
        validRuns: matching.filter(run => run.validity === 'valid').length,
        validPasses: matching.filter(
          run => run.validity === 'valid' && run.outcome === 'pass',
        ).length,
        validFailures: matching.filter(
          run => run.validity === 'valid' && run.outcome === 'fail',
        ).length,
        invalidAttempts: matching.filter(run => run.validity === 'invalid').length,
      };
    },
  );

  const timingRows = [];
  const metrics = [
    ['subscribedMs', 'setup subscription'],
    ['motionObservationMs', 'motion observation'],
    ['completionObservationMs', 'completed-interval observation'],
  ];
  for (const route of ['injected', 'bumble-ble', 'tablet-ble']) {
    const healthyValid = runs.filter(
      run =>
        run.route === route &&
        run.caseId === 'healthy-threshold' &&
        run.validity === 'valid',
    );
    for (const [field, metric] of metrics) {
      const summary = statistics(healthyValid.map(run => run[field]));
      if (summary.n > 0) timingRows.push({route, metric, ...summary});
    }
  }

  const validRuns = runs.filter(run => run.validity === 'valid');
  const invalidRuns = runs.filter(run => run.validity === 'invalid');
  const validSequences = new Set(validRuns.map(run => run.sequence));
  const attemptedSequences = new Set(runs.map(run => run.sequence));
  const nextIncomplete = plan.schedule.find(item => !validSequences.has(item.sequence));
  const pendingAttempts = nextIncomplete
    ? runs.filter(run => run.sequence === nextIncomplete.sequence)
    : [];
  const lastThreePending = pendingAttempts.slice(-3);
  const stoppedForDiagnosis =
    lastThreePending.length === 3 &&
    lastThreePending.every(
      run =>
        run.validity === 'invalid' &&
        run.failureBoundary === lastThreePending[0].failureBoundary,
    );
  const boundaryCounts = Object.fromEntries(
    [...new Set(invalidRuns.map(run => run.failureBoundary))]
      .sort()
      .map(boundary => [boundary, invalidRuns.filter(run => run.failureBoundary === boundary).length]),
  );

  return {
    summary: {
      schemaVersion: '1',
      studyId: study.studyId,
      protocolVersion: study.protocolVersion,
      planId: plan.planId,
      collectionStatus:
        validRuns.length === plan.targets.validRuns
          ? 'complete'
          : stoppedForDiagnosis
            ? 'stopped-for-diagnosis'
            : 'in-progress',
      targetValidRuns: plan.targets.validRuns,
      confirmatoryAttempts: runs.length,
      attemptedSchedulePositions: attemptedSequences.size,
      completedSchedulePositions: validSequences.size,
      validRuns: validRuns.length,
      validPasses: validRuns.filter(run => run.outcome === 'pass').length,
      validFailures: validRuns.filter(run => run.outcome === 'fail').length,
      invalidPreStimulusAttempts: invalidRuns.length,
      invalidFailureBoundaries: boundaryCounts,
      nextIncompleteSequence: nextIncomplete?.sequence ?? null,
      nextIncompleteRunId: nextIncomplete?.plannedRunId ?? null,
      laterSchedulePositionsStarted: runs.some(
        run => nextIncomplete && run.sequence > nextIncomplete.sequence,
      ),
      diagnosticRuns: diagnosticRuns.length,
      interpretationStatus: 'interim-descriptive',
    },
    conditions: conditionRows,
    timings: timingRows,
    runs,
    diagnosticRuns,
  };
}

export async function writeSummary(outputRoot, result) {
  await mkdir(outputRoot, {recursive: true});
  const runColumns = [
    'sequence',
    'block',
    'role',
    'conditionId',
    'plannedRunId',
    'runId',
    'attempt',
    'route',
    'caseId',
    'repetition',
    'startedAt',
    'validity',
    'outcome',
    'failureBoundary',
    'manualIntervention',
    'stimulusIssued',
    'appControlReadyMs',
    'subscribedMs',
    'resetToBleConnectedMs',
    'motionObservationMs',
    'completionObservationMs',
  ];
  const conditionColumns = [
    'conditionId',
    'plannedValidRuns',
    'attempts',
    'schedulePositionsAttempted',
    'validRuns',
    'validPasses',
    'validFailures',
    'invalidAttempts',
  ];
  const timingColumns = ['route', 'metric', 'n', 'min', 'median', 'mean', 'max'];
  const diagnosticColumns = runColumns.filter(
    column => !['sequence', 'block', 'role', 'conditionId', 'plannedRunId', 'attempt', 'repetition', 'manualIntervention'].includes(column),
  );
  const files = {
    'interim-results.json': `${JSON.stringify(result, null, 2)}\n`,
    'confirmatory-runs.csv': toCsv(result.runs, runColumns),
    'condition-summary.csv': toCsv(result.conditions, conditionColumns),
    'timing-summary.csv': toCsv(result.timings, timingColumns),
    'diagnostic-runs.csv': toCsv(result.diagnosticRuns, diagnosticColumns),
  };
  const displayConditions = result.conditions.map(row => ({
    Condition: row.conditionId,
    Target: row.plannedValidRuns,
    Attempts: row.attempts,
    Valid: row.validRuns,
    Invalid: row.invalidAttempts,
  }));
  files['README.md'] = `# Interim derived results\n\n` +
    `This directory is deterministically generated from immutable run manifests, ` +
    `events, verdicts, the frozen study manifest, and the frozen run plan. It is ` +
    `an interim descriptive checkpoint, not the final confirmatory result.\n\n` +
    `- Confirmatory attempts: ${result.summary.confirmatoryAttempts}\n` +
    `- Valid runs: ${result.summary.validRuns} ` +
    `(${result.summary.validPasses} pass, ${result.summary.validFailures} fail)\n` +
    `- Invalid pre-stimulus attempts: ${result.summary.invalidPreStimulusAttempts}\n` +
    `- Next incomplete sequence: ${result.summary.nextIncompleteSequence} ` +
    `(${result.summary.nextIncompleteRunId})\n\n` +
    `${markdownTable(displayConditions, ['Condition', 'Target', 'Attempts', 'Valid', 'Invalid'])}\n\n` +
    `Diagnostic runs are reported separately and never enter confirmatory counts. ` +
    `Timing summaries are descriptive and retain the route and metric strata.\n`;
  await Promise.all(
    Object.entries(files).map(([name, contents]) =>
      writeFile(path.join(outputRoot, name), contents, 'utf8'),
    ),
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  const options = parseArguments(process.argv.slice(2));
  const result = await summarizeEvidence(options);
  await writeSummary(options.outputRoot, result);
  process.stdout.write(
    `Wrote interim results for ${result.summary.confirmatoryAttempts} confirmatory attempts ` +
      `to ${options.outputRoot}\n`,
  );
}
