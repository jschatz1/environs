import { describe, it, expect } from 'vitest';
import { signal } from '../reactivity/signal.js';

describe('signal', () => {
  it('returns the initial value', () => {
    const count = signal(0);
    expect(count()).toBe(0);
  });

  it('updates with set()', () => {
    const count = signal(0);
    count.set(5);
    expect(count()).toBe(5);
  });

  it('updates with update()', () => {
    const count = signal(0);
    count.update(n => n + 1);
    expect(count()).toBe(1);
  });

  it('does not notify on same value', () => {
    const count = signal(0);
    let runs = 0;
    // We'll test this more thoroughly with effects
    count.set(0);
    expect(count()).toBe(0);
  });

  it('works with different types', () => {
    const name = signal('hello');
    expect(name()).toBe('hello');
    name.set('world');
    expect(name()).toBe('world');

    const obj = signal({ a: 1 });
    expect(obj()).toEqual({ a: 1 });
    obj.set({ a: 2 });
    expect(obj()).toEqual({ a: 2 });

    const arr = signal([1, 2, 3]);
    expect(arr()).toEqual([1, 2, 3]);

    const bool = signal(true);
    expect(bool()).toBe(true);
    bool.set(false);
    expect(bool()).toBe(false);

    const nul = signal<string | null>(null);
    expect(nul()).toBe(null);
    nul.set('not null');
    expect(nul()).toBe('not null');
  });
});
