import { pushObserver, popObserver, isBatching, schedulePending, type Subscriber } from './tracking.js';
import { getOwner, onCleanupInternal } from '../lifecycle/ownership.js';

export function effect(fn: () => void | (() => void)): () => void {
  let cleanup: (() => void) | void;
  let disposed = false;

  const subscriber: Subscriber = {
    dependencies: new Set(),
    execute() {
      if (disposed) return;
      if (isBatching()) {
        schedulePending(subscriber);
        return;
      }
      run();
    },
  };

  function run() {
    // Run previous cleanup
    if (cleanup) {
      cleanup();
      cleanup = undefined;
    }

    // Unsubscribe from old dependencies
    for (const dep of subscriber.dependencies) {
      dep.delete(subscriber);
    }
    subscriber.dependencies.clear();

    pushObserver(subscriber);
    try {
      cleanup = fn();
    } finally {
      popObserver();
    }
  }

  function dispose() {
    disposed = true;
    if (cleanup) {
      cleanup();
      cleanup = undefined;
    }
    for (const dep of subscriber.dependencies) {
      dep.delete(subscriber);
    }
    subscriber.dependencies.clear();
  }

  // Run immediately
  run();

  // Register disposal with the current owner (component scope)
  const owner = getOwner();
  if (owner) {
    onCleanupInternal(owner, dispose);
  }

  return dispose;
}
