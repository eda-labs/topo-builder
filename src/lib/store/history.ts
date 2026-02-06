/**
 * Undo/Redo History Management
 *
 * Cross-domain state history for undo/redo functionality.
 */

import type { Node, Edge } from '@xyflow/react';

import type { UINodeData, UIEdgeData, UISimulation } from '../../types/ui';
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
}

const undoHistory: UndoState[] = [];
const redoHistory: UndoState[] = [];

export const captureState = (state: {
  nodes: Node<UINodeData>[];
  edges: Edge<UIEdgeData>[];
  simulation: UISimulation;
  nodeTemplates: NodeTemplate[];
  linkTemplates: LinkTemplate[];
  topologyName: string;
  namespace: string;
}): UndoState => ({
  nodes: JSON.parse(JSON.stringify(state.nodes)) as Node<UINodeData>[],
  edges: JSON.parse(JSON.stringify(state.edges)) as Edge<UIEdgeData>[],
  simulation: JSON.parse(JSON.stringify(state.simulation)) as UISimulation,
  nodeTemplates: JSON.parse(JSON.stringify(state.nodeTemplates)) as NodeTemplate[],
  linkTemplates: JSON.parse(JSON.stringify(state.linkTemplates)) as LinkTemplate[],
  topologyName: state.topologyName,
  namespace: state.namespace,
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
};

export const popFromUndoHistory = (): UndoState | undefined => {
  return undoHistory.pop();
};

export const pushToRedoHistory = (state: UndoState): void => {
  redoHistory.push(state);
};

export const popFromRedoHistory = (): UndoState | undefined => {
  return redoHistory.pop();
};

export const canUndo = (): boolean => undoHistory.length > 0;
export const canRedo = (): boolean => redoHistory.length > 0;

export const clearHistory = (): void => {
  undoHistory.length = 0;
  redoHistory.length = 0;
};

export const getUndoHistoryLength = (): number => undoHistory.length;
export const getRedoHistoryLength = (): number => redoHistory.length;
