import { createOwner, setOwner, disposeOwner, type Owner } from './ownership.js';

export function createRoot<T>(fn: (dispose: () => void) => T): T {
  const prevOwner = setOwner(null);
  const owner = createOwner();
  const prev = setOwner(owner);
  try {
    return fn(() => disposeOwner(owner));
  } finally {
    setOwner(prevOwner);
  }
}
