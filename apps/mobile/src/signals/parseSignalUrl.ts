import type {SignalObservation} from '../model/motionState';

export function parseSignalUrl(url: string): SignalObservation | null {
  try {
    const match = /^seamscope:\/\/signal(?:\?([^#]*))?(?:#.*)?$/i.exec(url);
    if (!match) {
      return null;
    }

    const parameters = parseQuery(match[1] ?? '');
    const speed = Number(parameters.get('speed'));
    const sequence = Number(parameters.get('sequence'));
    const timestampValue = parameters.get('timestamp');
    const observedAtMs = timestampValue ? Number(timestampValue) : Date.now();

    if (
      !Number.isFinite(speed) ||
      speed < 0 ||
      !Number.isInteger(sequence) ||
      sequence < 1 ||
      !Number.isFinite(observedAtMs)
    ) {
      return null;
    }

    return {speed, sequence, observedAtMs, source: 'injected'};
  } catch {
    return null;
  }
}

function parseQuery(query: string): Map<string, string> {
  const parameters = new Map<string, string>();
  for (const pair of query.split('&')) {
    if (!pair) {
      continue;
    }

    const separator = pair.indexOf('=');
    const rawKey = separator >= 0 ? pair.slice(0, separator) : pair;
    const rawValue = separator >= 0 ? pair.slice(separator + 1) : '';
    const key = decodeURIComponent(rawKey.replace(/\+/g, ' '));
    const value = decodeURIComponent(rawValue.replace(/\+/g, ' '));
    parameters.set(key, value);
  }
  return parameters;
}

