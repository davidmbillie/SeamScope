import React, {useEffect, useReducer, useRef, useState} from 'react';
import {
  Linking,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import {
  initialMotionState,
  motionReducer,
  type SignalObservation,
} from './src/model/motionState';
import {parseSignalUrl} from './src/signals/parseSignalUrl';
import {
  BleSignalSource,
  type BleSourceStatus,
} from './src/signals/BleSignalSource';

function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" />
      <AppContent />
    </SafeAreaProvider>
  );
}

function AppContent() {
  const insets = useSafeAreaInsets();
  const [state, dispatch] = useReducer(motionReducer, initialMotionState);
  const [bleStatus, setBleStatus] = useState<BleSourceStatus>({
    phase: 'idle',
    detail: 'BLE route is idle',
  });
  const bleSource = useRef<BleSignalSource | null>(null);

  useEffect(() => {
    const acceptUrl = (url: string | null | undefined) => {
      if (!url) {
        return;
      }

      const observation = parseSignalUrl(url);
      if (observation) {
        dispatch({type: 'observationReceived', observation});
      }
    };

    Linking.getInitialURL().then(acceptUrl);
    const subscription = Linking.addEventListener('url', event => {
      acceptUrl(event.url);
    });

    return () => subscription.remove();
  }, []);

  useEffect(
    () => () => {
      void bleSource.current?.stop();
    },
    [],
  );

  const toggleBleRoute = async () => {
    if (
      bleStatus.phase === 'requesting-permission' ||
      bleStatus.phase === 'scanning' ||
      bleStatus.phase === 'connecting'
    ) {
      return;
    }

    if (bleStatus.phase === 'subscribed') {
      await bleSource.current?.stop();
      bleSource.current = null;
      return;
    }

    await bleSource.current?.stop();
    dispatch({type: 'reset'});
    const source = new BleSignalSource(setBleStatus);
    bleSource.current = source;
    try {
      await source.start(observation => {
        dispatch({type: 'observationReceived', observation});
      });
    } catch {
      // The adapter reports a user-facing error status before rejecting.
    }
  };

  const receiveDemoObservation = (speed: number) => {
    const observation: SignalObservation = {
      speed,
      sequence: state.lastSequence + 1,
      observedAtMs: Date.now(),
      source: 'manual-demo',
    };
    dispatch({type: 'observationReceived', observation});
  };

  return (
    <View
      style={[
        styles.screen,
        {paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20},
      ]}
      testID={state.phase === 'moving' ? 'motion-screen' : 'activity-log-screen'}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.brand}>
          SeamScope
        </Text>
        <View style={styles.routeBadge} testID="signal-source">
          <Text style={styles.routeBadgeText}>{state.source.toUpperCase()}</Text>
        </View>
      </View>

      {state.phase === 'moving' ? (
        <MotionPanel speed={state.speed} sequence={state.lastSequence} />
      ) : (
        <ActivityPanel records={state.records} />
      )}

      <View style={styles.evidenceCard}>
        <Text style={styles.evidenceTitle}>Observed claim</Text>
        <Text style={styles.evidenceText} testID="evidence-claim">
          The application maps the received semantic speed observation to the
          displayed motion state.
        </Text>
      </View>

      <View style={styles.bleCard} testID="ble-route-card">
        <View style={styles.bleCopy}>
          <Text style={styles.bleTitle}>Physical BLE route</Text>
          <Text
            accessibilityLabel="seamscope-ble-status"
            style={styles.bleStatus}
            testID="ble-status">
            {bleStatus.phase.toUpperCase()}
          </Text>
          <Text
            accessibilityLabel="seamscope-ble-detail"
            style={styles.bleDetail}
            testID="ble-status-detail">
            {bleStatus.detail}
          </Text>
        </View>
        <Pressable
          accessibilityLabel="seamscope-ble-toggle"
          accessibilityRole="button"
          disabled={
            bleStatus.phase === 'requesting-permission' ||
            bleStatus.phase === 'scanning' ||
            bleStatus.phase === 'connecting'
          }
          onPress={toggleBleRoute}
          style={styles.bleButton}
          testID="toggle-ble-route">
          <Text style={styles.bleButtonText}>
            {bleStatus.phase === 'subscribed' ? 'Disconnect' : 'Connect'}
          </Text>
        </Pressable>
      </View>

      {__DEV__ ? (
        <View style={styles.demoControls} testID="manual-demo-controls">
          <Text style={styles.demoTitle}>Local demonstration</Text>
          <View style={styles.buttonRow}>
            <DemoButton
              label="Send 0"
              testID="demo-speed-zero"
              onPress={() => receiveDemoObservation(0)}
            />
            <DemoButton
              label="Send 8"
              testID="demo-speed-eight"
              onPress={() => receiveDemoObservation(8)}
            />
          </View>
          <Pressable
            accessibilityLabel="seamscope-reset-state"
            accessibilityRole="button"
            onPress={() => dispatch({type: 'reset'})}
            style={styles.resetButton}
            testID="reset-fixture">
            <Text style={styles.resetButtonText}>Reset fixture</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function MotionPanel({speed, sequence}: {speed: number; sequence: number}) {
  return (
    <View
      style={[styles.stateCard, styles.movingCard]}>
      <Text style={styles.eyebrow}>CURRENT STATE</Text>
      <Text
        accessibilityLabel="seamscope-motion"
        accessibilityRole="header"
        style={styles.stateTitle}
        testID="motion-state">
        In Motion
      </Text>
      <Text
        accessibilityLabel="observed-speed"
        style={styles.speedValue}
        testID="speed-value">
        {speed.toFixed(1)}
      </Text>
      <Text style={styles.speedUnit}>signal units</Text>
      <Text
        accessibilityLabel="observed-sequence"
        style={styles.sequence}
        testID="signal-sequence">
        Observation #{sequence}
      </Text>
    </View>
  );
}

function ActivityPanel({records}: {records: typeof initialMotionState.records}) {
  const latest = records.at(-1);

  return (
    <View
      style={[styles.stateCard, styles.idleCard]}>
      <Text style={styles.eyebrow}>ACTIVITY LOG</Text>
      <Text
        accessibilityLabel="seamscope-activity-log"
        accessibilityRole="header"
        style={styles.stateTitle}
        testID="motion-state">
        Stopped
      </Text>
      <Text style={styles.idleMessage} testID="fixture-status">
        Ready for the next signal observation
      </Text>
      <View style={styles.divider} />
      <Text style={styles.recordLabel}>Completed intervals</Text>
      <Text
        accessibilityLabel="completed-interval-count"
        style={styles.recordCount}
        testID="interval-count">
        {records.length}
      </Text>
      <Text style={styles.latestRecord} testID="latest-interval">
        {latest
          ? `Latest: ${Math.max(0, latest.endedAtMs - latest.startedAtMs)} ms`
          : 'No completed interval'}
      </Text>
    </View>
  );
}

function DemoButton({
  label,
  onPress,
  testID,
}: {
  label: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={styles.demoButton}
      testID={testID}>
      <Text style={styles.demoButtonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#10231f',
    flex: 1,
    paddingHorizontal: 22,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 22,
  },
  brand: {
    color: '#f2f1e8',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  routeBadge: {
    backgroundColor: '#c9f2df',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  routeBadgeText: {
    color: '#173b31',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  stateCard: {
    borderRadius: 24,
    minHeight: 300,
    padding: 24,
  },
  idleCard: {
    backgroundColor: '#eceadf',
  },
  movingCard: {
    backgroundColor: '#ffcb69',
  },
  eyebrow: {
    color: '#53635c',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
  stateTitle: {
    color: '#142c26',
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -1.5,
    marginTop: 8,
  },
  speedValue: {
    color: '#142c26',
    fontSize: 92,
    fontVariant: ['tabular-nums'],
    fontWeight: '900',
    letterSpacing: -5,
    lineHeight: 104,
    marginTop: 24,
  },
  speedUnit: {
    color: '#53635c',
    fontSize: 15,
    fontWeight: '700',
  },
  sequence: {
    color: '#53635c',
    fontSize: 13,
    marginTop: 22,
  },
  idleMessage: {
    color: '#53635c',
    fontSize: 16,
    lineHeight: 23,
    marginTop: 18,
  },
  divider: {
    backgroundColor: '#ced2c9',
    height: 1,
    marginVertical: 24,
  },
  recordLabel: {
    color: '#53635c',
    fontSize: 13,
    fontWeight: '700',
  },
  recordCount: {
    color: '#142c26',
    fontSize: 48,
    fontWeight: '900',
    marginTop: 2,
  },
  latestRecord: {
    color: '#53635c',
    fontSize: 13,
  },
  evidenceCard: {
    borderColor: '#31594e',
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 16,
    padding: 16,
  },
  evidenceTitle: {
    color: '#c9f2df',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  evidenceText: {
    color: '#d8e1dc',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 7,
  },
  bleCard: {
    alignItems: 'center',
    borderColor: '#31594e',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    marginTop: 12,
    padding: 14,
  },
  bleCopy: {
    flex: 1,
  },
  bleTitle: {
    color: '#d8e1dc',
    fontSize: 13,
    fontWeight: '800',
  },
  bleStatus: {
    color: '#c9f2df',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginTop: 4,
  },
  bleDetail: {
    color: '#99b7ad',
    fontSize: 11,
    marginTop: 2,
  },
  bleButton: {
    alignItems: 'center',
    backgroundColor: '#c9f2df',
    borderRadius: 12,
    minWidth: 92,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  bleButtonText: {
    color: '#173b31',
    fontSize: 13,
    fontWeight: '900',
  },
  demoControls: {
    marginTop: 16,
  },
  demoTitle: {
    color: '#d8e1dc',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  demoButton: {
    alignItems: 'center',
    backgroundColor: '#31594e',
    borderRadius: 12,
    flex: 1,
    paddingVertical: 12,
  },
  demoButtonText: {
    color: '#f2f1e8',
    fontSize: 14,
    fontWeight: '800',
  },
  resetButton: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  resetButtonText: {
    color: '#99b7ad',
    fontSize: 13,
    fontWeight: '700',
  },
});

export default App;
