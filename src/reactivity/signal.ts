import { getActiveObserver, isBatching, schedulePending, type Subscriber } from './tracking.js';

export interface ReadSignal<T> {
  (): T;
}

export interface Signal<T> extends ReadSignal<T> {
  set(value: T): void;
  update(fn: (current: T) => T): void;
}

class SignalImpl<T> {
  private value: T;
  private subscribers = new Set<Subscriber>();

  constructor(initialValue: T) {
    this.value = initialValue;
  }

  get(): T {
    const observer = getActiveObserver();
    if (observer) {
      this.subscribers.add(observer);
      observer.dependencies.add(this.subscribers);
    }
    return this.value;
  }

  set(newValue: T): void {
    if (Object.is(this.value, newValue)) return;
    this.value = newValue;
    this.notify();
  }

  update(fn: (current: T) => T): void {
    this.set(fn(this.value));
  }

  private notify(): void {
    for (const subscriber of [...this.subscribers]) {
      if (isBatching()) {
        schedulePending(subscriber);
      } else {
        subscriber.execute();
      }
    }
  }
}

export function signal<T>(initialValue: T): Signal<T> {
  const impl = new SignalImpl(initialValue);

  const accessor = () => impl.get();
  accessor.set = (value: T) => impl.set(value);
  accessor.update = (fn: (current: T) => T) => impl.update(fn);

  return accessor as Signal<T>;
}
