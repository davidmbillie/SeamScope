import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateRun} from './evidence-store.mjs';

const scriptPath = fileURLToPath(import.meta.url);
const repositoryRoot = path.resolve(path.dirname(scriptPath), '..', '..');
const runsRoot = path.join(
  repositoryRoot,
  'artifacts',
  'evidence',
  'pilot-v1',
  'runs',
);
const dataPath = path.join(
  repositoryRoot,
  'automation',
  'evidence',
  'representatives',
  'pilot-v1-lifecycle-timelines.json',
);
const csvPath = path.join(
  repositoryRoot,
  'automation',
  'evidence',
  'representatives',
  'pilot-v1-lifecycle-timelines.csv',
);
const figurePath = path.join(
  repositoryRoot,
  'docs',
  'figures',
  'representative-lifecycles.svg',
);

const representatives = [
  {
    panel: 'A',
    role: 'successful-hybrid-lifecycle',
    runId: 'c002-bumble-healthy-r01',
    expectedVerdict: {validity: 'valid', outcome: 'pass', failureBoundary: 'none'},
    selections: [
      {
        label: 'Fixture reset accepted',
        sourceLabel: 'Fixture',
        find: event =>
          event.eventType === 'command-accepted' && event.details?.line === 'OK RESET',
      },
      {
        label: 'Physical BLE link connected',
        sourceLabel: 'Fixture',
        find: event => event.eventType === 'ble-connected',
      },
      {
        label: 'GATT subscription ready',
        sourceLabel: 'Runner',
        find: event => event.eventType === 'setup-ready',
      },
      {
        label: 'Motion stimulus issued (8.0)',
        sourceLabel: 'Runner',
        crossesStimulusBoundary: true,
        find: event =>
          event.eventType === 'stimulus-issued' && event.details?.speed === 8,
      },
      {
        label: 'In Motion state observable',
        sourceLabel: 'Application',
        find: event =>
          event.eventType === 'app-state' && event.details?.state === 'moving',
      },
      {
        label: 'Stop stimulus issued (0.0)',
        sourceLabel: 'Runner',
        find: event =>
          event.eventType === 'stimulus-issued' && event.details?.speed === 0,
      },
      {
        label: 'Completed interval observable',
        sourceLabel: 'Application',
        find: event =>
          event.eventType === 'app-state' &&
          event.details?.state === 'stopped' &&
          event.details?.completedIntervals === 1,
      },
      {
        label: 'BLE disconnected',
        sourceLabel: 'Fixture',
        find: event => event.eventType === 'ble-disconnected',
      },
    ],
  },
  {
    panel: 'B',
    role: 'setup-invalid-hybrid-lifecycle',
    runId: 'c014-retry02-bumble-healthy-r03',
    expectedVerdict: {
      validity: 'invalid',
      outcome: 'not-evaluated',
      failureBoundary: 'ble',
    },
    selections: [
      {
        label: 'Fixture reset accepted',
        sourceLabel: 'Fixture',
        find: event =>
          event.eventType === 'command-accepted' && event.details?.line === 'OK RESET',
      },
      {
        label: 'Physical BLE link connected',
        sourceLabel: 'Fixture',
        find: event => event.eventType === 'ble-connected',
      },
      {
        label: 'Readiness failed: still CONNECTING',
        sourceLabel: 'Appium',
        find: event =>
          event.eventType === 'assertion' &&
          event.details?.assertion === 'setup-readiness' &&
          event.details?.passed === false,
      },
      {
        label: 'BLE disconnected during teardown',
        sourceLabel: 'Fixture',
        find: event => event.eventType === 'ble-disconnected',
      },
    ],
  },
];

function parseArguments(argv) {
  if (argv.length === 0) return {check: false};
  if (argv.length === 1 && argv[0] === '--check') return {check: true};
  throw new Error(`Unknown arguments: ${argv.join(' ')}`);
}

function round(value) {
  return Number(value.toFixed(3));
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

async function loadRepresentative(definition) {
  const runRoot = path.join(runsRoot, definition.runId);
  const validation = await validateRun(runRoot);
  if (!validation.valid) {
    throw new Error(`${definition.runId} is structurally invalid: ${validation.errors.join(' ')}`);
  }
  const [manifest, verdict, eventContents] = await Promise.all([
    readFile(path.join(runRoot, 'manifest.json'), 'utf8'),
    readFile(path.join(runRoot, 'verdict.json'), 'utf8'),
    readFile(path.join(runRoot, 'events.jsonl'), 'utf8'),
  ]);
  const parsedManifest = JSON.parse(manifest);
  const parsedVerdict = JSON.parse(verdict);
  const events = eventContents
    .split(/\r?\n/)
    .filter(Boolean)
    .map(line => JSON.parse(line));
  if (
    parsedManifest.route !== 'bumble-ble' ||
    parsedManifest.caseId !== 'healthy-threshold'
  ) {
    throw new Error(`${definition.runId} no longer matches the declared comparison route/case.`);
  }
  for (const [field, expected] of Object.entries(definition.expectedVerdict)) {
    if (parsedVerdict[field] !== expected) {
      throw new Error(`${definition.runId} verdict ${field} differs from ${expected}.`);
    }
  }
  const reset = events.find(definition.selections[0].find);
  if (!Number.isFinite(reset?.sourceMonotonicMs)) {
    throw new Error(`${definition.runId} has no timed fixture-reset anchor.`);
  }
  const selected = definition.selections.map(selection => {
    const event = events.find(selection.find);
    if (!event || !Number.isFinite(event.sourceMonotonicMs)) {
      throw new Error(`${definition.runId} lacks timed evidence for: ${selection.label}.`);
    }
    return {
      order: event.eventIndex,
      secondsAfterReset: round(
        (event.sourceMonotonicMs - reset.sourceMonotonicMs) / 1000,
      ),
      source: selection.sourceLabel,
      eventType: event.eventType,
      label: selection.label,
      crossesStimulusBoundary: selection.crossesStimulusBoundary === true,
    };
  });
  const stimulusIssued = events.some(event => event.eventType === 'stimulus-issued');
  return {
    panel: definition.panel,
    role: definition.role,
    runId: definition.runId,
    route: parsedManifest.route,
    caseId: parsedManifest.caseId,
    validity: parsedVerdict.validity,
    outcome: parsedVerdict.outcome,
    failureBoundary: parsedVerdict.failureBoundary,
    stimulusBoundaryCrossed: stimulusIssued,
    manualIntervention: parsedVerdict.manualIntervention,
    events: selected,
  };
}

export async function buildTimelineData() {
  const panels = [];
  for (const definition of representatives) {
    panels.push(await loadRepresentative(definition));
  }
  return {
    schemaVersion: '1',
    studyId: 'pilot-v1',
    protocolVersion: 'pilot-v1-frozen',
    figurePurpose:
      'Contrast a complete and a setup-invalid lifecycle while holding the Bumble-backed route and healthy case constant.',
    timeOrigin: 'Fixture response OK RESET within each run',
    displayPrecision: 'seconds rounded to three decimal places',
    selectionPolicy: [
      'Use confirmatory records rather than calibration or post-stop diagnostics.',
      'Hold route and behavioral case constant.',
      'Require complete supporting route evidence.',
      'Use the earliest ordinary successful hybrid run.',
      'Use the invalid attempt that activated the predeclared stop rule.',
      'Treat the pair as a mechanism illustration, not a frequency estimate.',
    ],
    panels,
  };
}

function buildCsv(data) {
  const columns = [
    'panel',
    'runId',
    'role',
    'validity',
    'outcome',
    'failureBoundary',
    'stimulusBoundaryCrossed',
    'secondsAfterReset',
    'source',
    'eventType',
    'label',
  ];
  const rows = data.panels.flatMap(panel =>
    panel.events.map(event => ({...panel, ...event})),
  );
  return [
    columns.join(','),
    ...rows.map(row => columns.map(column => csvValue(row[column])).join(',')),
  ].join('\n') + '\n';
}

function sourceColor(source) {
  return {
    Fixture: '#215a75',
    Runner: '#665191',
    Application: '#18734b',
    Appium: '#9a4d00',
  }[source];
}

function panelSvg(panel, x, title, subtitle) {
  const lineX = x + 86;
  const startY = 190;
  const gap = panel.events.length > 5 ? 62 : 82;
  const lastY = startY + (panel.events.length - 1) * gap;
  const pieces = [
    `<rect x="${x}" y="105" width="630" height="585" rx="12" fill="#ffffff" stroke="#b7c0c8"/>`,
    `<text x="${x + 26}" y="143" class="panel-title">${escapeXml(panel.panel)}. ${escapeXml(title)}</text>`,
    `<text x="${x + 26}" y="168" class="subtitle">${escapeXml(subtitle)}</text>`,
    `<line x1="${lineX}" y1="${startY}" x2="${lineX}" y2="${lastY}" stroke="#67727c" stroke-width="2"/>`,
  ];
  panel.events.forEach((event, index) => {
    const y = startY + index * gap;
    const color = sourceColor(event.source);
    pieces.push(
      `<circle cx="${lineX}" cy="${y}" r="7" fill="${color}"/>`,
      `<text x="${lineX - 18}" y="${y + 5}" text-anchor="end" class="time">${event.secondsAfterReset.toFixed(3)} s</text>`,
      `<text x="${lineX + 20}" y="${y - 3}" class="event">${escapeXml(event.label)}</text>`,
      `<text x="${lineX + 20}" y="${y + 17}" class="source" fill="${color}">${escapeXml(event.source)}</text>`,
    );
    if (event.crossesStimulusBoundary) {
      pieces.push(
        `<line x1="${x + 18}" y1="${y - 29}" x2="${x + 612}" y2="${y - 29}" stroke="#665191" stroke-width="2" stroke-dasharray="7 5"/>`,
        `<text x="${x + 602}" y="${y - 36}" text-anchor="end" class="boundary">stimulus boundary crossed</text>`,
      );
    }
  });
  if (!panel.stimulusBoundaryCrossed) {
    const y = startY + 3 * gap - 38;
    pieces.push(
      `<line x1="${x + 18}" y1="${y}" x2="${x + 612}" y2="${y}" stroke="#9a4d00" stroke-width="2" stroke-dasharray="7 5"/>`,
      `<text x="${x + 602}" y="${y - 8}" text-anchor="end" class="boundary" fill="#7d3e00">stimulus boundary not crossed</text>`,
    );
  }
  const outcomeColor = panel.validity === 'valid' ? '#18734b' : '#9a4d00';
  const outcome =
    panel.validity === 'valid'
      ? 'Valid pass: application behavior evaluated'
      : 'Invalid / not evaluated: setup evidence retained';
  pieces.push(
    `<rect x="${x + 25}" y="642" width="580" height="31" rx="6" fill="${outcomeColor}" opacity="0.10"/>`,
    `<text x="${x + 315}" y="663" text-anchor="middle" class="outcome" fill="${outcomeColor}">${escapeXml(outcome)}</text>`,
  );
  return pieces.join('\n');
}

export function buildSvg(data) {
  const success = data.panels[0];
  const invalid = data.panels[1];
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="760" viewBox="0 0 1400 760" role="img" aria-labelledby="title description">
  <title id="title">Two Bumble-backed SeamScope lifecycles</title>
  <desc id="description">A successful hybrid lifecycle crosses the stimulus boundary and produces observable motion and a completed interval. A setup-invalid lifecycle connects by Bluetooth but remains connecting through the readiness bound and never receives a stimulus.</desc>
  <style>
    text { font-family: Arial, Helvetica, sans-serif; fill: #17212b; }
    .title { font-size: 25px; font-weight: 700; }
    .subtitle-main { font-size: 15px; fill: #4b5660; }
    .panel-title { font-size: 19px; font-weight: 700; }
    .subtitle { font-size: 13px; fill: #4b5660; }
    .time { font-size: 12px; font-variant-numeric: tabular-nums; fill: #4b5660; }
    .event { font-size: 14px; font-weight: 600; }
    .source { font-size: 11px; font-weight: 700; text-transform: uppercase; }
    .boundary { font-size: 11px; font-weight: 700; fill: #514174; }
    .outcome { font-size: 13px; font-weight: 700; }
    .note { font-size: 12px; fill: #4b5660; }
  </style>
  <rect width="1400" height="760" fill="#f5f7f8"/>
  <text x="40" y="45" class="title">Same hybrid route, different lifecycle reach</text>
  <text x="40" y="72" class="subtitle-main">Times are seconds after the fixture reset; panels illustrate mechanism, not route failure frequency.</text>
  ${panelSvg(success, 40, 'Complete lifecycle', success.runId)}
  ${panelSvg(invalid, 730, 'Setup-invalid lifecycle', invalid.runId)}
  <text x="40" y="728" class="note">The physical link can exist before GATT subscription is ready. Only a run crossing the declared stimulus boundary receives a behavioral verdict.</text>
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
  const data = await buildTimelineData();
  await compareOrWrite(dataPath, `${JSON.stringify(data, null, 2)}\n`, check);
  await compareOrWrite(csvPath, buildCsv(data), check);
  await compareOrWrite(figurePath, buildSvg(data), check);
  process.stdout.write(
    `${check ? 'Verified' : 'Generated'} paired lifecycle data and figure from ` +
      `${data.panels.map(panel => panel.runId).join(' and ')}.\n`,
  );
}
