import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateRun} from './evidence-store.mjs';

const scriptPath = fileURLToPath(import.meta.url);
const repositoryRoot = path.resolve(path.dirname(scriptPath), '..', '..');
const runId = 'c046-bumble-dropped-r10-retry01';
const runRoot = path.join(
  repositoryRoot,
  'artifacts',
  'evidence',
  'pilot-v1',
  'runs',
  runId,
);
const dataRoot = path.join(
  repositoryRoot,
  'automation',
  'evidence',
  'representatives',
);
const jsonPath = path.join(dataRoot, 'pilot-v1-sequence46-evidence-chain.json');
const csvPath = path.join(dataRoot, 'pilot-v1-sequence46-evidence-chain.csv');
const figurePath = path.join(
  repositoryRoot,
  'docs',
  'figures',
  'sequence46-evidence-chain.svg',
);

function parseArguments(argv) {
  if (argv.length === 0) return {check: false};
  if (argv.length === 1 && argv[0] === '--check') return {check: true};
  throw new Error(`Unknown arguments: ${argv.join(' ')}`);
}

function round(value) {
  return Number(value.toFixed(1));
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function csvValue(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

const selections = [
  {
    lane: 'Runner',
    label: 'Sequence 1 stimulus issued (8.0)',
    find: event => event.eventType === 'stimulus-issued' && event.sequence === 1,
  },
  {
    lane: 'Fixture / BLE',
    label: 'Sequence 1 deliberately dropped',
    find: event => event.eventType === 'drop' && event.sequence === 1,
  },
  {
    lane: 'Application',
    label: 'No transition during 2,000 ms window',
    find: event =>
      event.eventType === 'app-state' &&
      event.details?.state === 'stopped' &&
      event.details?.observationWindowMs === 2000,
  },
  {
    lane: 'Runner',
    label: 'Sequence 2 recovery stimulus issued (8.0)',
    find: event => event.eventType === 'stimulus-issued' && event.sequence === 2,
  },
  {
    lane: 'Fixture / BLE',
    label: 'Sequence 2 notification status 0',
    find: event =>
      event.eventType === 'notification-status' &&
      event.eventIndex === 14 &&
      event.details?.line === 'BLE NOTIFY STATUS 1 CODE 0',
  },
  {
    lane: 'Fixture / BLE',
    label: 'Physical BLE link disconnected',
    find: event => event.eventType === 'ble-disconnected',
  },
  {
    lane: 'Application',
    label: 'Sequence 2 observed: In Motion',
    find: event =>
      event.eventType === 'app-state' &&
      event.details?.state === 'moving' &&
      event.details?.sequence === 2,
  },
  {
    lane: 'Runner',
    label: 'Sequence 3 completion stimulus issued (0.0)',
    find: event => event.eventType === 'stimulus-issued' && event.sequence === 3,
  },
  {
    lane: 'Fixture / BLE',
    label: 'Sequence 3 notification status 5',
    find: event =>
      event.eventType === 'notification-status' &&
      event.details?.line === 'BLE NOTIFY STATUS 5 CODE 0',
  },
  {
    lane: 'Appium verdict',
    label: 'Completed interval absent after 2,000 ms',
    find: event =>
      event.eventType === 'assertion' &&
      event.details?.assertion === 'scenario' &&
      event.details?.passed === false,
  },
];

async function buildData() {
  const validation = await validateRun(runRoot);
  if (!validation.valid) {
    throw new Error(`${runId} is structurally invalid: ${validation.errors.join(' ')}`);
  }
  const [manifestText, verdictText, eventsText] = await Promise.all([
    readFile(path.join(runRoot, 'manifest.json'), 'utf8'),
    readFile(path.join(runRoot, 'verdict.json'), 'utf8'),
    readFile(path.join(runRoot, 'events.jsonl'), 'utf8'),
  ]);
  const manifest = JSON.parse(manifestText);
  const verdict = JSON.parse(verdictText);
  const events = eventsText
    .split(/\r?\n/)
    .filter(Boolean)
    .map(line => JSON.parse(line));

  if (
    manifest.route !== 'bumble-ble' ||
    manifest.caseId !== 'dropped-notification-recovery' ||
    verdict.validity !== 'valid' ||
    verdict.outcome !== 'fail' ||
    verdict.failureBoundary !== 'ble'
  ) {
    throw new Error(`${runId} no longer matches the declared representative result.`);
  }

  const anchor = events.find(selections[0].find);
  if (!Number.isFinite(anchor?.sourceMonotonicMs)) {
    throw new Error(`${runId} lacks the timed first-stimulus anchor.`);
  }

  const selectedEvents = selections.map(selection => {
    const event = events.find(selection.find);
    if (!event || !Number.isFinite(event.sourceMonotonicMs)) {
      throw new Error(`${runId} lacks timed evidence for: ${selection.label}.`);
    }
    return {
      eventIndex: event.eventIndex,
      millisecondsAfterFirstStimulus: round(
        event.sourceMonotonicMs - anchor.sourceMonotonicMs,
      ),
      lane: selection.lane,
      eventType: event.eventType,
      label: selection.label,
    };
  });

  return {
    schemaVersion: '1',
    studyId: 'pilot-v1',
    protocolVersion: 'pilot-v1-frozen',
    runId,
    route: manifest.route,
    caseId: manifest.caseId,
    validity: verdict.validity,
    outcome: verdict.outcome,
    failureBoundary: verdict.failureBoundary,
    manualIntervention: verdict.manualIntervention,
    timeOrigin: 'First outcome-bearing stimulus (sequence 1)',
    displayPrecision: 'milliseconds rounded to one decimal place',
    selectionPurpose:
      'Explain the sole valid confirmatory failure as a source-separated evidence chain, not estimate its frequency.',
    events: selectedEvents,
  };
}

function buildCsv(data) {
  const columns = [
    'runId',
    'validity',
    'outcome',
    'failureBoundary',
    'eventIndex',
    'millisecondsAfterFirstStimulus',
    'lane',
    'eventType',
    'label',
  ];
  return [
    columns.join(','),
    ...data.events.map(event => {
      const row = {...data, ...event};
      return columns.map(column => csvValue(row[column])).join(',');
    }),
  ].join('\n') + '\n';
}

function laneColor(lane) {
  return {
    Runner: '#665191',
    'Fixture / BLE': '#215a75',
    Application: '#18734b',
    'Appium verdict': '#9a3f32',
  }[lane];
}

function buildSvg(data) {
  const laneX = {
    Runner: 350,
    'Fixture / BLE': 660,
    Application: 970,
    'Appium verdict': 1240,
  };
  const startY = 170;
  const gap = 50;
  const endY = startY + (data.events.length - 1) * gap;
  const pieces = [];

  for (const [lane, x] of Object.entries(laneX)) {
    pieces.push(
      `<text x="${x}" y="126" text-anchor="middle" class="lane">${escapeXml(lane)}</text>`,
      `<line x1="${x}" y1="143" x2="${x}" y2="${endY + 18}" stroke="#c5ccd2" stroke-width="2"/>`,
    );
  }

  data.events.forEach((event, index) => {
    const y = startY + index * gap;
    const x = laneX[event.lane];
    const color = laneColor(event.lane);
    const boxX = event.lane === 'Appium verdict' ? x - 264 : x + 14;
    pieces.push(
      `<text x="120" y="${y + 5}" text-anchor="end" class="time">+${event.millisecondsAfterFirstStimulus.toFixed(1)} ms</text>`,
      `<line x1="140" y1="${y}" x2="1320" y2="${y}" stroke="#e6e9ec" stroke-width="1"/>`,
      `<circle cx="${x}" cy="${y}" r="7" fill="${color}"/>`,
      `<rect x="${boxX}" y="${y - 16}" width="250" height="32" rx="6" fill="#ffffff" stroke="${color}"/>`,
      `<text x="${boxX + 11}" y="${y + 5}" class="event">${escapeXml(event.label)}</text>`,
    );
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="760" viewBox="0 0 1400 760" role="img" aria-labelledby="title description">
  <title id="title">Evidence chain for the valid sequence 46 failure</title>
  <desc id="description">A source-separated event sequence shows a deliberate dropped notification, successful recovery delivery, physical BLE disconnection, unsuccessful completion notification, and a failed completed-interval assertion.</desc>
  <style>
    text { font-family: Arial, Helvetica, sans-serif; fill: #17212b; }
    .title { font-size: 25px; font-weight: 700; }
    .subtitle { font-size: 15px; fill: #4b5660; }
    .lane { font-size: 15px; font-weight: 700; }
    .time { font-size: 12px; font-variant-numeric: tabular-nums; fill: #4b5660; }
    .event { font-size: 11px; font-weight: 600; }
    .outcome { font-size: 15px; font-weight: 700; }
    .note { font-size: 12px; fill: #4b5660; }
  </style>
  <rect width="1400" height="760" fill="#f5f7f8"/>
  <text x="40" y="44" class="title">A valid run exposes the physical delivery boundary</text>
  <text x="40" y="70" class="subtitle">${escapeXml(data.runId)} · event position preserves order, not proportional time</text>
  <rect x="34" y="92" width="1332" height="590" rx="12" fill="#ffffff" stroke="#b7c0c8"/>
  ${pieces.join('\n  ')}
  <rect x="930" y="700" width="430" height="36" rx="7" fill="#9a3f32" opacity="0.12"/>
  <text x="1145" y="723" text-anchor="middle" class="outcome" fill="#8a3328">VALID / FAIL · BLE boundary</text>
  <text x="40" y="723" class="note">The valid failure is retained because the first stimulus was issued; the physical disconnection remains part of the observed outcome.</text>
</svg>
`;
}

async function compareOrWrite(filePath, contents, check) {
  if (!check) {
    await writeFile(filePath, contents, 'utf8');
    return;
  }
  const existing = await readFile(filePath, 'utf8');
  if (existing !== contents) {
    throw new Error(`${path.relative(repositoryRoot, filePath)} is not current.`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  const {check} = parseArguments(process.argv.slice(2));
  const data = await buildData();
  await compareOrWrite(jsonPath, `${JSON.stringify(data, null, 2)}\n`, check);
  await compareOrWrite(csvPath, buildCsv(data), check);
  await compareOrWrite(figurePath, buildSvg(data), check);
  process.stdout.write(
    `${check ? 'Verified' : 'Generated'} sequence 46 evidence-chain data and figure from ${runId}.\n`,
  );
}
