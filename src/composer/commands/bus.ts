import { signal, batch } from '../../index.js';
import type { DocCommand } from './types.js';
import type { DocumentModel } from '../document/model.js';
import { createDocument } from '../document/model.js';
import { applyCommand } from '../document/reducer.js';
import { createIdState, nextId, type IdState } from '../document/ids.js';
import { updateIdStateFromDoc } from './compaction.js';

// ---------------------------------------------------------------------------
// CommandBus — manages command log, undo/redo, and document state
// ---------------------------------------------------------------------------

export interface CommandBus {
  doc: ReturnType<typeof signal<DocumentModel>>;
  idState: IdState;
  log: DocCommand[];
  undoStack: DocCommand[][];
  redoStack: DocCommand[][];
  dispatch(cmds: DocCommand | DocCommand[]): void;
  undo(count?: number): void;
  redo(count?: number): void;
  allocId(kind: string): string;
  exportLog(): string;
  importLog(json: string): void;
  replaceHistory(cmds: DocCommand[]): void;
}

export function createCommandBus(): CommandBus {
  const doc = signal(createDocument());
  const idState = createIdState();
  const log: DocCommand[] = [];
  const undoStack: DocCommand[][] = [];
  const redoStack: DocCommand[][] = [];

  function dispatch(cmds: DocCommand | DocCommand[]): void {
    const cmdList = Array.isArray(cmds) ? cmds : [cmds];
    if (cmdList.length === 0) return;

    batch(() => {
      let current = doc();
      for (const cmd of cmdList) {
        current = applyCommand(current, cmd);
        log.push(cmd);
      }
      doc.set(current);
      undoStack.push(cmdList);
      redoStack.length = 0; // clear redo on new action
    });
  }

  function undo(count: number = 1): void {
    batch(() => {
      for (let i = 0; i < count; i++) {
        const cmds = undoStack.pop();
        if (!cmds) break;
        redoStack.push(cmds);
      }
      // Rebuild doc from log minus undone commands
      rebuildDoc();
    });
  }

  function redo(count: number = 1): void {
    batch(() => {
      for (let i = 0; i < count; i++) {
        const cmds = redoStack.pop();
        if (!cmds) break;
        undoStack.push(cmds);
      }
      rebuildDoc();
    });
  }

  function rebuildDoc(): void {
    // Replay only the commands in the undo stack
    const replayIdState = createIdState();
    let current = createDocument();
    for (const cmdGroup of undoStack) {
      for (const cmd of cmdGroup) {
        current = applyCommand(current, cmd);
      }
    }
    doc.set(current);
    // Update log to match
    log.length = 0;
    for (const cmdGroup of undoStack) {
      log.push(...cmdGroup);
    }
  }

  function allocId(kind: string): string {
    return nextId(idState, kind);
  }

  function exportLog(): string {
    return JSON.stringify(log, null, 2);
  }

  function replaceHistory(cmds: DocCommand[]): void {
    undoStack.length = 0;
    redoStack.length = 0;
    log.length = 0;

    // Reset ID state
    const newIdState = createIdState();
    Object.assign(idState, newIdState);

    batch(() => {
      let current = createDocument();
      for (const cmd of cmds) {
        current = applyCommand(current, cmd);
        log.push(cmd);
      }
      doc.set(current);
      if (cmds.length > 0) {
        undoStack.push(cmds);
      }
      updateIdStateFromDoc(idState, current);
    });
  }

  function importLog(json: string): void {
    const cmds: DocCommand[] = JSON.parse(json);
    // Clear everything
    undoStack.length = 0;
    redoStack.length = 0;
    log.length = 0;
    // Reset ID state
    const newIdState = createIdState();
    Object.assign(idState, newIdState);

    batch(() => {
      let current = createDocument();
      for (const cmd of cmds) {
        current = applyCommand(current, cmd);
        log.push(cmd);
      }
      doc.set(current);
      undoStack.push(cmds);
    });
  }

  return {
    doc, idState, log, undoStack, redoStack,
    dispatch, undo, redo, allocId, exportLog, importLog, replaceHistory,
  };
}
