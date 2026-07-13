/**
 * Undo/Redo History Management
 *
 * Cross-domain state history for undo/redo functionality.
 */

import { useSyncExternalStore } from 'react';
import type { Node, Edge } from '@xyflow/react';

import type { UINodeData, UIEdgeData, UISimulation, UIAnnotation } from '../../types/ui';
import type { NodeTemplate, LinkTemplate } from '../../types/schema';
import { UNDO_LIMIT } from '../constants';

export interface UndoState {
  nodes: Node<UINodeData>[];
  edges: Edge<UIEdgeData>[];
  simulation: UISimulation;
  nodeTemplates: NodeTemplate[];
  linkTemplates: LinkTemplate[];
  topologyName: string;
  namespace: string;
  annotations: UIAnnotation[];
}

const undoHistory: UndoState[] = [];
const redoHistory: UndoState[] = [];

// The histories are plain module arrays; components that show undo/redo availability (navbar
// buttons, context menu) subscribe here to re-render when the stacks change.
let historyVersion = 0;
const historyListeners = new Set<() => void>();

const notifyHistoryChanged = (): void => {
  historyVersion++;
  historyListeners.forEach(listener => { listener(); });
};

export const subscribeToHistory = (listener: () => void): (() => void) => {
  historyListeners.add(listener);
  return () => { historyListeners.delete(listener); };
};

export const getHistoryVersion = (): number => historyVersion;

/** Reactive undo/redo availability — re-renders whenever the history stacks change. */
export function useUndoRedoState(): { canUndo: boolean; canRedo: boolean } {
  useSyncExternalStore(subscribeToHistory, getHistoryVersion);
  return { canUndo: canUndo(), canRedo: canRedo() };
}

export const captureState = (state: {
  nodes: Node<UINodeData>[];
  edges: Edge<UIEdgeData>[];
  simulation: UISimulation;
  nodeTemplates: NodeTemplate[];
  linkTemplates: LinkTemplate[];
  topologyName: string;
  namespace: string;
  annotations: UIAnnotation[];
}): UndoState => ({
  // Store updates replace arrays and changed objects instead of mutating them, so snapshots can
  // safely use structural sharing. Deep JSON cloning here made the first frame of every drag
  // proportional to the entire topology even though a drag only changes node positions.
  nodes: state.nodes,
  edges: state.edges,
  simulation: state.simulation,
  nodeTemplates: state.nodeTemplates,
  linkTemplates: state.linkTemplates,
  topologyName: state.topologyName,
  namespace: state.namespace,
  annotations: state.annotations,
});

/**
 * Push to undo history and clear redo history.
 * Use this when a new action is performed (not for undo/redo operations).
 */
export const pushToUndoHistory = (state: UndoState): void => {
  undoHistory.push(state);
  if (undoHistory.length > UNDO_LIMIT) {
    undoHistory.shift();
  }
  redoHistory.length = 0;
  notifyHistoryChanged();
};

/**
 * Push to undo history WITHOUT clearing redo history.
 * Use this during redo operations.
 */
export const pushToUndoHistoryForRedo = (state: UndoState): void => {
  undoHistory.push(state);
  if (undoHistory.length > UNDO_LIMIT) {
    undoHistory.shift();
  }
  notifyHistoryChanged();
};

export const popFromUndoHistory = (): UndoState | undefined => {
  const state = undoHistory.pop();
  notifyHistoryChanged();
  return state;
};

export const pushToRedoHistory = (state: UndoState): void => {
  redoHistory.push(state);
  notifyHistoryChanged();
};

export const popFromRedoHistory = (): UndoState | undefined => {
  const state = redoHistory.pop();
  notifyHistoryChanged();
  return state;
};

export const canUndo = (): boolean => undoHistory.length > 0;
export const canRedo = (): boolean => redoHistory.length > 0;

export const clearHistory = (): void => {
  undoHistory.length = 0;
  redoHistory.length = 0;
  notifyHistoryChanged();
};

export const getUndoHistoryLength = (): number => undoHistory.length;
export const getRedoHistoryLength = (): number => redoHistory.length;
