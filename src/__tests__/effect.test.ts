import { describe, it, expect, vi } from 'vitest';
import { signal } from '../reactivity/signal.js';
import { effect } from '../reactivity/effect.js';
import { batch } from '../reactivity/batch.js';

describe('effect', () => {
  it('runs immediately', () => {
    const fn = vi.fn();
    effect(fn);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('re-runs when a tracked signal changes', () => {
    const count = signal(0);
    const values: number[] = [];

    effect(() => {
      values.push(count());
    });

    expect(values).toEqual([0]);
    count.set(1);
    expect(values).toEqual([0, 1]);
    count.set(2);
    expect(values).toEqual([0, 1, 2]);
  });

  it('does not re-run when signal is set to same value', () => {
    const count = signal(0);
    let runs = 0;

    effect(() => {
      count();
      runs++;
    });

    expect(runs).toBe(1);
    count.set(0);
    expect(runs).toBe(1);
  });

  it('can be disposed', () => {
    const count = signal(0);
    let runs = 0;

    const dispose = effect(() => {
      count();
      runs++;
    });

    expect(runs).toBe(1);
    dispose();
    count.set(1);
    expect(runs).toBe(1);
  });

  it('runs cleanup on re-execution', () => {
    const count = signal(0);
    const cleanups: number[] = [];

    effect(() => {
      const val = count();
      return () => { cleanups.push(val); };
    });

    expect(cleanups).toEqual([]);
    count.set(1);
    expect(cleanups).toEqual([0]);
    count.set(2);
    expect(cleanups).toEqual([0, 1]);
  });

  it('runs cleanup on dispose', () => {
    const count = signal(0);
    let cleaned = false;

    const dispose = effect(() => {
      count();
      return () => { cleaned = true; };
    });

    expect(cleaned).toBe(false);
    dispose();
    expect(cleaned).toBe(true);
  });

  it('auto-tracks dependencies dynamically', () => {
    const a = signal(true);
    const b = signal('B');
    const c = signal('C');
    const values: string[] = [];

    effect(() => {
      values.push(a() ? b() : c());
    });

    expect(values).toEqual(['B']);

    // Changing c should not trigger (not tracked)
    c.set('C2');
    expect(values).toEqual(['B']);

    // Switch branch
    a.set(false);
    expect(values).toEqual(['B', 'C2']);

    // Now b should not trigger
    b.set('B2');
    expect(values).toEqual(['B', 'C2']);

    // But c should
    c.set('C3');
    expect(values).toEqual(['B', 'C2', 'C3']);
  });
});

describe('batch', () => {
  it('defers effect execution until batch completes', () => {
    const a = signal(0);
    const b = signal(0);
    const values: string[] = [];

    effect(() => {
      values.push(`${a()},${b()}`);
    });

    expect(values).toEqual(['0,0']);

    batch(() => {
      a.set(1);
      b.set(1);
    });

    // Should only run once with final values
    expect(values).toEqual(['0,0', '1,1']);
  });
});
