/**
 * Selection Store Slice
 *
 * Contains all selection-related actions for the topology store.
 */

import type { StateCreator } from 'zustand';

import type { UINode, UIEdge, SelectionState } from '../../types/ui';
import { EMPTY_STRING_SET, toggleMemberLinkIndex } from '../utils';

export interface SelectionActions {
  selectNode: (id: string | null, addToSelection?: boolean) => void;
  selectEdge: (id: string | null, addToSelection?: boolean) => void;
  selectSimNode: (name: string | null) => void;
  selectSimNodes: (names: Set<string>) => void;
  selectMemberLink: (edgeId: string, index: number | null, addToSelection?: boolean) => void;
  selectLag: (edgeId: string, lagId: string | null) => void;
  clearMemberLinkSelection: () => void;
  clearEdgeSelection: () => void;
  syncSelectionFromReactFlow: (nodeIds: string[], edgeIds: string[]) => void;
  _skipNextSelectionSync: boolean;
}

export type SelectionSlice = SelectionState & SelectionActions;

export type SelectionSliceCreator = StateCreator<
  SelectionSlice & {
    nodes: UINode[];
    edges: UIEdge[];
  },
  [],
  [],
  SelectionSlice
>;

export const createSelectionSlice: SelectionSliceCreator = (set, get) => ({
  selectedNodeId: null,
  selectedNodeIds: [],
  selectedEdgeId: null,
  selectedEdgeIds: [],
  selectedSimNodeName: null,
  selectedSimNodeNames: EMPTY_STRING_SET,
  selectedMemberLinkIndices: [],
  selectedLagId: null,
  _skipNextSelectionSync: false,

  selectNode: (id: string | null, addToSelection?: boolean) => {
    if (id === null) {
      set({
        selectedNodeId: null,
        selectedNodeIds: [],
        selectedEdgeId: null,
        selectedEdgeIds: [],
        selectedSimNodeName: null,
        selectedSimNodeNames: EMPTY_STRING_SET,
        selectedMemberLinkIndices: [],
        selectedLagId: null,
      });
      return;
    }

    if (addToSelection) {
      const currentNodeIds = get().selectedNodeIds;
      const isCurrentlySelected = currentNodeIds.includes(id);
      const newNodeIds = isCurrentlySelected
        ? currentNodeIds.filter(nid => nid !== id)
        : [...currentNodeIds, id];
      set({
        selectedNodeId: isCurrentlySelected
          ? (newNodeIds.at(-1) ?? null)
          : id,
        selectedNodeIds: newNodeIds,
        selectedSimNodeName: null,
        selectedSimNodeNames: EMPTY_STRING_SET,
        selectedLagId: null,
      });
    } else {
      set({
        selectedNodeId: id,
        selectedNodeIds: [id],
        selectedEdgeId: null,
        selectedEdgeIds: [],
        selectedSimNodeName: null,
        selectedSimNodeNames: EMPTY_STRING_SET,
        selectedMemberLinkIndices: [],
        selectedLagId: null,
      });
    }
  },

  selectEdge: (id: string | null, addToSelection?: boolean) => {
    const currentIds = get().selectedEdgeIds;

    if (id === null) {
      set({
        selectedEdgeId: null,
        selectedEdgeIds: [],
        selectedNodeId: null,
        selectedNodeIds: [],
        selectedSimNodeName: null,
        selectedSimNodeNames: EMPTY_STRING_SET,
        selectedMemberLinkIndices: [],
        selectedLagId: null,
      });
      return;
    }

    let newIds: string[];
    if (addToSelection) {
      newIds = currentIds.includes(id) ? currentIds.filter(i => i !== id) : [...currentIds, id];
    } else {
      newIds = [id];
    }

    const lastId = newIds.length > 0 ? newIds[newIds.length - 1] : null;
    set({
      selectedEdgeId: lastId,
      selectedEdgeIds: newIds,
      selectedNodeId: addToSelection ? get().selectedNodeId : null,
      selectedNodeIds: addToSelection ? get().selectedNodeIds : [],
      selectedSimNodeName: null,
      selectedSimNodeNames: EMPTY_STRING_SET,
      selectedMemberLinkIndices: [],
      selectedLagId: null,
    });
  },

  clearEdgeSelection: () => {
    set({
      selectedEdgeId: null,
      selectedEdgeIds: [],
      selectedMemberLinkIndices: [],
      selectedLagId: null,
    });
  },

  syncSelectionFromReactFlow: (nodeIds: string[], edgeIds: string[]) => {
    if (get()._skipNextSelectionSync) {
      set({ _skipNextSelectionSync: false });
      return;
    }

    const nodes = get().nodes;
    const lastNodeId = nodeIds.length > 0 ? nodeIds[nodeIds.length - 1] : null;
    const lastEdgeId = edgeIds.length > 0 ? edgeIds[edgeIds.length - 1] : null;

    const selectedSimNodes = nodes.filter(n => nodeIds.includes(n.id) && n.data.nodeType === 'simnode');
    const simNames = selectedSimNodes.map(n => n.data.name);
    const lastSimName = simNames.length > 0 ? simNames[simNames.length - 1] : null;

    set({
      selectedNodeId: lastNodeId,
      selectedNodeIds: nodeIds,
      selectedEdgeId: lastEdgeId,
      selectedEdgeIds: edgeIds,
      selectedSimNodeName: lastSimName,
      selectedSimNodeNames: simNames.length === 0 ? EMPTY_STRING_SET : new Set(simNames),
      selectedMemberLinkIndices: [],
      selectedLagId: null,
    });
  },

  selectMemberLink: (edgeId: string, index: number | null, addToSelection?: boolean) => {
    const currentIndices = get().selectedMemberLinkIndices;
    const currentEdgeId = get().selectedEdgeId;

    let newIndices: number[];
    if (index === null) {
      newIndices = [];
    } else if (addToSelection && currentEdgeId === edgeId) {
      newIndices = toggleMemberLinkIndex(currentIndices, index);
    } else {
      newIndices = [index];
    }

    set({
      edges: get().edges.map(e => ({ ...e, selected: e.id === edgeId })),
      nodes: get().nodes.map(n => ({ ...n, selected: false })),
      _skipNextSelectionSync: true,
      selectedEdgeId: edgeId,
      selectedEdgeIds: [edgeId],
      selectedNodeId: null,
      selectedNodeIds: [],
      selectedSimNodeName: null,
      selectedSimNodeNames: EMPTY_STRING_SET,
      selectedMemberLinkIndices: newIndices,
      selectedLagId: null,
    });
  },

  selectLag: (edgeId: string, lagId: string | null) => {
    set({
      edges: get().edges.map(e => ({ ...e, selected: e.id === edgeId })),
      nodes: get().nodes.map(n => ({ ...n, selected: false })),
      _skipNextSelectionSync: true,
      selectedEdgeId: edgeId,
      selectedEdgeIds: [edgeId],
      selectedNodeId: null,
      selectedNodeIds: [],
      selectedSimNodeName: null,
      selectedSimNodeNames: EMPTY_STRING_SET,
      selectedMemberLinkIndices: [],
      selectedLagId: lagId,
    });
  },

  clearMemberLinkSelection: () => { set({ selectedMemberLinkIndices: [], selectedLagId: null }); },

  selectSimNode: (name: string | null) => {
    if (name === null) {
      set({
        selectedSimNodeName: null,
        selectedSimNodeNames: EMPTY_STRING_SET,
        selectedNodeId: null,
        selectedNodeIds: [],
        selectedEdgeId: null,
        selectedEdgeIds: [],
        selectedMemberLinkIndices: [],
        selectedLagId: null,
      });
      return;
    }

    const simNode = get().nodes.find(n => n.data.nodeType === 'simnode' && n.data.name === name);
    if (!simNode) return;

    set({
      selectedSimNodeName: name,
      selectedSimNodeNames: new Set([name]),
      selectedNodeId: simNode.id,
      selectedNodeIds: [simNode.id],
      selectedEdgeId: null,
      selectedEdgeIds: [],
      selectedMemberLinkIndices: [],
      selectedLagId: null,
    });
  },

  selectSimNodes: (names: Set<string>) => {
    const simNodeIds = get().nodes
      .filter(n => n.data.nodeType === 'simnode' && names.has(n.data.name))
      .map(n => n.id);
    const lastName = names.size > 0 ? [...names][names.size - 1] : null;
    const lastNode = lastName ? get().nodes.find(n => n.data.nodeType === 'simnode' && n.data.name === lastName) : null;

    set({
      selectedSimNodeNames: names.size === 0 ? EMPTY_STRING_SET : names,
      selectedSimNodeName: lastName,
      selectedNodeId: lastNode?.id || null,
      selectedNodeIds: simNodeIds,
    });
  },
});
