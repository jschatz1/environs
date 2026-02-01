import { describe, it, expect, vi } from 'vitest';
import { signal } from '../reactivity/signal.js';
import { effect } from '../reactivity/effect.js';
import { For } from '../control/For.js';

function renderFor<T>(opts: {
  each: () => T[];
  children: (item: T, index: () => number) => unknown;
  key?: (item: T) => string | number;
}): { container: HTMLDivElement; cleanup: () => void } {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const node = For(opts);
  container.appendChild(node);
  return {
    container,
    cleanup: () => document.body.removeChild(container),
  };
}

describe('For keyed reconciliation', () => {
  it('renders items in order', () => {
    const items = signal([
      { id: 1, text: 'a' },
      { id: 2, text: 'b' },
      { id: 3, text: 'c' },
    ]);

    const { container, cleanup } = renderFor({
      each: items,
      key: (item) => item.id,
      children: (item) => {
        const el = document.createElement('span');
        el.textContent = item.text;
        return el;
      },
    });

    expect(container.textContent).toBe('abc');
    cleanup();
  });

  it('preserves DOM nodes on append', () => {
    const items = signal([
      { id: 1, text: 'a' },
      { id: 2, text: 'b' },
    ]);

    const { container, cleanup } = renderFor({
      each: items,
      key: (item) => item.id,
      children: (item) => {
        const el = document.createElement('span');
        el.textContent = item.text;
        return el;
      },
    });

    const firstSpan = container.querySelector('span');
    const secondSpan = container.querySelectorAll('span')[1];

    items.set([
      { id: 1, text: 'a' },
      { id: 2, text: 'b' },
      { id: 3, text: 'c' },
    ]);

    // Original DOM nodes should be the same object references
    expect(container.querySelector('span')).toBe(firstSpan);
    expect(container.querySelectorAll('span')[1]).toBe(secondSpan);
    expect(container.textContent).toBe('abc');
    cleanup();
  });

  it('preserves DOM nodes on prepend', () => {
    const items = signal([
      { id: 2, text: 'b' },
      { id: 3, text: 'c' },
    ]);

    const { container, cleanup } = renderFor({
      each: items,
      key: (item) => item.id,
      children: (item) => {
        const el = document.createElement('span');
        el.textContent = item.text;
        return el;
      },
    });

    const originalFirst = container.querySelector('span');
    const originalSecond = container.querySelectorAll('span')[1];

    items.set([
      { id: 1, text: 'a' },
      { id: 2, text: 'b' },
      { id: 3, text: 'c' },
    ]);

    // Original nodes should still be in the DOM (now at index 1 and 2)
    expect(container.querySelectorAll('span')[1]).toBe(originalFirst);
    expect(container.querySelectorAll('span')[2]).toBe(originalSecond);
    expect(container.textContent).toBe('abc');
    cleanup();
  });

  it('removes items and disposes owners', () => {
    const cleanupFn = vi.fn();
    const items = signal([
      { id: 1, text: 'a' },
      { id: 2, text: 'b' },
      { id: 3, text: 'c' },
    ]);

    const { container, cleanup } = renderFor({
      each: items,
      key: (item) => item.id,
      children: (item) => {
        // Create an effect that registers a cleanup — this verifies disposal
        effect(() => {
          return cleanupFn;
        });
        const el = document.createElement('span');
        el.textContent = item.text;
        return el;
      },
    });

    expect(container.querySelectorAll('span').length).toBe(3);
    // Effects run immediately, producing 3 cleanupFn registrations.
    // Reset to track only the disposal-triggered calls.
    cleanupFn.mockClear();

    items.set([
      { id: 1, text: 'a' },
      { id: 3, text: 'c' },
    ]);

    expect(container.querySelectorAll('span').length).toBe(2);
    expect(container.textContent).toBe('ac');
    // The removed item's owner should have been disposed, running its effect cleanup
    expect(cleanupFn).toHaveBeenCalled();
    cleanup();
  });

  it('reorders DOM nodes without recreating them', () => {
    const items = signal([
      { id: 1, text: 'a' },
      { id: 2, text: 'b' },
      { id: 3, text: 'c' },
    ]);

    const { container, cleanup } = renderFor({
      each: items,
      key: (item) => item.id,
      children: (item) => {
        const el = document.createElement('span');
        el.textContent = item.text;
        return el;
      },
    });

    const [spanA, spanB, spanC] = Array.from(container.querySelectorAll('span'));

    // Reverse the order
    items.set([
      { id: 3, text: 'c' },
      { id: 2, text: 'b' },
      { id: 1, text: 'a' },
    ]);

    const spans = container.querySelectorAll('span');
    // Same DOM nodes, just reordered
    expect(spans[0]).toBe(spanC);
    expect(spans[1]).toBe(spanB);
    expect(spans[2]).toBe(spanA);
    expect(container.textContent).toBe('cba');
    cleanup();
  });

  it('updates reactive index on reorder', () => {
    const items = signal([
      { id: 1, text: 'a' },
      { id: 2, text: 'b' },
      { id: 3, text: 'c' },
    ]);

    const indices: Record<number, number[]> = { 1: [], 2: [], 3: [] };

    const { container, cleanup } = renderFor({
      each: items,
      key: (item) => item.id,
      children: (item, index) => {
        effect(() => {
          indices[item.id].push(index());
        });
        const el = document.createElement('span');
        el.textContent = item.text;
        return el;
      },
    });

    // Initial indices
    expect(indices[1]).toEqual([0]);
    expect(indices[2]).toEqual([1]);
    expect(indices[3]).toEqual([2]);

    // Reverse
    items.set([
      { id: 3, text: 'c' },
      { id: 2, text: 'b' },
      { id: 1, text: 'a' },
    ]);

    // Index signals should have been updated
    expect(indices[1]).toEqual([0, 2]);
    expect(indices[2]).toEqual([1]); // stayed at 1, no re-run since value unchanged
    expect(indices[3]).toEqual([2, 0]);
    cleanup();
  });

  it('falls back to full rebuild without key prop', () => {
    const items = signal([
      { id: 1, text: 'a' },
      { id: 2, text: 'b' },
    ]);

    const { container, cleanup } = renderFor({
      each: items,
      children: (item) => {
        const el = document.createElement('span');
        el.textContent = item.text;
        return el;
      },
    });

    const originalFirst = container.querySelector('span');

    items.set([
      { id: 1, text: 'a' },
      { id: 2, text: 'b' },
      { id: 3, text: 'c' },
    ]);

    // Without key, nodes are rebuilt — should be different references
    expect(container.querySelector('span')).not.toBe(originalFirst);
    expect(container.textContent).toBe('abc');
    cleanup();
  });

  it('clears all nodes on empty array', () => {
    const items = signal([
      { id: 1, text: 'a' },
      { id: 2, text: 'b' },
    ]);

    const { container, cleanup } = renderFor({
      each: items,
      key: (item) => item.id,
      children: (item) => {
        const el = document.createElement('span');
        el.textContent = item.text;
        return el;
      },
    });

    expect(container.querySelectorAll('span').length).toBe(2);

    items.set([]);

    expect(container.querySelectorAll('span').length).toBe(0);
    cleanup();
  });

  it('throws on duplicate keys', () => {
    const items = signal([
      { id: 1, text: 'a' },
      { id: 1, text: 'b' },
    ]);

    expect(() => {
      renderFor({
        each: items,
        key: (item) => item.id,
        children: (item) => {
          const el = document.createElement('span');
          el.textContent = item.text;
          return el;
        },
      });
    }).toThrow('Duplicate key in For: 1');
  });

  it('handles complete replacement (all new keys)', () => {
    const items = signal([
      { id: 1, text: 'a' },
      { id: 2, text: 'b' },
    ]);

    const { container, cleanup } = renderFor({
      each: items,
      key: (item) => item.id,
      children: (item) => {
        const el = document.createElement('span');
        el.textContent = item.text;
        return el;
      },
    });

    const [oldA, oldB] = Array.from(container.querySelectorAll('span'));

    items.set([
      { id: 3, text: 'x' },
      { id: 4, text: 'y' },
    ]);

    const spans = container.querySelectorAll('span');
    expect(spans.length).toBe(2);
    expect(spans[0]).not.toBe(oldA);
    expect(spans[1]).not.toBe(oldB);
    expect(container.textContent).toBe('xy');
    cleanup();
  });

  it('index signal stays at same value when position unchanged', () => {
    const items = signal([
      { id: 1, text: 'a' },
      { id: 2, text: 'b' },
      { id: 3, text: 'c' },
    ]);

    const indexUpdates: number[] = [];

    const { container, cleanup } = renderFor({
      each: items,
      key: (item) => item.id,
      children: (item, index) => {
        if (item.id === 2) {
          effect(() => {
            indexUpdates.push(index());
          });
        }
        const el = document.createElement('span');
        el.textContent = item.text;
        return el;
      },
    });

    // Append — item 2 stays at index 1
    items.set([
      { id: 1, text: 'a' },
      { id: 2, text: 'b' },
      { id: 3, text: 'c' },
      { id: 4, text: 'd' },
    ]);

    // Effect should only have run once (initial), since index didn't change
    expect(indexUpdates).toEqual([1]);
    cleanup();
  });
});
