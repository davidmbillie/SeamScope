import {spawn, type ChildProcessWithoutNullStreams} from 'node:child_process';
import {createConnection, type Socket} from 'node:net';
import {createInterface} from 'node:readline';
import {fileURLToPath} from 'node:url';
import {RunEvidence} from '../evidence/RunEvidence.js';
import type {FaultProfile, SignalRig} from './SignalRig.js';

interface PendingLine {
  predicate: (line: string) => boolean;
  resolve: (line: string) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

export class SerialBleSignalRig implements SignalRig {
  readonly routeName = 'serial-ble' as const;
  private process: ChildProcessWithoutNullStreams | null = null;
  private socket: Socket | null = null;
  private pending: PendingLine[] = [];
  private expectedSequence = 0;
  private bleConnected = false;
  private readonly evidence = RunEvidence.fromEnvironment();

  constructor(private readonly path?: string) {}

  async start(): Promise<void> {
    if (this.process || this.socket) {
      return;
    }

    const daemonPort = process.env.SEAMSCOPE_SERIAL_DAEMON_PORT;
    if (daemonPort) {
      await this.connectToDaemon(Number(daemonPort));
      return;
    }
    if (!this.path) {
      throw new Error(
        'SEAMSCOPE_SERIAL_PORT is required when the persistent serial daemon is not configured.',
      );
    }

    const script = fileURLToPath(
      new URL('../../scripts/serial-bridge.ps1', import.meta.url),
    );
    const bridge = spawn(
      'powershell.exe',
      [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        script,
        '-Port',
        this.path,
      ],
      {stdio: ['pipe', 'pipe', 'pipe']},
    );
    this.process = bridge;

    createInterface({input: bridge.stdout}).on('line', line =>
      this.acceptLine(line.trim()),
    );
    createInterface({input: bridge.stderr}).on('line', line =>
      process.stderr.write(`[serial-bridge] ${line}\n`),
    );
    bridge.once('exit', code => {
      if (this.process === bridge) {
        this.process = null;
      }
      if (code !== 0) {
        this.rejectPending(new Error(`Serial bridge exited with code ${code}.`));
      }
    });

    await this.waitForLine(line => line === 'BRIDGE READY', 8_000);
  }

  async reset(): Promise<void> {
    await this.command('RESET', line => line === 'OK RESET');
    this.expectedSequence = 0;
  }

  async setSpeed(speed: number): Promise<void> {
    if (!Number.isFinite(speed) || speed < 0) {
      throw new Error(`Invalid speed: ${speed}`);
    }
    this.expectedSequence += 1;
    this.evidence?.record(
      'runner',
      'stimulus-issued',
      {route: this.routeName, speed},
      this.expectedSequence,
    );
    await this.command(`SPEED ${speed}`, line => line.startsWith('OK SPEED '));
  }

  async armFault(profile: FaultProfile): Promise<void> {
    await this.command(
      `FAULT ${profile}`,
      line => line === `OK FAULT ${profile}`,
    );
  }

  async close(): Promise<void> {
    let disconnectError: Error | undefined;
    if (this.bleConnected) {
      try {
        await this.waitForLine(
          line => line === 'BLE DISCONNECTED',
          Number(process.env.SEAMSCOPE_DISCONNECT_TIMEOUT_MS ?? 2_000),
        );
      } catch {
        disconnectError = new Error(
          'The application returned to IDLE, but the fixture did not report BLE DISCONNECTED before teardown.',
        );
      }
    }
    this.rejectPending(new Error('Serial rig closed before response arrived.'));
    const socket = this.socket;
    this.socket = null;
    if (socket) {
      socket.write('__CLOSE__\n');
      socket.end();
      if (disconnectError) {
        throw disconnectError;
      }
      return;
    }

    const bridge = this.process;
    this.process = null;
    if (!bridge) {
      return;
    }

    bridge.stdin.write('__CLOSE__\n');
    await new Promise<void>(resolve => {
      const timeout = setTimeout(() => {
        bridge.kill();
        resolve();
      }, 3_000);
      bridge.once('exit', () => {
        clearTimeout(timeout);
        resolve();
      });
    });
    if (disconnectError) {
      throw disconnectError;
    }
  }

  private async command(
    command: string,
    predicate: (line: string) => boolean,
  ): Promise<string> {
    const writer = this.socket ?? this.process?.stdin;
    if (!writer) {
      throw new Error('Serial bridge is not running.');
    }

    const response = this.waitForLine(predicate);
    writer.write(`${command}\n`);
    return response;
  }

  private async connectToDaemon(port: number): Promise<void> {
    if (!Number.isInteger(port) || port < 1 || port > 65_535) {
      throw new Error(`Invalid SEAMSCOPE_SERIAL_DAEMON_PORT: ${port}`);
    }

    const socket = createConnection({host: '127.0.0.1', port});
    this.socket = socket;
    createInterface({input: socket}).on('line', line =>
      this.acceptLine(line.trim()),
    );
    socket.once('close', () => {
      if (this.socket === socket) {
        this.socket = null;
        this.rejectPending(new Error('Persistent serial daemon disconnected.'));
      }
    });
    socket.on('error', error => {
      if (this.socket === socket) {
        this.rejectPending(error);
      }
    });

    const ready = this.waitForLine(line => line === 'BRIDGE READY', 8_000);
    try {
      const connected = new Promise<void>((resolve, reject) => {
        socket.once('connect', resolve);
        socket.once('error', reject);
      });
      await Promise.all([connected, ready]);
    } catch (error) {
      this.socket = null;
      socket.destroy();
      this.rejectPending(
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  private waitForLine(
    predicate: (line: string) => boolean,
    timeoutMs = 5_000,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const pending: PendingLine = {
        predicate,
        resolve,
        reject,
        timeout: setTimeout(() => {
          this.pending = this.pending.filter(candidate => candidate !== pending);
          reject(new Error('Timed out waiting for the peripheral response.'));
        }, timeoutMs),
      };
      this.pending.push(pending);
    });
  }

  private acceptLine(line: string): void {
    process.stdout.write(`[peripheral] ${line}\n`);
    this.evidence?.appendLog('serial.log', line);
    this.recordPeripheralEvent(line);
    const match = this.pending.find(candidate => candidate.predicate(line));
    if (!match) {
      return;
    }
    clearTimeout(match.timeout);
    this.pending = this.pending.filter(candidate => candidate !== match);
    match.resolve(line);
  }

  private recordPeripheralEvent(line: string): void {
    if (line.startsWith('OK ')) {
      this.evidence?.record('fixture', 'command-accepted', {line});
      return;
    }
    const sequenced = /^(TX|DROP|MALFORM) (\d+)\b/.exec(line);
    if (sequenced) {
      const eventType = sequenced[1].toLowerCase() as
        | 'tx'
        | 'drop'
        | 'malformed';
      this.evidence?.record(
        'fixture',
        eventType,
        {line},
        Number(sequenced[2]),
      );
      return;
    }
    if (line.startsWith('BLE NOTIFY STATUS ')) {
      this.evidence?.record('fixture', 'notification-status', {line});
      return;
    }
    if (line === 'BLE CONNECTED') {
      this.bleConnected = true;
      this.evidence?.record('fixture', 'ble-connected', {line});
      return;
    }
    if (line === 'BLE DISCONNECTED') {
      this.bleConnected = false;
      this.evidence?.record('fixture', 'ble-disconnected', {line});
    }
  }

  private rejectPending(error: Error): void {
    for (const pending of this.pending.splice(0)) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
  }
}
