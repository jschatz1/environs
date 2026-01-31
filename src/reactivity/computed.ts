import { getActiveObserver, pushObserver, popObserver, type Subscriber } from './tracking.js';

export interface Computed<T> {
  (): T;
}

export function computed<T>(fn: () => T): Computed<T> {
  let value: T;
  let dirty = true;
  const subscribers = new Set<Subscriber>();

  const subscriber: Subscriber = {
    dependencies: new Set(),
    execute() {
      dirty = true;
      // Notify downstream subscribers
      for (const sub of [...subscribers]) {
        sub.execute();
      }
    },
  };

  function get(): T {
    const observer = getActiveObserver();
    if (observer) {
      subscribers.add(observer);
      observer.dependencies.add(subscribers);
    }

    if (dirty) {
      // Unsubscribe from old dependencies
      for (const dep of subscriber.dependencies) {
        dep.delete(subscriber);
      }
      subscriber.dependencies.clear();

      pushObserver(subscriber);
      try {
        value = fn();
      } finally {
        popObserver();
      }
      dirty = false;
    }
    return value;
  }

  return get as Computed<T>;
}
