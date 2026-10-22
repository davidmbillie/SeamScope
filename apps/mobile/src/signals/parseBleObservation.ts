import type {SignalObservation} from '../model/motionState';

/** Parse the deliberately small, fictional SeamScope BLE payload grammar. */
export function parseBleObservation(
  payload: string,
  observedAtMs = Date.now(),
): SignalObservation | null {
  const fields = new Map<string, string>();
  for (const field of payload.split(';')) {
    const separator = field.indexOf('=');
    if (separator <= 0) {
      return null;
    }

    fields.set(field.slice(0, separator), field.slice(separator + 1));
  }

  const speedText = fields.get('speed');
  const sequenceText = fields.get('sequence');
  const sentAtText = fields.get('sentAtMs');
  if (speedText == null || sequenceText == null || sentAtText == null) {
    return null;
  }

  const speed = Number(speedText);
  const sequence = Number(sequenceText);
  const sentAtMs = Number(sentAtText);
  if (
    !Number.isFinite(speed) ||
    speed < 0 ||
    !Number.isInteger(sequence) ||
    sequence < 1 ||
    !Number.isInteger(sentAtMs) ||
    sentAtMs < 0 ||
    !Number.isFinite(observedAtMs)
  ) {
    return null;
  }

  // sentAtMs is Arduino uptime, not wall-clock time. Validate it above, but use
  // the Android receive clock for intervals so unlike clock domains are not
  // accidentally subtracted from each other.
  return {speed, sequence, observedAtMs, source: 'ble'};
}
