import { describe, it, expect, vi } from 'vitest';
import { signal } from '../reactivity/signal.js';
import { effect } from '../reactivity/effect.js';
import { mount } from '../rendering/mount.js';
import { html } from '../rendering/template.js';
import { createStore } from '../reactivity/store.js';

describe('html tagged template', () => {
  it('creates a simple element', () => {
    const el = html`<div>Hello</div>` as HTMLElement;
    expect(el.tagName).toBe('DIV');
    expect(el.textContent).toBe('Hello');
  });

  it('interpolates static values', () => {
    const name = 'World';
    const el = html`<span>${name}</span>` as HTMLElement;
    expect(el.textContent).toBe('World');
  });

  it('binds attributes', () => {
    const cls = 'active';
    const el = html`<div class=${cls}>test</div>` as HTMLElement;
    expect(el.className).toBe('active');
  });

  it('binds event handlers', () => {
    const handler = vi.fn();
    const el = html`<button onClick=${handler}>Click</button>` as HTMLElement;
    el.click();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('reactively updates text from signals', () => {
    const count = signal(0);
    const el = html`<span>${() => count()}</span>` as HTMLElement;

    // Need to put it in the DOM for effects to work
    document.body.appendChild(el);
    expect(el.textContent).toBe('0');

    count.set(5);
    expect(el.textContent).toBe('5');

    document.body.removeChild(el);
  });
});

describe('mount', () => {
  it('renders a component to a container', () => {
    const container = document.createElement('div');

    function App() {
      return html`<h1>Hello</h1>`;
    }

    mount(App, container);
    expect(container.innerHTML).toBe('<h1>Hello</h1>');
  });

  it('returns a dispose function', () => {
    const container = document.createElement('div');

    function App() {
      return html`<p>Content</p>`;
    }

    const dispose = mount(App, container);
    expect(container.innerHTML).toBe('<p>Content</p>');

    dispose();
    expect(container.innerHTML).toBe('');
  });

  it('renders reactive components', () => {
    const container = document.createElement('div');
    const count = signal(0);

    function Counter() {
      return html`<span>${() => count()}</span>`;
    }

    mount(Counter, container);
    expect(container.textContent).toBe('0');

    count.set(42);
    expect(container.textContent).toBe('42');
  });
});

describe('createStore', () => {
  it('creates signals for each property', () => {
    const store = createStore({
      name: 'Alice',
      age: 30,
    });

    expect(store.name()).toBe('Alice');
    expect(store.age()).toBe(30);
  });

  it('individual properties are reactive', () => {
    const store = createStore({
      count: 0,
    });

    const values: number[] = [];
    effect(() => { values.push(store.count()); });

    expect(values).toEqual([0]);
    store.count.set(1);
    expect(values).toEqual([0, 1]);
  });
});
