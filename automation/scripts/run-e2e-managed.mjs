#!/usr/bin/env node
import {spawn, spawnSync} from 'node:child_process';
import {once} from 'node:events';
import {
  appendFileSync,
  createWriteStream,
  existsSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const automationRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const appiumEntry = path.join(automationRoot, 'node_modules', 'appium', 'index.js');
const wdioEntry = path.join(
  automationRoot,
  'node_modules',
  '@wdio',
  'cli',
  'bin',
  'wdio.js',
);
const port = Number(process.env.SEAMSCOPE_APPIUM_PORT ?? 4723);
const appiumLogLevel = process.env.SEAMSCOPE_APPIUM_LOG_LEVEL ?? 'info';

function configureAndroidSdk() {
  const localDefault = process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk')
    : undefined;
  const candidates = [
    process.env.SEAMSCOPE_ANDROID_HOME,
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    localDefault,
  ].filter(Boolean);
  const adbName = process.platform === 'win32' ? 'adb.exe' : 'adb';
  const selected = [...new Set(candidates)].find(candidate =>
    existsSync(path.join(candidate, 'platform-tools', adbName)),
  );
  if (!selected) {
    throw new Error(
      `No Android SDK containing platform-tools/${adbName} was found in the configured candidates.`,
    );
  }
  process.env.ANDROID_HOME = selected;
  process.env.ANDROID_SDK_ROOT = selected;
  return selected;
}

const androidSdk = configureAndroidSdk();
const evidenceRunRoot = process.env.SEAMSCOPE_EVIDENCE_RUN_DIR
  ? path.resolve(process.env.SEAMSCOPE_EVIDENCE_RUN_DIR)
  : undefined;
const bumbleSessionLog = process.env.SEAMSCOPE_BUMBLE_SESSION_LOG
  ? path.resolve(process.env.SEAMSCOPE_BUMBLE_SESSION_LOG)
  : undefined;
const bumbleStartOffset =
  bumbleSessionLog && existsSync(bumbleSessionLog)
    ? statSync(bumbleSessionLog).size
    : undefined;
const appiumLog = evidenceRunRoot
  ? createWriteStream(path.join(evidenceRunRoot, 'appium.log'), {flags: 'a'})
  : undefined;
const logcatLog = evidenceRunRoot
  ? createWriteStream(path.join(evidenceRunRoot, 'logcat.log'), {flags: 'a'})
  : undefined;

const sdkMessage = `[SeamScope] Android SDK selected: ${androidSdk}\n`;
process.stdout.write(sdkMessage);
appiumLog?.write(sdkMessage);

function mirror(stream, terminal) {
  stream.on('data', chunk => {
    terminal.write(chunk);
    appiumLog?.write(chunk);
  });
}

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error(`Invalid SEAMSCOPE_APPIUM_PORT: ${port}`);
}

const appium = spawn(
  process.execPath,
  [
    appiumEntry,
    '--base-path',
    '/',
    '--port',
    String(port),
    '--log-level',
    appiumLogLevel,
  ],
  {cwd: automationRoot, env: process.env, stdio: ['ignore', 'pipe', 'pipe']},
);
mirror(appium.stdout, process.stdout);
mirror(appium.stderr, process.stderr);

let logcat;
if (evidenceRunRoot && process.env.SEAMSCOPE_DEVICE_UDID) {
  const clear = spawnSync(
    'adb',
    ['-s', process.env.SEAMSCOPE_DEVICE_UDID, 'logcat', '-c'],
    {cwd: automationRoot, env: process.env, encoding: 'utf8'},
  );
  if (clear.status !== 0) {
    throw new Error(
      `Could not clear logcat for ${process.env.SEAMSCOPE_DEVICE_UDID}: ${clear.stderr}`,
    );
  }
  logcat = spawn(
    'adb',
    ['-s', process.env.SEAMSCOPE_DEVICE_UDID, 'logcat', '-v', 'threadtime'],
    {cwd: automationRoot, env: process.env, stdio: ['ignore', 'pipe', 'pipe']},
  );
  logcat.stdout.pipe(logcatLog, {end: false});
  logcat.stderr.pipe(logcatLog, {end: false});
}

function appiumHasExited() {
  return appium.exitCode !== null || appium.signalCode !== null;
}

async function waitForAppium(
  timeoutMs = Number(process.env.SEAMSCOPE_APPIUM_READY_TIMEOUT_MS ?? 60_000),
) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1) {
    throw new Error(`Invalid SEAMSCOPE_APPIUM_READY_TIMEOUT_MS: ${timeoutMs}`);
  }
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (appiumHasExited()) {
      throw new Error(
        `Appium exited before readiness with code ${appium.exitCode} and signal ${appium.signalCode}.`,
      );
    }
    try {
      const response = await fetch(`http://127.0.0.1:${port}/status`);
      if (response.ok) {
        return;
      }
    } catch {
      // The listener is not ready yet.
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`Appium did not become ready on port ${port} within ${timeoutMs} ms.`);
}

async function stopAppium() {
  if (appiumHasExited()) {
    return;
  }
  appium.kill('SIGTERM');
  await Promise.race([
    once(appium, 'exit'),
    new Promise(resolve => setTimeout(resolve, 5_000)),
  ]);
  if (!appiumHasExited()) {
    appium.kill('SIGKILL');
    await once(appium, 'exit');
  }
}

async function stopLogcat() {
  if (!logcat || logcat.exitCode !== null || logcat.signalCode !== null) {
    return;
  }
  logcat.kill('SIGTERM');
  await Promise.race([
    once(logcat, 'exit'),
    new Promise(resolve => setTimeout(resolve, 2_000)),
  ]);
  if (logcat.exitCode === null && logcat.signalCode === null) {
    logcat.kill('SIGKILL');
  }
}

function captureBumbleSlice() {
  if (!evidenceRunRoot || !bumbleSessionLog) {
    return;
  }
  if (bumbleStartOffset === undefined || !existsSync(bumbleSessionLog)) {
    throw new Error('The declared Bumble session log was unavailable at run start.');
  }
  const contents = readFileSync(bumbleSessionLog);
  if (contents.length < bumbleStartOffset) {
    throw new Error('The Bumble session log shrank during the run.');
  }
  const endOffset = contents.length;
  appendFileSync(
    path.join(evidenceRunRoot, 'bumble.log'),
    contents.subarray(bumbleStartOffset, endOffset),
  );
  writeFileSync(
    path.join(evidenceRunRoot, 'capture.json'),
    `${JSON.stringify(
      {
        schemaVersion: '1',
        bumble: {
          sessionLogName: path.basename(bumbleSessionLog),
          startOffset: bumbleStartOffset,
          endOffset,
          capturedBytes: endOffset - bumbleStartOffset,
        },
      },
      null,
      2,
    )}\n`,
    {encoding: 'utf8', flag: 'wx'},
  );
}

let exitCode = 1;
try {
  await waitForAppium();
  const wdio = spawn(
    process.execPath,
    [wdioEntry, 'run', './wdio.conf.ts'],
    {
      cwd: automationRoot,
      env: {
        ...process.env,
        SEAMSCOPE_APPIUM_EXTERNAL: 'true',
        SEAMSCOPE_APPIUM_PORT: String(port),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  mirror(wdio.stdout, process.stdout);
  mirror(wdio.stderr, process.stderr);
  const [code] = await once(wdio, 'exit');
  exitCode = code ?? 1;
} finally {
  await stopLogcat();
  await stopAppium();
  captureBumbleSlice();
  appiumLog?.end();
  logcatLog?.end();
}

process.exitCode = exitCode;
