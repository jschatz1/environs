import type { NodeId } from '../document/ids.js';
import type { NodeKind, LayoutType } from '../document/model.js';

// ---------------------------------------------------------------------------
// Document commands (persisted, replayable)
// ---------------------------------------------------------------------------

export type DocCommand =
  | CreateNodeCmd
  | SetPropsCmd
  | ApplyStyleTokensCmd
  | AttachLayoutCmd
  | PlaceChildCmd
  | RemoveChildCmd
  | DeleteNodeCmd
  | RenameNodeCmd
  | MoveChildCmd
  | DuplicateNodeCmd;

export interface CreateNodeCmd {
  type: 'CreateNode';
  id: NodeId;
  kind: NodeKind;
  name?: string;
  tag?: string;
  initialProps?: Record<string, any>;
  initialStyleTokens?: string[];
  layout?: {
    type: LayoutType;
    options: Record<string, any>;
  };
}

export interface SetPropsCmd {
  type: 'SetProps';
  id: NodeId;
  propsPatch: Record<string, any>;
}

export interface ApplyStyleTokensCmd {
  type: 'ApplyStyleTokens';
  id: NodeId;
  tokensAdd?: string[];
  tokensRemove?: string[];
  tokensSet?: string[];
}

export interface AttachLayoutCmd {
  type: 'AttachLayout';
  id: NodeId;
  layoutType: LayoutType;
  options: Record<string, any>;
}

export interface PlaceChildCmd {
  type: 'PlaceChild';
  parentId: NodeId;
  slot: string;
  childId: NodeId;
  order?: number;
}

export interface RemoveChildCmd {
  type: 'RemoveChild';
  parentId: NodeId;
  slot: string;
  childId: NodeId;
}

export interface MoveChildCmd {
  type: 'MoveChild';
  childId: NodeId;
  toParentId: NodeId;
  toSlot: string;
  order?: number;
}

export interface DeleteNodeCmd {
  type: 'DeleteNode';
  id: NodeId;
}

export interface RenameNodeCmd {
  type: 'RenameNode';
  id: NodeId;
  name: string;
}

export interface DuplicateNodeCmd {
  type: 'DuplicateNode';
  sourceId: NodeId;
  newId: NodeId;
  name?: string;
  deep: boolean;
}

// ---------------------------------------------------------------------------
// Editor commands (not persisted in doc log)
// ---------------------------------------------------------------------------

export type EditorCommand =
  | SelectCmd
  | EnterScopeCmd
  | ExitScopeCmd
  | UndoCmd
  | RedoCmd
  | ShowCmd
  | ListCmd
  | ExportCmd
  | ImportCmd
  | HelpCmd;

export interface SelectCmd { type: 'Select'; id: NodeId | null; }
export interface EnterScopeCmd { type: 'EnterScope'; id?: NodeId; }
export interface ExitScopeCmd { type: 'ExitScope'; count: number; }
export interface UndoCmd { type: 'Undo'; count: number; }
export interface RedoCmd { type: 'Redo'; count: number; }
export interface ShowCmd { type: 'Show'; id?: NodeId; flags: string[]; }
export interface ListCmd { type: 'List'; kind: string; scope: string; }
export interface ExportCmd { type: 'Export'; kind: string; target: string; path?: string; }
export interface ImportCmd { type: 'Import'; kind: string; source: string; data?: any; }
export interface HelpCmd { type: 'Help'; topic?: string; }

export type Command = DocCommand | EditorCommand;
