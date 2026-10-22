import {parseSignalUrl} from '../src/signals/parseSignalUrl';

test('parses a valid injected observation', () => {
  expect(
    parseSignalUrl('seamscope://signal?speed=8&sequence=3&timestamp=1200'),
  ).toEqual({
    speed: 8,
    sequence: 3,
    observedAtMs: 1200,
    source: 'injected',
  });
});

test('parses percent-encoded query values without a web URL implementation', () => {
  expect(
    parseSignalUrl(
      'seamscope://signal?speed=8.5&sequence=4&timestamp=1200&note=not%20used',
    ),
  ).toEqual({
    speed: 8.5,
    sequence: 4,
    observedAtMs: 1200,
    source: 'injected',
  });
});

test.each([
  'https://signal?speed=8&sequence=1',
  'seamscope://other?speed=8&sequence=1',
  'seamscope://signal?speed=-1&sequence=1',
  'seamscope://signal?speed=8&sequence=0',
  'seamscope://signal?speed=nope&sequence=1',
])('rejects an invalid signal URL: %s', url => {
  expect(parseSignalUrl(url)).toBeNull();
});
