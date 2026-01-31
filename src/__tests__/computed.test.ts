import { describe, it, expect } from 'vitest';
import { signal } from '../reactivity/signal.js';
import { computed } from '../reactivity/computed.js';
import { effect } from '../reactivity/effect.js';

describe('computed', () => {
  it('derives a value from signals', () => {
    const count = signal(2);
    const doubled = computed(() => count() * 2);

    expect(doubled()).toBe(4);
  });

  it('updates when source signal changes', () => {
    const count = signal(2);
    const doubled = computed(() => count() * 2);

    count.set(5);
    expect(doubled()).toBe(10);
  });

  it('is lazy (does not compute until read)', () => {
    let computeCount = 0;
    const count = signal(0);
    const doubled = computed(() => {
      computeCount++;
      return count() * 2;
    });

    expect(computeCount).toBe(0);
    doubled();
    expect(computeCount).toBe(1);
    // Reading again without change should use cached value
    doubled();
    expect(computeCount).toBe(1);
  });

  it('recomputes when dependency changes', () => {
    let computeCount = 0;
    const count = signal(0);
    const doubled = computed(() => {
      computeCount++;
      return count() * 2;
    });

    doubled();
    expect(computeCount).toBe(1);

    count.set(1);
    doubled();
    expect(computeCount).toBe(2);
  });

  it('works in chains', () => {
    const count = signal(1);
    const doubled = computed(() => count() * 2);
    const quadrupled = computed(() => doubled() * 2);

    expect(quadrupled()).toBe(4);
    count.set(3);
    expect(quadrupled()).toBe(12);
  });

  it('works with effects', () => {
    const count = signal(0);
    const doubled = computed(() => count() * 2);
    const values: number[] = [];

    effect(() => {
      values.push(doubled());
    });

    expect(values).toEqual([0]);
    count.set(1);
    expect(values).toEqual([0, 2]);
    count.set(5);
    expect(values).toEqual([0, 2, 10]);
  });
});
