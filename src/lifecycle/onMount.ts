import { getOwner, onCleanupInternal } from './ownership.js';

export function onMount(fn: () => void | (() => void)): void {
  // onMount runs after the component's DOM is inserted.
  // We use queueMicrotask to defer to after the synchronous render completes.
  const owner = getOwner();
  queueMicrotask(() => {
    const cleanup = fn();
    if (typeof cleanup === 'function' && owner) {
      onCleanupInternal(owner, cleanup);
    }
  });
}
