import { getOwner, onCleanupInternal } from './ownership.js';

export function onCleanup(fn: () => void): void {
  const owner = getOwner();
  if (owner) {
    onCleanupInternal(owner, fn);
  }
}
