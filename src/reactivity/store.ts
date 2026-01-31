import { signal, type Signal } from './signal.js';

type StoreSignals<T> = {
  [K in keyof T]: Signal<T[K]>;
};

export type Store<T> = {
  [K in keyof T]: Signal<T[K]>;
};

export function createStore<T extends Record<string, unknown>>(initial: T): Store<T> {
  const signals = {} as StoreSignals<T>;

  for (const key of Object.keys(initial) as (keyof T)[]) {
    signals[key] = signal(initial[key]);
  }

  return signals;
}
