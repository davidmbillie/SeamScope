export const MOTION_THRESHOLD = 5;

export type SignalSourceKind = 'injected' | 'ble' | 'manual-demo' | 'none';

export interface SignalObservation {
  speed: number;
  sequence: number;
  observedAtMs: number;
  source: Exclude<SignalSourceKind, 'none'>;
}

export interface MotionInterval {
  startedAtMs: number;
  endedAtMs: number;
  startSequence: number;
  endSequence: number;
}

export interface MotionState {
  phase: 'stopped' | 'moving';
  speed: number;
  source: SignalSourceKind;
  lastSequence: number;
  activeSinceMs: number | null;
  activeStartSequence: number | null;
  records: MotionInterval[];
}

export type MotionAction =
  | {type: 'observationReceived'; observation: SignalObservation}
  | {type: 'reset'};

export const initialMotionState: MotionState = {
  phase: 'stopped',
  speed: 0,
  source: 'none',
  lastSequence: 0,
  activeSinceMs: null,
  activeStartSequence: null,
  records: [],
};

export function motionReducer(
  state: MotionState,
  action: MotionAction,
): MotionState {
  if (action.type === 'reset') {
    return initialMotionState;
  }

  const observation = action.observation;
  if (
    !Number.isFinite(observation.speed) ||
    observation.speed < 0 ||
    !Number.isInteger(observation.sequence) ||
    observation.sequence <= state.lastSequence
  ) {
    return state;
  }

  const moving = observation.speed > MOTION_THRESHOLD;
  if (moving && state.phase === 'stopped') {
    return {
      ...state,
      phase: 'moving',
      speed: observation.speed,
      source: observation.source,
      lastSequence: observation.sequence,
      activeSinceMs: observation.observedAtMs,
      activeStartSequence: observation.sequence,
    };
  }

  if (!moving && state.phase === 'moving') {
    const interval: MotionInterval = {
      startedAtMs: state.activeSinceMs ?? observation.observedAtMs,
      endedAtMs: observation.observedAtMs,
      startSequence: state.activeStartSequence ?? state.lastSequence,
      endSequence: observation.sequence,
    };

    return {
      ...state,
      phase: 'stopped',
      speed: observation.speed,
      source: observation.source,
      lastSequence: observation.sequence,
      activeSinceMs: null,
      activeStartSequence: null,
      records: [...state.records, interval],
    };
  }

  return {
    ...state,
    speed: observation.speed,
    source: observation.source,
    lastSequence: observation.sequence,
  };
}

