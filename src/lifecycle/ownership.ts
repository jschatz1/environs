// Ownership tree for component scoping
// Each component creates an "owner" that tracks cleanups and child owners.
// When a component is torn down, all its effects and children are disposed.

export interface Owner {
  cleanups: (() => void)[];
  children: Owner[];
  parent: Owner | null;
  context: Map<symbol, unknown>;
}

let activeOwner: Owner | null = null;

export function getOwner(): Owner | null {
  return activeOwner;
}

export function setOwner(owner: Owner | null): Owner | null {
  const prev = activeOwner;
  activeOwner = owner;
  return prev;
}

export function createOwner(): Owner {
  const owner: Owner = {
    cleanups: [],
    children: [],
    parent: activeOwner,
    context: new Map(),
  };
  if (activeOwner) {
    activeOwner.children.push(owner);
  }
  return owner;
}

export function disposeOwner(owner: Owner): void {
  // Dispose children first (depth-first)
  for (const child of owner.children) {
    disposeOwner(child);
  }
  owner.children.length = 0;

  // Run cleanups in reverse order
  for (let i = owner.cleanups.length - 1; i >= 0; i--) {
    owner.cleanups[i]();
  }
  owner.cleanups.length = 0;

  // Remove from parent
  if (owner.parent) {
    const idx = owner.parent.children.indexOf(owner);
    if (idx !== -1) {
      owner.parent.children.splice(idx, 1);
    }
  }
}

export function onCleanupInternal(owner: Owner, fn: () => void): void {
  owner.cleanups.push(fn);
}

export function runWithOwner<T>(owner: Owner, fn: () => T): T {
  const prev = setOwner(owner);
  try {
    return fn();
  } finally {
    setOwner(prev);
  }
}
