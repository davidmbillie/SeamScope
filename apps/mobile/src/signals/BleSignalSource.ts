import {
  PermissionsAndroid,
  Platform,
  type EventSubscription,
} from 'react-native';
import type {
  BleManagerDidUpdateValueForCharacteristicEvent,
  Peripheral,
} from 'react-native-ble-manager';
import {parseBleObservation} from './parseBleObservation';
import type {SignalObserver, SignalSource} from './SignalSource';

export const SEAMSCOPE_DEVICE_NAME = 'SeamScope Peripheral';
export const SEAMSCOPE_SERVICE_UUID = '7f5a1000-5e4d-4d58-9f6b-8a8e70d86a01';
export const SEAMSCOPE_OBSERVATION_UUID =
  '7f5a1001-5e4d-4d58-9f6b-8a8e70d86a01';

export type BleSourcePhase =
  | 'idle'
  | 'requesting-permission'
  | 'scanning'
  | 'connecting'
  | 'subscribed'
  | 'disconnected'
  | 'error';

export interface BleSourceStatus {
  phase: BleSourcePhase;
  detail: string;
}

type StatusObserver = (status: BleSourceStatus) => void;
type Manager = typeof import('react-native-ble-manager').default;

/** Android BLE-central implementation of the application observation boundary. */
export class BleSignalSource implements SignalSource {
  readonly name = 'ble';

  private manager: Manager | null = null;
  private peripheralId: string | null = null;
  private subscriptions: EventSubscription[] = [];
  private running = false;
  private stopping = false;

  constructor(private readonly reportStatus: StatusObserver = () => {}) {}

  async start(observer: SignalObserver): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;
    this.stopping = false;
    try {
      this.status('requesting-permission', 'Requesting nearby-device access');
      await requestBlePermissions();

      const {default: manager} = await import('react-native-ble-manager');
      this.manager = manager;
      await manager.start({showAlert: false});

      const adapterState = await manager.checkState();
      if (adapterState !== 'on') {
        throw new Error(`Bluetooth adapter is ${adapterState}`);
      }

      this.subscriptions.push(
        manager.onDidUpdateValueForCharacteristic(event => {
          this.acceptNotification(event, observer);
        }),
        manager.onDisconnectPeripheral(event => {
          if (event.peripheral === this.peripheralId && !this.stopping) {
            this.peripheralId = null;
            this.running = false;
            this.status('disconnected', 'Peripheral disconnected');
          }
        }),
      );

      this.status('scanning', `Scanning for ${SEAMSCOPE_DEVICE_NAME}`);
      const peripheral = await findPeripheral(manager);
      this.peripheralId = peripheral.id;

      this.status('connecting', `Connecting to ${peripheral.name ?? peripheral.id}`);
      await manager.connect(peripheral.id);
      await manager.retrieveServices(peripheral.id);
      const negotiatedMtu =
        Platform.OS === 'android'
          ? await manager.requestMTU(peripheral.id, 128)
          : null;
      await manager.startNotification(
        peripheral.id,
        SEAMSCOPE_SERVICE_UUID,
        SEAMSCOPE_OBSERVATION_UUID,
      );
      this.status(
        'subscribed',
        negotiatedMtu
          ? `Subscribed to ${SEAMSCOPE_DEVICE_NAME} (MTU ${negotiatedMtu})`
          : `Subscribed to ${SEAMSCOPE_DEVICE_NAME}`,
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      await this.releaseResources();
      this.status('error', detail);
      throw error;
    }
  }

  async stop(): Promise<void> {
    this.stopping = true;
    await this.releaseResources();
    this.stopping = false;
    this.status('idle', 'BLE route is idle');
  }

  private acceptNotification(
    event: BleManagerDidUpdateValueForCharacteristicEvent,
    observer: SignalObserver,
  ) {
    if (
      event.peripheral !== this.peripheralId ||
      event.service.toLowerCase() !== SEAMSCOPE_SERVICE_UUID ||
      event.characteristic.toLowerCase() !== SEAMSCOPE_OBSERVATION_UUID
    ) {
      return;
    }

    this.acceptBytes(event.value, observer);
  }

  private acceptBytes(value: number[], observer: SignalObserver) {
    const payload = String.fromCharCode(...value);
    const observation = parseBleObservation(payload);
    if (observation) {
      observer(observation);
    } else {
      this.status('subscribed', 'Rejected malformed observation');
    }
  }

  private async releaseResources() {
    const manager = this.manager;
    const peripheralId = this.peripheralId;
    this.peripheralId = null;
    this.running = false;

    for (const subscription of this.subscriptions.splice(0)) {
      subscription.remove();
    }

    if (!manager) {
      return;
    }

    await manager.stopScan().catch(() => undefined);
    if (peripheralId) {
      await manager
        .stopNotification(
          peripheralId,
          SEAMSCOPE_SERVICE_UUID,
          SEAMSCOPE_OBSERVATION_UUID,
        )
        .catch(() => undefined);
      await manager.disconnect(peripheralId).catch(() => undefined);
    }
  }

  private status(phase: BleSourcePhase, detail: string) {
    this.reportStatus({phase, detail});
  }
}

async function requestBlePermissions(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }

  const permissions =
    Number(Platform.Version) >= 31
      ? [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        ]
      : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
  const results = await PermissionsAndroid.requestMultiple(permissions);
  const denied = permissions.filter(
    permission => results[permission] !== PermissionsAndroid.RESULTS.GRANTED,
  );
  if (denied.length > 0) {
    throw new Error('Nearby-device permission was not granted');
  }
}

async function findPeripheral(manager: Manager): Promise<Peripheral> {
  return new Promise<Peripheral>((resolve, reject) => {
    let settled = false;
    let timeout: ReturnType<typeof setTimeout>;
    let discoverSubscription: EventSubscription;
    let stopSubscription: EventSubscription;

    const finish = (peripheral?: Peripheral, error?: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      discoverSubscription.remove();
      stopSubscription.remove();
      manager.stopScan().catch(() => undefined);
      if (peripheral) {
        resolve(peripheral);
      } else {
        reject(error ?? new Error(`${SEAMSCOPE_DEVICE_NAME} was not found`));
      }
    };

    discoverSubscription = manager.onDiscoverPeripheral(peripheral => {
      if (peripheral.name === SEAMSCOPE_DEVICE_NAME) {
        finish(peripheral);
      }
    });
    stopSubscription = manager.onStopScan(() => finish());
    timeout = setTimeout(() => finish(), 9_000);

    manager
      .scan({
        serviceUUIDs: [SEAMSCOPE_SERVICE_UUID],
        exactAdvertisingName: [SEAMSCOPE_DEVICE_NAME],
        seconds: 8,
        allowDuplicates: false,
      })
      .catch(error =>
        finish(undefined, error instanceof Error ? error : new Error(String(error))),
      );
  });
}
