/**
 * Store - Main exports
 *
 * This file re-exports everything from createStore for backward compatibility.
 */

export {
  useTopologyStore,
  createTopologyStore,
  saveToUndoHistory,
  undo,
  redo,
  canUndo,
  canRedo,
  clearUndoHistory,
  generateUniqueName,
  generateCopyName,
  exportToYaml,
  downloadYaml,
  type TopologyStore,
} from './createStore';

// Re-export history utilities
export {
  captureState,
  canUndo as historyCanUndo,
  canRedo as historyCanRedo,
  clearHistory,
} from './history';

export type { EdaConnectionStatus } from './createStore';
