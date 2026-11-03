import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {copyFile, cp, mkdir, readFile, readdir, rm, stat, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const automationRoot = path.resolve(path.dirname(scriptPath), '..');
const repoRoot = path.resolve(automationRoot, '..');
const studyRoot = path.join(repoRoot, 'artifacts', 'evidence', 'pilot-v1');
const releaseParent = path.join(repoRoot, 'artifacts', 'release');
const releaseVersion = '1.0.0';
const releaseTag = `v${releaseVersion}`;
const releaseDoi = '10.5281/zenodo.23903535';
const releaseRoot = path.join(releaseParent, `seamscope-v${releaseVersion}-evidence`);
const confirmatoryCsv = path.join(studyRoot, 'derived', 'interim-results', 'confirmatory-runs.csv');
const normalizedNames = ['manifest.json', 'events.jsonl', 'capture.json', 'verdict.json'];
const representativeExtras = new Map([
  ['c001-injected-healthy-r01', ['final.png']],
  ['c002-bumble-healthy-r01', ['final.png', 'serial.log', 'bumble.log']],
  ['c046-bumble-dropped-r10-retry01', [
    'start.png',
    'failure.png',
    'failure-ui.xml',
    'serial.log',
    'bumble.log',
    'appium.log',
  ]],
]);
const textExtensions = new Set(['.json', '.jsonl', '.log', '.md', '.txt', '.xml']);

const toPosix = value => value.split(path.sep).join('/');

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function sha256(filePath) {
  return createHash('sha256').update(await readFile(filePath)).digest('hex');
}

async function copyRequired(source, destination) {
  if (!(await exists(source))) throw new Error(`Required source is missing: ${source}`);
  await mkdir(path.dirname(destination), {recursive: true});
  await copyFile(source, destination);
}

async function copyTree(source, destination) {
  if (!(await exists(source))) throw new Error(`Required directory is missing: ${source}`);
  await mkdir(path.dirname(destination), {recursive: true});
  await cp(source, destination, {recursive: true, force: true});
}

function parseCsv(content) {
  const lines = content.trim().split(/\r?\n/);
  const headers = lines[0].split(',');
  return lines.slice(1).map(line => {
    const values = line.split(',');
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
  });
}

function sanitizeText(input) {
  let text = input;
  const replacements = [];
  const sourceAddresses = [...new Set(
    [...input.matchAll(/\b(?:[0-9A-F]{2}:){5}[0-9A-F]{2}\b/gi)].map(match => match[0]),
  )].filter(address => address.toUpperCase() !== '00:00:00:00:00:00');
  const incidentalNames = [...new Set(
    [...input.matchAll(/\[Complete Local Name\]:\s*"([^"]*)"/g)]
      .map(match => match[1])
      .filter(name => name !== 'SeamScope Peripheral'),
  )];
  const replace = (id, expression, value) => {
    let count = 0;
    text = text.replace(expression, () => {
      count += 1;
      return value;
    });
    if (count) replacements.push({id, count});
  };

  replace('ansi-terminal-control', /\x1b\[[0-?]*[ -/]*[@-~]/g, '');
  replace('repository-path', /C:[\\/]git[\\/]paper[\\/]SeamScope/gi, '<REPO_ROOT>');
  replace(
    'android-sdk-path',
    /C:[\\/]Users[\\/]david[\\/]AppData[\\/]Local[\\/]Android[\\/]Sdk/gi,
    '<ANDROID_SDK>',
  );
  replace(
    'local-app-data-path',
    /C:[\\/]Users[\\/]david[\\/]AppData[\\/]Local/gi,
    '<LOCAL_APP_DATA>',
  );
  replace('user-home-path', /C:[\\/]Users[\\/]david/gi, '<USER_HOME>');
  replace('avd-home-path', /D:[\\/]SeamScope[\\/]android-avd/gi, '<AVD_HOME>');
  replace('tablet-serial', /<TABLET_SERIAL>/gi, '<TABLET_SERIAL>');
  replace('controller-serial', /<CONTROLLER_SERIAL>/gi, '<CONTROLLER_SERIAL>');
  replace('emulator-serial', /emulator-5554/gi, '<EMULATOR_SERIAL>');
  replace('serial-port', /\bCOM3\b/gi, '<SERIAL_PORT>');
  if (os.hostname()) {
    replace('host-name', new RegExp(os.hostname().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '<HOST>');
  }
  replace(
    'incidental-ble-name',
    /(\[Complete Local Name\]:\s*)"(?!SeamScope Peripheral")([^"]*)"/g,
    '$1"<NEARBY_BLE_NAME>"',
  );
  replace(
    'bluetooth-address',
    /\b(?!00:00:00:00:00:00\b)(?:[0-9A-F]{2}:){5}[0-9A-F]{2}\b/gi,
    '<BLE_ADDRESS>',
  );
  for (const address of sourceAddresses) {
    const bytes = address.split(':');
    for (const encoded of [
      bytes.join(''),
      [...bytes].reverse().join(''),
      bytes.join(' '),
      [...bytes].reverse().join(' '),
    ]) {
      const escaped = encoded.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      replace('encoded-bluetooth-address', new RegExp(`(?<![0-9A-F])${escaped}(?![0-9A-F])`, 'gi'), '<BLE_ADDRESS_BYTES>');
    }
  }
  for (const name of incidentalNames) {
    const bytes = [...Buffer.from(name, 'utf8')].map(value => value.toString(16).padStart(2, '0'));
    for (const encoded of [bytes.join(''), bytes.join(' ')]) {
      const escaped = encoded.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      replace('encoded-incidental-ble-name', new RegExp(escaped, 'gi'), '<NEARBY_BLE_NAME_BYTES>');
    }
  }
  return {text, replacements};
}

async function sanitizeTextFile(source, destination, report) {
  const original = await readFile(source, 'utf8');
  const result = sanitizeText(original);
  await mkdir(path.dirname(destination), {recursive: true});
  await writeFile(destination, result.text, 'utf8');
  report.push({
    path: toPosix(path.relative(releaseRoot, destination)),
    sourceSha256: createHash('sha256').update(original).digest('hex'),
    releasedSha256: createHash('sha256').update(result.text).digest('hex'),
    replacements: result.replacements,
  });
}

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(fullPath)));
    else if (entry.isFile()) files.push(fullPath);
  }
  return files;
}

function git(...args) {
  return execFileSync('git', args, {cwd: repoRoot, encoding: 'utf8'}).trim();
}

async function build() {
  const safeParent = path.resolve(releaseParent);
  const safeTarget = path.resolve(releaseRoot);
  if (path.dirname(safeTarget) !== safeParent || safeTarget === repoRoot) {
    throw new Error(`Refusing to replace unsafe release path: ${safeTarget}`);
  }
  await rm(safeTarget, {recursive: true, force: true});
  await mkdir(safeTarget, {recursive: true});

  await copyRequired(path.join(automationRoot, 'evidence', 'release', 'README.md'), path.join(releaseRoot, 'README.md'));
  await copyRequired(path.join(automationRoot, 'evidence', 'release', 'SANITIZATION.md'), path.join(releaseRoot, 'SANITIZATION.md'));
  await copyRequired(path.join(repoRoot, 'LICENSE'), path.join(releaseRoot, 'LICENSE'));

  const fixedCopies = [
    ['automation/evidence/freezes/pilot-v1.json', 'pilot-v1/freeze-record.json'],
    ['automation/evidence/plans/pilot-v1-confirmatory.json', 'pilot-v1/protocol/run-plan.json'],
    ['automation/evidence/dispositions/pilot-v1.json', 'pilot-v1/protocol/disposition.json'],
    ['artifacts/evidence/pilot-v1/study-manifest.json', 'pilot-v1/study-manifest.json'],
    ['artifacts/evidence/pilot-v1/derived/integrity-audit/audit-report.json', 'pilot-v1/integrity/audit-report.json'],
  ];
  for (const [source, destination] of fixedCopies) {
    await copyRequired(path.join(repoRoot, source), path.join(releaseRoot, destination));
  }
  await copyTree(path.join(studyRoot, 'derived', 'interim-results'), path.join(releaseRoot, 'pilot-v1', 'results'));
  await copyTree(path.join(automationRoot, 'evidence', 'claim-assessments'), path.join(releaseRoot, 'paper-evidence', 'claim-assessments'));
  await copyTree(path.join(automationRoot, 'evidence', 'representatives'), path.join(releaseRoot, 'paper-evidence', 'representatives'));
  await copyTree(path.join(automationRoot, 'evidence', 'schemas'), path.join(releaseRoot, 'paper-evidence', 'schemas'));

  for (const fileName of [
    'anomaly-ledger.md',
    'evidence-integrity-audit.md',
    'evidence-model.md',
    'interim-results.md',
    'protocol.md',
    'representative-timelines.md',
    'sequence46-evidence-chain.md',
  ]) {
    await copyRequired(path.join(repoRoot, 'docs', fileName), path.join(releaseRoot, 'documentation', fileName));
  }

  const rows = parseCsv(await readFile(confirmatoryCsv, 'utf8'));
  const disposition = JSON.parse(await readFile(path.join(automationRoot, 'evidence', 'dispositions', 'pilot-v1.json'), 'utf8'));
  const excluded = new Set(disposition.excludedConfirmatoryRuns.map(record => record.runId));
  const runIds = [...new Set([...rows.map(row => row.runId), ...excluded])];
  if (rows.length !== 87 || runIds.length !== 88 || excluded.size !== 1) {
    throw new Error(
      `Expected 87 eligible attempts plus one retained exclusion; found ${rows.length} eligible rows, ` +
        `${runIds.length} retained IDs, and ${excluded.size} exclusions`,
    );
  }
  const eligible = rows;

  const equivalence = [];
  const sanitization = [];
  for (const runId of runIds) {
    const sourceRun = path.join(studyRoot, 'runs', runId);
    const destinationRun = path.join(releaseRoot, 'pilot-v1', 'runs', runId);
    for (const fileName of normalizedNames) {
      const source = path.join(sourceRun, fileName);
      if (!(await exists(source))) continue;
      const destination = path.join(destinationRun, fileName);
      await copyRequired(source, destination);
      const sourceHash = await sha256(source);
      const releasedHash = await sha256(destination);
      equivalence.push({
        path: `pilot-v1/runs/${runId}/${fileName}`,
        sourceSha256: sourceHash,
        releasedSha256: releasedHash,
        identical: sourceHash === releasedHash,
      });
    }
    for (const fileName of representativeExtras.get(runId) ?? []) {
      const source = path.join(sourceRun, fileName);
      const destination = path.join(destinationRun, fileName);
      if (textExtensions.has(path.extname(fileName).toLowerCase())) {
        await sanitizeTextFile(source, destination, sanitization);
      } else {
        await copyRequired(source, destination);
      }
    }
  }

  for (const [source, destination] of [
    ['artifacts/freeze/application/seamscope-frozen.apk', 'binaries/seamscope-frozen.apk'],
    ['artifacts/freeze/firmware/seamscope_peripheral.ino.bin', 'binaries/firmware/seamscope_peripheral.ino.bin'],
    ['artifacts/freeze/firmware/seamscope_peripheral.ino.bootloader.bin', 'binaries/firmware/seamscope_peripheral.ino.bootloader.bin'],
    ['artifacts/freeze/firmware/seamscope_peripheral.ino.partitions.bin', 'binaries/firmware/seamscope_peripheral.ino.partitions.bin'],
  ]) {
    await copyRequired(path.join(repoRoot, source), path.join(releaseRoot, destination));
  }

  const valid = eligible.filter(row => row.validity === 'valid');
  const manifest = {
    schemaVersion: '1',
    packageId: `seamscope-v${releaseVersion}-evidence`,
    releaseStatus: 'final',
    releaseVersion,
    releaseTag,
    doi: releaseDoi,
    sourceRepository: 'https://github.com/davidmbillie/SeamScope',
    sourceRevision: git('rev-parse', 'HEAD'),
    sourceTreeDirty: git('status', '--porcelain').length > 0,
    studyCounts: {
      confirmatoryAttemptsRetained: runIds.length,
      protocolEligibleAttempts: eligible.length,
      explicitlyExcludedAttempts: excluded.size,
      validOutcomes: valid.length,
      validPasses: valid.filter(row => row.outcome === 'pass').length,
      validFailures: valid.filter(row => row.outcome === 'fail').length,
      invalidAttempts: eligible.filter(row => row.validity === 'invalid').length,
    },
    normalizedRecordCount: equivalence.length,
    representativeRuns: [...representativeExtras.keys()],
    binaryPolicy: 'Exact APK and declared firmware binaries from the portable freeze record are included.',
    privacyPolicy: 'See SANITIZATION.md.',
  };
  await writeFile(path.join(releaseRoot, 'package-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(path.join(releaseRoot, 'structured-equivalence.json'), `${JSON.stringify({schemaVersion: '1', records: equivalence}, null, 2)}\n`);
  await writeFile(path.join(releaseRoot, 'sanitization-report.json'), `${JSON.stringify({schemaVersion: '1', files: sanitization}, null, 2)}\n`);

  await verify({writeChecksums: true});
  process.stdout.write(`Built ${releaseRoot}\n`);
}

async function verify({writeChecksums = false} = {}) {
  if (!(await exists(releaseRoot))) throw new Error(`Release package not found: ${releaseRoot}`);
  const manifest = JSON.parse(await readFile(path.join(releaseRoot, 'package-manifest.json'), 'utf8'));
  if (manifest.releaseStatus !== 'final') throw new Error('Package is not marked final');
  if (manifest.releaseVersion !== releaseVersion) throw new Error('Release version mismatch');
  if (manifest.doi !== releaseDoi) throw new Error('Release DOI mismatch');
  if (manifest.studyCounts.confirmatoryAttemptsRetained !== 88) throw new Error('Attempt count is not 88');
  if (manifest.studyCounts.protocolEligibleAttempts !== 87) throw new Error('Eligible count is not 87');
  if (manifest.studyCounts.validOutcomes !== 50) throw new Error('Valid outcome count is not 50');
  if (manifest.studyCounts.invalidAttempts !== 37) throw new Error('Invalid attempt count is not 37');

  const equivalence = JSON.parse(await readFile(path.join(releaseRoot, 'structured-equivalence.json'), 'utf8'));
  if (!equivalence.records.every(record => record.identical)) {
    throw new Error('A normalized release record differs from its private source');
  }

  const claimRoot = path.join(releaseRoot, 'paper-evidence', 'claim-assessments');
  const claimFiles = await walk(claimRoot);
  for (const claimFile of claimFiles.filter(file => file.endsWith('.json'))) {
    const text = await readFile(claimFile, 'utf8');
    for (const match of text.matchAll(/artifact:\/\/([^"\s]+)/g)) {
      const target = path.join(releaseRoot, ...match[1].split('/'));
      if (!(await exists(target))) throw new Error(`Unresolved artifact reference: ${match[0]}`);
    }
  }

  const forbidden = [
    ['user-home', /C:[\\/]Users[\\/]david/gi],
    ['repository-path', /C:[\\/]git[\\/]paper[\\/]SeamScope/gi],
    ['tablet-serial', /<TABLET_SERIAL>/gi],
    ['controller-serial', /<CONTROLLER_SERIAL>/gi],
    ['emulator-serial', /emulator-5554/gi],
    ['physical-serial-port', /\bCOM3\b/gi],
    ['incidental-ble-name', /\[Complete Local Name\]:\s*"(?!SeamScope Peripheral")[^"]*"/g],
    ['bluetooth-address', /\b(?!00:00:00:00:00:00\b)(?:[0-9A-F]{2}:){5}[0-9A-F]{2}\b/gi],
  ];
  const files = await walk(releaseRoot);
  for (const file of files.filter(file => textExtensions.has(path.extname(file).toLowerCase()))) {
    const text = await readFile(file, 'utf8');
    if (file.endsWith('.json')) JSON.parse(text);
    if (file.endsWith('.jsonl')) {
      for (const line of text.split(/\r?\n/).filter(Boolean)) JSON.parse(line);
    }
    for (const [id, expression] of forbidden) {
      expression.lastIndex = 0;
      if (expression.test(text)) {
        throw new Error(`Forbidden ${id} remains in ${toPosix(path.relative(releaseRoot, file))}`);
      }
    }
  }

  const freeze = JSON.parse(await readFile(path.join(releaseRoot, 'pilot-v1', 'freeze-record.json'), 'utf8'));
  for (const [recordKey, relativePath] of [
    ['applicationApk', 'binaries/seamscope-frozen.apk'],
    ['firmwareApplicationBinary', 'binaries/firmware/seamscope_peripheral.ino.bin'],
    ['firmwareBootloaderBinary', 'binaries/firmware/seamscope_peripheral.ino.bootloader.bin'],
    ['firmwarePartitionsBinary', 'binaries/firmware/seamscope_peripheral.ino.partitions.bin'],
  ]) {
    if (await sha256(path.join(releaseRoot, ...relativePath.split('/'))) !== freeze.artifacts[recordKey].sha256) {
      throw new Error(`Frozen binary hash mismatch: ${relativePath}`);
    }
  }

  const checksumFiles = (await walk(releaseRoot))
    .filter(file => path.basename(file) !== 'checksums.sha256')
    .sort((a, b) => toPosix(a).localeCompare(toPosix(b)));
  const checksumLines = [];
  for (const file of checksumFiles) {
    checksumLines.push(`${await sha256(file)}  ${toPosix(path.relative(releaseRoot, file))}`);
  }
  const checksumText = `${checksumLines.join('\n')}\n`;
  const checksumPath = path.join(releaseRoot, 'checksums.sha256');
  if (writeChecksums) {
    await writeFile(checksumPath, checksumText);
  } else {
    const recorded = await readFile(checksumPath, 'utf8');
    if (recorded !== checksumText) throw new Error('checksums.sha256 does not match package contents');
  }
  process.stdout.write(
    `Verified ${files.length} package files, ${equivalence.records.length} byte-identical normalized records, ` +
      `${claimFiles.filter(file => file.endsWith('.json')).length} claim JSON files, and 4 frozen binaries.\n`,
  );
}

await (process.argv.includes('--verify') ? verify() : build());

