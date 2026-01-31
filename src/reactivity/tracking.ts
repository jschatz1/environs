// Dependency tracking internals
// Uses a stack-based approach: when a computed/effect runs,
// it pushes itself as the "active observer". Any signal read
// during that time registers itself as a dependency.

export type Subscriber = {
  execute(): void;
  dependencies: Set<Set<Subscriber>>;
};

const observerStack: Subscriber[] = [];

export function getActiveObserver(): Subscriber | undefined {
  return observerStack[observerStack.length - 1];
}

export function pushObserver(observer: Subscriber): void {
  observerStack.push(observer);
}

export function popObserver(): void {
  observerStack.pop();
}

// Batching support
let batchDepth = 0;
const pendingEffects = new Set<Subscriber>();

export function startBatch(): void {
  batchDepth++;
}

export function endBatch(): void {
  batchDepth--;
  if (batchDepth === 0) {
    flushPending();
  }
}

export function isBatching(): boolean {
  return batchDepth > 0;
}

export function schedulePending(subscriber: Subscriber): void {
  pendingEffects.add(subscriber);
}

export function flushPending(): void {
  const effects = [...pendingEffects];
  pendingEffects.clear();
  for (const effect of effects) {
    effect.execute();
  }
}
