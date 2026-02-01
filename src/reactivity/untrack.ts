import { pushObserver, popObserver } from './tracking.js';

export function untrack<T>(fn: () => T): T {
  // Push a null-like sentinel by temporarily emptying the observer
  // We achieve this by not pushing any observer, so getActiveObserver returns undefined
  pushObserver(null as any);
  try {
    return fn();
  } finally {
    popObserver();
  }
}
