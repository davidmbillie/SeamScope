import {
  appendFileSync,
  existsSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import {performance} from 'node:perf_hooks';

type EvidenceSource = 'fixture' | 'appium' | 'app' | 'bumble' | 'runner';
type EvidenceEventType =
  | 'run-started'
  | 'setup-ready'
  | 'stimulus-issued'
  | 'command-accepted'
  | 'tx'
  | 'drop'
  | 'malformed'
  | 'notification-status'
  | 'ble-connected'
  | 'ble-disconnected'
  | 'app-state'
  | 'assertion'
  | 'apparatus-reset'
  | 'manual-intervention'
  | 'run-finished';

interface RunManifest {
  runId: string;
}

/** Append-only evidence writer scoped to the active run directory. */
export class RunEvidence {
  private static instance: RunEvidence | undefined;

  static fromEnvironment(): RunEvidence | undefined {
    const runRoot = process.env.SEAMSCOPE_EVIDENCE_RUN_DIR;
    if (!runRoot) {
      return undefined;
    }
    if (!this.instance) {
      this.instance = new RunEvidence(runRoot);
    }
    return this.instance;
  }

  readonly runRoot: string;
  private readonly runId: string;
  private readonly startedAt = performance.now();

  private constructor(runRoot: string) {
    this.runRoot = path.resolve(runRoot);
    const manifestPath = path.join(this.runRoot, 'manifest.json');
    if (!existsSync(manifestPath)) {
      throw new Error(`Evidence manifest not found: ${manifestPath}`);
    }
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as RunManifest;
    this.runId = manifest.runId;
  }

  record(
    source: EvidenceSource,
    eventType: EvidenceEventType,
    details: Record<string, unknown> = {},
    sequence?: number,
  ): void {
    const eventsPath = this.artifactPath('events.jsonl');
    const existing = readFileSync(eventsPath, 'utf8');
    const eventIndex = existing.split(/\r?\n/).filter(Boolean).length;
    const event = {
      schemaVersion: '1',
      runId: this.runId,
      eventIndex,
      source,
      eventType,
      hostObservedAt: new Date().toISOString(),
      sourceMonotonicMs: performance.now() - this.startedAt,
      ...(sequence === undefined ? {} : {sequence}),
      details,
    };
    appendFileSync(eventsPath, `${JSON.stringify(event)}\n`, 'utf8');
  }

  appendLog(name: 'serial.log' | 'appium.log' | 'logcat.log', line: string): void {
    appendFileSync(this.artifactPath(name), `${line}\n`, 'utf8');
  }

  writeArtifact(name: 'failure-ui.xml', contents: string): void {
    writeFileSync(this.artifactPath(name), contents, {encoding: 'utf8', flag: 'wx'});
  }

  artifactPath(name: 'start.png' | 'final.png' | 'failure.png' | string): string {
    return path.join(this.runRoot, name);
  }
}
