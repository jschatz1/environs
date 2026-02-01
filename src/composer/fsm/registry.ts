// ---------------------------------------------------------------------------
// FSM Runtime Registry — creates reactive controllers from FSM definitions
// ---------------------------------------------------------------------------

import { signal, batch } from '../../index.js';
import type { Signal } from '../../index.js';
import type { DocumentModel, FSMDef, FSMTransition } from '../document/model.js';

// ---------------------------------------------------------------------------
// Public controller interface (exposed to scripts via ctx.global.fsm())
// ---------------------------------------------------------------------------

export interface FSMController {
  state: Signal<string>;
  current(): string;
  send(event: string, payload?: any): void;
}

// ---------------------------------------------------------------------------
// Internal instance
// ---------------------------------------------------------------------------

interface FSMInstance {
  def: FSMDef;
  controller: FSMController;
  payload?: any;
}

const registry = new Map<string, FSMInstance>();

// ---------------------------------------------------------------------------
// Sync registry with document FSM definitions
// ---------------------------------------------------------------------------

export function syncFSMs(doc: DocumentModel): void {
  const activeNames = new Set<string>();

  for (const [name, def] of doc.fsms) {
    activeNames.add(name);
    const existing = registry.get(name);

    if (existing) {
      // Update definition (transitions may have changed), preserve current state
      existing.def = def;
    } else {
      // Create new instance — controller reads from instance.def so updates are visible
      const state = signal(def.initialState);
      const instance: FSMInstance = { def, controller: null as any, payload: undefined };

      const controller: FSMController = {
        state,
        current: () => state(),
        send(event: string, payload?: any) {
          const currentState = state();
          const stateDef = instance.def.states.find(s => s.name === currentState);
          if (!stateDef?.on?.[event]) return;

          const transition = stateDef.on[event];
          const target = typeof transition === 'string' ? transition : transition.target;

          // Verify target state exists in definition
          if (!instance.def.states.some(s => s.name === target)) return;

          batch(() => {
            instance.payload = payload;
            state.set(target);
          });
        },
      };

      instance.controller = controller;
      registry.set(name, instance);
    }
  }

  // Remove instances for deleted FSMs
  for (const [name] of registry) {
    if (!activeNames.has(name)) {
      registry.delete(name);
    }
  }
}

// ---------------------------------------------------------------------------
// Get a controller by name (called from scripts)
// ---------------------------------------------------------------------------

export function getFSMController(name: string): FSMController {
  const instance = registry.get(name);
  if (!instance) {
    throw new Error(`FSM "${name}" not found. Define it first: fsm define ${name} initial <state>`);
  }
  return instance.controller;
}

// ---------------------------------------------------------------------------
// Reset all FSM instances (e.g. on demo switch)
// ---------------------------------------------------------------------------

export function resetAllFSMs(): void {
  registry.clear();
}
