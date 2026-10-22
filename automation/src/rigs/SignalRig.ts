export type FaultProfile = 'DROP_NEXT' | 'MALFORM_NEXT';

/** Laboratory control boundary; it has no UI knowledge. */
export interface SignalRig {
  readonly routeName: 'injected' | 'serial-ble';
  start(): Promise<void>;
  reset(): Promise<void>;
  setSpeed(speed: number): Promise<void>;
  armFault(profile: FaultProfile): Promise<void>;
  close(): Promise<void>;
}

