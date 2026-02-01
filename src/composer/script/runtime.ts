// ---------------------------------------------------------------------------
// Script runtime — executes and manages per-node scripts
// ---------------------------------------------------------------------------

import { signal, effect, computed, batch, createRoot } from '../../index.js';
import type { DocumentModel } from '../document/model.js';
import type { DOMBackend } from '../backend/domBackend.js';
import type { NodeId } from '../document/ids.js';
import { compileScript, isScriptError, type ScriptError } from './compile.js';
import { getFSMController } from '../fsm/registry.js';
import { getRouter } from '../router/runtime.js';

// ---------------------------------------------------------------------------
// SelfAPI — per-element DOM facade
// ---------------------------------------------------------------------------

interface SelfAPI {
  el: HTMLElement;
  on(event: string, handler: EventListener): void;
  onClick(handler: EventListener): void;
  onInput(handler: EventListener): void;
  prop(name: string, value: any): void;
  text(value: string): void;
  class_(name: string, active?: boolean): void;
  style(prop: string, value: string): void;
}

function createSelfAPI(el: HTMLElement, disposers: (() => void)[]): SelfAPI {
  return {
    el,
    on(event: string, handler: EventListener) {
      el.addEventListener(event, handler);
      disposers.push(() => el.removeEventListener(event, handler));
    },
    onClick(handler: EventListener) {
      this.on('click', handler);
    },
    onInput(handler: EventListener) {
      this.on('input', handler);
    },
    prop(name: string, value: any) {
      (el as any)[name] = value;
    },
    text(value: string) {
      el.textContent = value;
    },
    class_(name: string, active?: boolean) {
      if (active === undefined || active) {
        el.classList.add(name);
      } else {
        el.classList.remove(name);
      }
    },
    style(prop: string, value: string) {
      el.style.setProperty(prop, value);
    },
  };
}

// ---------------------------------------------------------------------------
// ScriptContext — reactive primitives exposed to user scripts
// ---------------------------------------------------------------------------

interface ScriptContext {
  signal: typeof signal;
  effect: typeof effect;
  memo: typeof computed;
  batch: typeof batch;
  onMount(fn: () => void | (() => void)): void;
  log(...args: any[]): void;
  props: Record<string, any>;
  scope: Record<string, any>;
  global: {
    fsm(name: string): ReturnType<typeof getFSMController>;
    router: {
      pathname(): string;
      params(): Record<string, string>;
      query(): Record<string, string>;
      hash(): string;
      routeName(): string | null;
      push(path: string): void;
      replace(path: string): void;
      back(): void;
      forward(): void;
    };
  };
}

function createScriptContext(
  nodeId: string,
  props: Record<string, any>,
  disposers: (() => void)[],
): ScriptContext {
  const mountCallbacks: (() => void | (() => void))[] = [];

  const ctx: ScriptContext = {
    signal,
    effect,
    memo: computed,
    batch,
    onMount(fn: () => void | (() => void)) {
      mountCallbacks.push(fn);
    },
    log(...args: any[]) {
      console.log(`[script:${nodeId}]`, ...args);
    },
    props: { ...props },
    scope: {},
    global: {
      fsm: getFSMController,
      router: {
        pathname: () => getRouter().pathname(),
        params: () => getRouter().params(),
        query: () => getRouter().query(),
        hash: () => getRouter().hash(),
        routeName: () => getRouter().routeName(),
        push: (path: string) => getRouter().push(path),
        replace: (path: string) => getRouter().replace(path),
        back: () => getRouter().back(),
        forward: () => getRouter().forward(),
      },
    },
  };

  // Run mount callbacks synchronously after script body executes.
  // We schedule this via a microtask so the script body finishes first.
  queueMicrotask(() => {
    for (const fn of mountCallbacks) {
      const cleanup = fn();
      if (typeof cleanup === 'function') {
        disposers.push(cleanup);
      }
    }
  });

  return ctx;
}

// ---------------------------------------------------------------------------
// Script instance tracking
// ---------------------------------------------------------------------------

interface ScriptInstance {
  nodeId: NodeId;
  version: number;
  dispose: () => void;
}

const instances = new Map<NodeId, ScriptInstance>();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function runScriptsForDocument(doc: DocumentModel, backend: DOMBackend): ScriptError[] {
  const errors: ScriptError[] = [];
  const activeNodeIds = new Set<NodeId>();

  for (const [nodeId, node] of doc.nodes) {
    if (!node.script) continue;
    activeNodeIds.add(nodeId);

    const existing = instances.get(nodeId);
    if (existing && existing.version === node.script.version) {
      continue; // unchanged
    }

    // Dispose old instance if version changed
    if (existing) {
      existing.dispose();
      instances.delete(nodeId);
    }

    // Compile
    const compiled = compileScript(node.script.source, nodeId);
    if (isScriptError(compiled)) {
      errors.push(compiled);
      continue;
    }

    // Find the DOM element
    const el = backend.getElement(nodeId);
    if (!el) continue;

    // Run inside a reactive root
    const disposers: (() => void)[] = [];

    const rootDispose = createRoot((dispose) => {
      const selfAPI = createSelfAPI(el, disposers);
      const ctx = createScriptContext(nodeId, node.props, disposers);

      try {
        compiled.fn(selfAPI, ctx);
      } catch (err: any) {
        errors.push({
          nodeId,
          phase: 'runtime',
          message: err.message ?? String(err),
          stack: err.stack,
        });
      }

      return dispose;
    });

    instances.set(nodeId, {
      nodeId,
      version: node.script.version,
      dispose() {
        for (const d of disposers) {
          try { d(); } catch {}
        }
        disposers.length = 0;
        rootDispose();
      },
    });
  }

  // Dispose scripts for nodes that lost their script or were deleted
  for (const [nodeId, instance] of instances) {
    if (!activeNodeIds.has(nodeId)) {
      instance.dispose();
      instances.delete(nodeId);
    }
  }

  return errors;
}

export function disposeAllScripts(): void {
  for (const [, instance] of instances) {
    instance.dispose();
  }
  instances.clear();
}
