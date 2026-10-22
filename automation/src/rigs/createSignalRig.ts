import {InjectedSignalRig} from './InjectedSignalRig.js';
import {SerialBleSignalRig} from './SerialBleSignalRig.js';
import type {SignalRig} from './SignalRig.js';

export function createSignalRig(): SignalRig {
  const route = process.env.SEAMSCOPE_RIG ?? 'injected';
  if (route === 'injected') {
    return new InjectedSignalRig();
  }
  if (route === 'serial') {
    const port = process.env.SEAMSCOPE_SERIAL_PORT;
    const daemonPort = process.env.SEAMSCOPE_SERIAL_DAEMON_PORT;
    if (!port && !daemonPort) {
      throw new Error('SEAMSCOPE_SERIAL_PORT is required for the serial route.');
    }
    return new SerialBleSignalRig(port);
  }
  throw new Error(`Unknown SEAMSCOPE_RIG route: ${route}`);
}

