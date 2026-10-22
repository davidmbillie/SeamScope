import type {SignalObservation} from '../model/motionState';

export type SignalObserver = (observation: SignalObservation) => void;

/** Boundary implemented by each application-side observation route. */
export interface SignalSource {
  readonly name: string;
  start(observer: SignalObserver): Promise<void>;
  stop(): Promise<void>;
}

