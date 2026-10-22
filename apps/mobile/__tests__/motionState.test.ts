import {
  initialMotionState,
  motionReducer,
  type SignalObservation,
} from '../src/model/motionState';

function observation(
  speed: number,
  sequence: number,
  observedAtMs: number,
): SignalObservation {
  return {speed, sequence, observedAtMs, source: 'injected'};
}

test('opens and closes a motion interval across the threshold', () => {
  const moving = motionReducer(initialMotionState, {
    type: 'observationReceived',
    observation: observation(8, 1, 1_000),
  });
  const stopped = motionReducer(moving, {
    type: 'observationReceived',
    observation: observation(0, 2, 4_250),
  });

  expect(moving.phase).toBe('moving');
  expect(stopped.phase).toBe('stopped');
  expect(stopped.records).toEqual([
    {
      startedAtMs: 1_000,
      endedAtMs: 4_250,
      startSequence: 1,
      endSequence: 2,
    },
  ]);
});

test('rejects stale observations so replay cannot change the verdict', () => {
  const current = motionReducer(initialMotionState, {
    type: 'observationReceived',
    observation: observation(8, 2, 2_000),
  });
  const stale = motionReducer(current, {
    type: 'observationReceived',
    observation: observation(0, 1, 3_000),
  });

  expect(stale).toBe(current);
  expect(stale.phase).toBe('moving');
});

test('treats the threshold itself as stopped', () => {
  const state = motionReducer(initialMotionState, {
    type: 'observationReceived',
    observation: observation(5, 1, 1_000),
  });

  expect(state.phase).toBe('stopped');
});

