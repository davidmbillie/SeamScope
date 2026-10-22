import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({children}: {children: React.ReactNode}) => children,
  useSafeAreaInsets: () => ({top: 0, right: 0, bottom: 0, left: 0}),
}));

test('renders the stopped screen with stable automation identifiers', async () => {
  let tree: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<App />);
  });

  expect(tree!.root.findByProps({testID: 'activity-log-screen'})).toBeTruthy();
  expect(tree!.root.findByProps({testID: 'motion-state'}).props.children).toBe(
    'Stopped',
  );
});
