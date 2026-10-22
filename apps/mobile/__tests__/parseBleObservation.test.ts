import {parseBleObservation} from '../src/signals/parseBleObservation';

test('parses a valid peripheral observation using the Android receive clock', () => {
  expect(
    parseBleObservation('speed=8.0;sequence=7;sentAtMs=1234', 9_000),
  ).toEqual({
    speed: 8,
    sequence: 7,
    observedAtMs: 9_000,
    source: 'ble',
  });
});

test.each([
  'speed=not-a-number;sequence=7;sentAtMs=1234',
  'speed=8.0;sequence=0;sentAtMs=1234',
  'speed=8.0;sequence=7',
  'speed=8.0;sequence=7;sentAtMs=-1',
  'not-a-field',
])('rejects malformed peripheral payload %s', payload => {
  expect(parseBleObservation(payload, 9_000)).toBeNull();
});
