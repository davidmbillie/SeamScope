import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {access, mkdir, open, readFile, readdir, stat, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const scriptPath = fileURLToPath(import.meta.url);
const repositoryRoot = path.resolve(path.dirname(scriptPath), '..', '..');
const automationRoot = path.join(repositoryRoot, 'automation');
const studyRoot = path.join(repositoryRoot, 'artifacts', 'evidence', 'pilot-v1');
const runsRoot = path.join(studyRoot, 'runs');
const outputRoot = path.join(studyRoot, 'derived', 'integrity-audit');
const planPath = path.join(
  automationRoot,
  'evidence',
  'plans',
  'pilot-v1-confirmatory.json',
);
const freezePath = path.join(automationRoot, 'evidence', 'freezes', 'pilot-v1.json');
const schemaRoot = path.join(automationRoot, 'evidence', 'schemas');
const execFileAsync = promisify(execFile);

const schemaFiles = {
  study: 'study-manifest.schema.json',
  manifest: 'run-manifest.schema.json',
  event: 'event.schema.json',
  verdict: 'verdict.schema.json',
  freeze: 'freeze-record.schema.json',
};

function parseArguments(argv) {
  if (argv.length === 0) return {strict: false};
  if (argv.length === 1 && argv[0] === '--strict') return {strict: true};
  throw new Error(`Unknown arguments: ${argv.join(' ')}`);
}

async function readJson(filePath) {
  return JSON.parse((await readFile(filePath, 'utf8')).replace(/^\uFEFF/, ''));
}

async function readEvents(filePath) {
  return (await readFile(filePath, 'utf8'))
    .split(/\r?\n/)
    .filter(Boolean)
    .map(line => JSON.parse(line));
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function sha256(filePath) {
  return createHash('sha256').update(await readFile(filePath)).digest('hex');
}

async function hasPngSignature(filePath) {
  const contents = await readFile(filePath);
  return (
    contents.length >= 8 &&
    contents.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  );
}

async function gitBlobSha256(commit, repositoryPath) {
  try {
    const {stdout} = await execFileAsync(
      'git',
      ['show', `${commit}:${repositoryPath.replaceAll('\\', '/')}`],
      {cwd: repositoryRoot, encoding: 'buffer', maxBuffer: 2 * 1024 * 1024},
    );
    return createHash('sha256').update(stdout).digest('hex');
  } catch {
    return null;
  }
}

function plannedRunIdFor(runId) {
  return runId.replace(/^(c\d{3})-retry\d+-/, '$1-');
}

function retryNumber(runId) {
  return Number(runId.match(/^c\d{3}-retry(\d+)-/)?.[1] ?? 0);
}

function formatAjvErrors(errors = []) {
  return errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('; ');
}

function addFinding(findings, id, severity, scope, message, details = {}) {
  findings.push({id, severity, scope, message, ...details});
}

async function compareCapturedSlice(runRoot, capture, findings, runId) {
  const bumblePath = path.join(runRoot, 'bumble.log');
  const sessionPath = path.join(studyRoot, 'sessions', capture.bumble.sessionLogName);
  const capturedStat = await stat(bumblePath);
  const declaredLength = capture.bumble.endOffset - capture.bumble.startOffset;
  if (
    capturedStat.size !== capture.bumble.capturedBytes ||
    capturedStat.size !== declaredLength
  ) {
    addFinding(
      findings,
      'CAPTURE_LENGTH_MISMATCH',
      'error',
      'confirmatory-run',
      'The Bumble slice length differs from capture.json.',
      {runId, capturedBytes: capturedStat.size, declaredBytes: capture.bumble.capturedBytes},
    );
    return false;
  }
  if (!(await exists(sessionPath))) {
    addFinding(
      findings,
      'SESSION_LOG_MISSING',
      'error',
      'confirmatory-run',
      'The source Bumble session log named by capture.json is unavailable.',
      {runId, sessionLogName: capture.bumble.sessionLogName},
    );
    return false;
  }
  const sessionStat = await stat(sessionPath);
  if (sessionStat.size < capture.bumble.endOffset) {
    addFinding(
      findings,
      'SESSION_LOG_TRUNCATED',
      'error',
      'confirmatory-run',
      'The source Bumble session log ends before the declared capture offset.',
      {runId, sessionBytes: sessionStat.size, endOffset: capture.bumble.endOffset},
    );
    return false;
  }
  const sourceHandle = await open(sessionPath, 'r');
  try {
    const source = Buffer.alloc(capturedStat.size);
    await sourceHandle.read(source, 0, source.length, capture.bumble.startOffset);
    const captured = await readFile(bumblePath);
    if (!source.equals(captured)) {
      addFinding(
        findings,
        'CAPTURE_CONTENT_MISMATCH',
        'error',
        'confirmatory-run',
        'The retained Bumble slice is not byte-identical to its source-session range.',
        {runId},
      );
      return false;
    }
  } finally {
    await sourceHandle.close();
  }
  return true;
}

async function createValidators() {
  const ajv = new Ajv2020({allErrors: true, strict: false});
  addFormats(ajv);
  const validators = {};
  for (const [name, fileName] of Object.entries(schemaFiles)) {
    validators[name] = ajv.compile(await readJson(path.join(schemaRoot, fileName)));
  }
  return validators;
}

async function verifyFrozenArtifact({
  key,
  filePath,
  expected,
  findings,
  inventory,
  unavailableSeverity = 'error',
  gitBaselineCommit = null,
  gitPath = null,
}) {
  if (!(await exists(filePath))) {
    addFinding(
      findings,
      `${key.toUpperCase()}_UNAVAILABLE`,
      unavailableSeverity,
      'freeze',
      `The frozen ${key} artifact is unavailable at its expected retained location.`,
      {expectedSha256: expected.sha256, expectedBytes: expected.bytes},
    );
    return;
  }
  const fileStat = await stat(filePath);
  const actualHash = await sha256(filePath);
  inventory.push({
    scope: 'freeze',
    artifact: key,
    path: path.relative(repositoryRoot, filePath).replaceAll('\\', '/'),
    bytes: fileStat.size,
    sha256: actualHash,
  });
  if (fileStat.size !== expected.bytes || actualHash !== expected.sha256) {
    const baselineHash =
      gitBaselineCommit && gitPath
        ? await gitBlobSha256(gitBaselineCommit, gitPath)
        : null;
    if (baselineHash === expected.sha256) {
      addFinding(
        findings,
        'WORKTREE_DRIFT_FROM_FREEZE',
        'observation',
        'freeze',
        `The current ${key} differs from the freeze, but the declared Git baseline retains the exact frozen bytes.`,
        {key, expectedSha256: expected.sha256, actualSha256: actualHash, gitBaselineCommit},
      );
      return;
    }
    addFinding(
      findings,
      `${key.toUpperCase()}_IDENTITY_MISMATCH`,
      key === 'applicationApk' ? 'warning' : 'error',
      'freeze',
      `The available ${key} does not match the frozen byte length and SHA-256 identity.`,
      {
        expectedBytes: expected.bytes,
        actualBytes: fileStat.size,
        expectedSha256: expected.sha256,
        actualSha256: actualHash,
      },
    );
  }
}

export async function auditEvidence() {
  const findings = [];
  const inventory = [];
  const validators = await createValidators();
  const [study, plan, freeze, privateFreeze, runEntries] = await Promise.all([
    readJson(path.join(studyRoot, 'study-manifest.json')),
    readJson(planPath),
    readJson(freezePath),
    readJson(path.join(studyRoot, 'freeze-metadata.json')),
    readdir(runsRoot, {withFileTypes: true}),
  ]);

  if (!validators.study(study)) {
    addFinding(findings, 'STUDY_SCHEMA', 'error', 'study', 'Study manifest schema failure.', {
      detail: formatAjvErrors(validators.study.errors),
    });
  }
  if (!validators.freeze(freeze)) {
    addFinding(findings, 'FREEZE_SCHEMA', 'error', 'freeze', 'Freeze record schema failure.', {
      detail: formatAjvErrors(validators.freeze.errors),
    });
  }

  const identityChecks = [
    ['studyId', study.studyId, freeze.studyId],
    ['protocolVersion', study.protocolVersion, freeze.protocol.version],
    ['sourceSnapshotSha256', study.artifactHashes.sourceSnapshotSha256, freeze.freeze.sourceState.sha256],
    ['privateSourceSnapshotSha256', privateFreeze.sourceSnapshot.sha256, freeze.freeze.sourceState.sha256],
    ['runPlanSha256', study.artifactHashes.runPlanSha256, freeze.artifacts.runPlan.sha256],
    ['privateRunPlanSha256', privateFreeze.artifacts.runPlan.sha256, freeze.artifacts.runPlan.sha256],
    ['applicationApkSha256', study.artifactHashes.applicationApkSha256, freeze.artifacts.applicationApk.sha256],
    ['privateApplicationApkSha256', privateFreeze.artifacts.applicationApk.sha256, freeze.artifacts.applicationApk.sha256],
    ['firmwareApplicationSha256', study.artifactHashes.firmwareApplicationSha256, freeze.artifacts.firmwareApplicationBinary.sha256],
    ['privateFirmwareApplicationSha256', privateFreeze.artifacts.firmwareApplicationBinary.sha256, freeze.artifacts.firmwareApplicationBinary.sha256],
  ];
  for (const [name, left, right] of identityChecks) {
    if (left !== right) {
      addFinding(
        findings,
        'FREEZE_IDENTITY_DISAGREEMENT',
        'error',
        'freeze',
        `${name} differs across frozen records.`,
        {left, right},
      );
    }
  }

  const frozenArtifacts = [
    ['firmwareSource', path.join(repositoryRoot, freeze.artifacts.firmwareSource.path), freeze.artifacts.firmwareSource.path],
    ['runPlan', path.join(repositoryRoot, freeze.artifacts.runPlan.path), freeze.artifacts.runPlan.path],
    ['automationLock', path.join(repositoryRoot, freeze.artifacts.automationLock.path), freeze.artifacts.automationLock.path],
    ['mobileLock', path.join(repositoryRoot, freeze.artifacts.mobileLock.path), freeze.artifacts.mobileLock.path],
    ['firmwareApplicationBinary', path.join(repositoryRoot, 'artifacts', 'freeze', 'firmware', 'seamscope_peripheral.ino.bin'), null],
    ['firmwareBootloaderBinary', path.join(repositoryRoot, 'artifacts', 'freeze', 'firmware', 'seamscope_peripheral.ino.bootloader.bin'), null],
    ['firmwarePartitionsBinary', path.join(repositoryRoot, 'artifacts', 'freeze', 'firmware', 'seamscope_peripheral.ino.partitions.bin'), null],
    ['applicationApk', path.join(repositoryRoot, 'artifacts', 'freeze', 'application', 'seamscope-frozen.apk'), null],
  ];
  for (const [key, filePath, gitPath] of frozenArtifacts) {
    await verifyFrozenArtifact({
      key,
      filePath,
      expected: freeze.artifacts[key],
      findings,
      inventory,
      unavailableSeverity: key === 'applicationApk' ? 'warning' : 'error',
      gitBaselineCommit: freeze.freeze.gitBaseline.commit,
      gitPath,
    });
  }

  const scheduleByRunId = new Map(plan.schedule.map(item => [item.plannedRunId, item]));
  const confirmatoryNames = runEntries
    .filter(entry => entry.isDirectory() && /^c\d{3}(?:-retry\d+)?-/.test(entry.name))
    .map(entry => entry.name)
    .sort((left, right) => {
      const leftItem = scheduleByRunId.get(plannedRunIdFor(left));
      const rightItem = scheduleByRunId.get(plannedRunIdFor(right));
      return leftItem.sequence - rightItem.sequence || retryNumber(left) - retryNumber(right);
    });
  const allRunNames = runEntries
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort();
  const confirmatorySet = new Set(confirmatoryNames);
  let structuredRunsValid = 0;
  let structuredEventsChecked = 0;
  let bumbleCapturesVerified = 0;

  for (const runId of allRunNames) {
    const runRoot = path.join(runsRoot, runId);
    const corePaths = {
      manifest: path.join(runRoot, 'manifest.json'),
      events: path.join(runRoot, 'events.jsonl'),
      verdict: path.join(runRoot, 'verdict.json'),
    };
    const missingCore = [];
    for (const [name, filePath] of Object.entries(corePaths)) {
      if (!(await exists(filePath))) missingCore.push(name);
    }
    if (missingCore.length > 0) {
      addFinding(
        findings,
        'RUN_CORE_FILES_MISSING',
        'error',
        confirmatorySet.has(runId) ? 'confirmatory-run' : 'supporting-run',
        'A run is missing required normalized evidence files.',
        {runId, missingCore},
      );
      continue;
    }
    let manifest;
    let verdict;
    let events;
    try {
      [manifest, verdict, events] = await Promise.all([
        readJson(corePaths.manifest),
        readJson(corePaths.verdict),
        readEvents(corePaths.events),
      ]);
    } catch (error) {
      addFinding(findings, 'RUN_PARSE_FAILURE', 'error', 'run', error.message, {runId});
      continue;
    }
    let runSchemaValid = true;
    for (const [kind, value] of [
      ['manifest', manifest],
      ['verdict', verdict],
    ]) {
      if (!validators[kind](value)) {
        runSchemaValid = false;
        addFinding(
          findings,
          `${kind.toUpperCase()}_SCHEMA`,
          'error',
          confirmatorySet.has(runId) ? 'confirmatory-run' : 'supporting-run',
          `${kind} schema failure.`,
          {runId, detail: formatAjvErrors(validators[kind].errors)},
        );
      }
    }
    events.forEach((event, index) => {
      structuredEventsChecked += 1;
      if (!validators.event(event)) {
        runSchemaValid = false;
        addFinding(
          findings,
          'EVENT_SCHEMA',
          'error',
          confirmatorySet.has(runId) ? 'confirmatory-run' : 'supporting-run',
          'Event schema failure.',
          {runId, eventIndex: index, detail: formatAjvErrors(validators.event.errors)},
        );
      }
      if (event.runId !== runId || event.eventIndex !== index) {
        addFinding(
          findings,
          'EVENT_ID_OR_ORDER',
          'error',
          'run',
          'Event run identity or contiguous index is inconsistent.',
          {runId, eventIndex: index},
        );
      }
    });
    if (runSchemaValid) structuredRunsValid += 1;

    const firstEvent = events[0];
    const lastEvent = events.at(-1);
    if (firstEvent?.eventType !== 'run-started' || lastEvent?.eventType !== 'run-finished') {
      addFinding(
        findings,
        'RUN_BOUNDARY_EVENTS',
        'error',
        'run',
        'The event stream does not begin and end with the declared boundary events.',
        {runId},
      );
    }
    if (
      lastEvent?.details?.validity !== verdict.validity ||
      lastEvent?.details?.outcome !== verdict.outcome ||
      lastEvent?.details?.failureBoundary !== verdict.failureBoundary
    ) {
      addFinding(
        findings,
        'VERDICT_EVENT_DISAGREEMENT',
        'error',
        'run',
        'The final normalized event and verdict disagree.',
        {runId},
      );
    }
    const stimulusIssued = events.some(event => event.eventType === 'stimulus-issued');
    if ((verdict.validity === 'valid') !== stimulusIssued) {
      addFinding(
        findings,
        'VALIDITY_BOUNDARY_DISAGREEMENT',
        'error',
        'run',
        'Validity does not agree with whether the stimulus boundary was crossed.',
        {runId, validity: verdict.validity, stimulusIssued},
      );
    }
    const interventionObserved = events.some(
      event => event.eventType === 'manual-intervention',
    );
    if (verdict.manualIntervention !== interventionObserved) {
      addFinding(
        findings,
        'INTERVENTION_DISAGREEMENT',
        'error',
        'run',
        'The verdict manual-intervention flag disagrees with the event stream.',
        {runId},
      );
    }
    for (let index = 1; index < events.length; index += 1) {
      if (Date.parse(events[index].hostObservedAt) < Date.parse(events[index - 1].hostObservedAt)) {
        addFinding(
          findings,
          'HOST_TIME_REVERSAL',
          confirmatorySet.has(runId) ? 'error' : 'warning',
          confirmatorySet.has(runId) ? 'confirmatory-run' : 'supporting-run',
          'Host-observed timestamps reverse within the event stream.',
          {runId, eventIndex: index},
        );
      }
    }

    if (!confirmatorySet.has(runId)) continue;
    const planned = scheduleByRunId.get(plannedRunIdFor(runId));
    if (!planned) {
      addFinding(
        findings,
        'UNPLANNED_CONFIRMATORY_RUN',
        'error',
        'confirmatory-run',
        'The confirmatory-style run ID does not resolve to the frozen plan.',
        {runId},
      );
      continue;
    }
    for (const field of ['caseId', 'route', 'repetition']) {
      if (manifest[field] !== planned[field]) {
        addFinding(
          findings,
          'PLAN_MANIFEST_DISAGREEMENT',
          'error',
          'confirmatory-run',
          `Manifest ${field} differs from the frozen plan.`,
          {runId, planned: planned[field], observed: manifest[field]},
        );
      }
    }
    if (manifest.retryOf !== verdict.retryOf) {
      addFinding(
        findings,
        'RETRY_VERDICT_DISAGREEMENT',
        'error',
        'confirmatory-run',
        'Manifest and verdict retry identities differ.',
        {runId},
      );
    }
    for (const fileName of ['appium.log', 'logcat.log', 'serial.log']) {
      const logPath = path.join(runRoot, fileName);
      if (!(await exists(logPath))) {
        addFinding(
          findings,
          'ROUTE_LOG_MISSING',
          'error',
          'confirmatory-run',
          `Required route log ${fileName} is missing.`,
          {runId},
        );
      } else if (
        (fileName !== 'serial.log' || manifest.route !== 'injected') &&
        (await stat(logPath)).size === 0
      ) {
        addFinding(
          findings,
          'ROUTE_LOG_EMPTY',
          'error',
          'confirmatory-run',
          `Required route log ${fileName} is empty.`,
          {runId},
        );
      }
    }
    const serialContents = await readFile(path.join(runRoot, 'serial.log'), 'utf8');
    const missingSerialLines = events
      .filter(event => event.source === 'fixture' && typeof event.details?.line === 'string')
      .map(event => event.details.line)
      .filter(line => !serialContents.includes(line));
    if (missingSerialLines.length > 0) {
      addFinding(
        findings,
        'NORMALIZED_SERIAL_DISAGREEMENT',
        'error',
        'confirmatory-run',
        'A normalized fixture event is absent from the retained serial trace.',
        {runId, missingSerialLines: [...new Set(missingSerialLines)]},
      );
    }
    if (manifest.route === 'bumble-ble') {
      const capturePath = path.join(runRoot, 'capture.json');
      if (!(await exists(capturePath)) || !(await exists(path.join(runRoot, 'bumble.log')))) {
        addFinding(
          findings,
          'BUMBLE_CAPTURE_MISSING',
          'error',
          'confirmatory-run',
          'The Bumble-backed run lacks its capture metadata or sliced log.',
          {runId},
        );
      } else {
        if ((await stat(path.join(runRoot, 'bumble.log'))).size === 0) {
          addFinding(
            findings,
            'BUMBLE_CAPTURE_EMPTY',
            'error',
            'confirmatory-run',
            'The retained Bumble slice is empty.',
            {runId},
          );
        }
        const capture = await readJson(capturePath);
        if (await compareCapturedSlice(runRoot, capture, findings, runId)) {
          bumbleCapturesVerified += 1;
        }
      }
    }
    if (verdict.validity === 'valid' && verdict.outcome === 'pass') {
      const missingScreenshots = [];
      for (const fileName of ['start.png', 'final.png']) {
        if (!(await exists(path.join(runRoot, fileName)))) missingScreenshots.push(fileName);
      }
      if (missingScreenshots.length > 0) {
        addFinding(
          findings,
          'SUCCESS_SCREENSHOT_MISSING',
          'warning',
          'confirmatory-run',
          'A valid passing run lacks a declared checkpoint screenshot.',
          {runId, missingScreenshots},
        );
      } else {
        for (const fileName of ['start.png', 'final.png']) {
          if (!(await hasPngSignature(path.join(runRoot, fileName)))) {
            addFinding(
              findings,
              'INVALID_PNG_CAPTURE',
              'error',
              'confirmatory-run',
              'A checkpoint capture does not have a valid PNG signature.',
              {runId, fileName},
            );
          }
        }
      }
      const failedAssertion = events.find(
        event => event.eventType === 'assertion' && event.details?.passed === false,
      );
      if (failedAssertion) {
        addFinding(
          findings,
          'PASS_WITH_FAILED_ASSERTION',
          'error',
          'confirmatory-run',
          'A passing verdict contains a failed normalized assertion.',
          {runId, eventIndex: failedAssertion.eventIndex},
        );
      }
    }
    if (verdict.validity === 'invalid') {
      const missingFailureCapture = [];
      for (const fileName of ['failure.png', 'failure-ui.xml']) {
        if (!(await exists(path.join(runRoot, fileName)))) missingFailureCapture.push(fileName);
      }
      if (missingFailureCapture.length > 0) {
        addFinding(
          findings,
          'INVALID_UI_CAPTURE_MISSING',
          'warning',
          'confirmatory-run',
          'An invalid attempt lacks the usual failure screenshot and/or UI hierarchy.',
          {runId, missingFailureCapture},
        );
      } else {
        if (!(await hasPngSignature(path.join(runRoot, 'failure.png')))) {
          addFinding(
            findings,
            'INVALID_PNG_CAPTURE',
            'error',
            'confirmatory-run',
            'A failure capture does not have a valid PNG signature.',
            {runId, fileName: 'failure.png'},
          );
        }
        const hierarchy = await readFile(path.join(runRoot, 'failure-ui.xml'), 'utf8');
        if (!hierarchy.includes('<hierarchy')) {
          addFinding(
            findings,
            'INVALID_UI_HIERARCHY',
            'error',
            'confirmatory-run',
            'A failure UI artifact does not contain an Android hierarchy.',
            {runId},
          );
        }
      }
    }

    for (const fileName of await readdir(runRoot)) {
      const filePath = path.join(runRoot, fileName);
      const fileStat = await stat(filePath);
      if (!fileStat.isFile()) continue;
      inventory.push({
        scope: 'confirmatory-run',
        runId,
        artifact: fileName,
        path: path.relative(repositoryRoot, filePath).replaceAll('\\', '/'),
        bytes: fileStat.size,
        sha256: await sha256(filePath),
      });
    }
  }

  for (let index = 0; index < confirmatoryNames.length; index += 1) {
    const runId = confirmatoryNames[index];
    const number = retryNumber(runId);
    const record = await readJson(path.join(runsRoot, runId, 'manifest.json'));
    const expectedRetryOf = number === 0 ? null : confirmatoryNames[index - 1];
    if (record.retryOf !== expectedRetryOf) {
      addFinding(
        findings,
        'RETRY_CHAIN_DISAGREEMENT',
        'error',
        'confirmatory-run',
        'The retry does not reference the immediately preceding attempt.',
        {runId, expectedRetryOf, observedRetryOf: record.retryOf},
      );
    }
  }

  const counts = {
    errors: findings.filter(finding => finding.severity === 'error').length,
    warnings: findings.filter(finding => finding.severity === 'warning').length,
    observations: findings.filter(finding => finding.severity === 'observation').length,
  };
  const duplicateArtifactGroups = Object.values(
    inventory
      .filter(item => item.scope === 'confirmatory-run')
      .reduce((groups, item) => {
        groups[item.sha256] ??= [];
        groups[item.sha256].push({runId: item.runId, artifact: item.artifact, bytes: item.bytes});
        return groups;
      }, {}),
  ).filter(group => group.length > 1);
  return {
    auditVersion: '1',
    studyId: study.studyId,
    protocolVersion: study.protocolVersion,
    scope: {
      totalRunDirectories: allRunNames.length,
      confirmatoryAttempts: confirmatoryNames.length,
      structuredRunsSchemaValid: structuredRunsValid,
      structuredEventsChecked,
      bumbleCapturesByteVerified: bumbleCapturesVerified,
      inventoryEntries: inventory.length,
      duplicateArtifactGroups: duplicateArtifactGroups.length,
    },
    status: counts.errors === 0 ? (counts.warnings === 0 ? 'pass' : 'pass-with-warnings') : 'findings',
    counts,
    findings,
    duplicateArtifactGroups,
    inventory,
  };
}

export async function writeAudit(result) {
  await mkdir(outputRoot, {recursive: true});
  await writeFile(
    path.join(outputRoot, 'audit-report.json'),
    `${JSON.stringify(result, null, 2)}\n`,
    'utf8',
  );
  await writeFile(
    path.join(outputRoot, 'artifact-inventory.json'),
    `${JSON.stringify(result.inventory, null, 2)}\n`,
    'utf8',
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  const {strict} = parseArguments(process.argv.slice(2));
  const result = await auditEvidence();
  await writeAudit(result);
  process.stdout.write(
    `Evidence audit: ${result.status}; ${result.counts.errors} error(s), ` +
      `${result.counts.warnings} warning(s); ${result.scope.structuredEventsChecked} events checked; ` +
      `${result.scope.bumbleCapturesByteVerified} Bumble slices byte-verified.\n`,
  );
  if (strict && result.counts.errors > 0) process.exitCode = 2;
}
