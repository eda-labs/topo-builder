/**
 * SimNode Store Slice
 *
 * Contains all simulation node-related actions for the topology store.
 */

import type { StateCreator } from 'zustand';

import type { UINode, UIEdge, UISimNode } from '../../types/ui';
import { validateSimNodeName } from '../utils';
import type { SimNodeTemplate } from '../../types/schema';

export interface SimNodeState {
  simulation: {
    simNodeTemplates: SimNodeTemplate[];
    simNodes: UISimNode[];
    topology?: unknown;
  };
}

export interface SimNodeActions {
  addSimNode: (params: { name: string; template?: string; position: { x: number; y: number } }) => void;
  updateSimNode: (name: string, data: Partial<UINode['data']>) => void;
  deleteSimNode: (name: string) => void;
}

export type SimNodeSlice = SimNodeState & SimNodeActions;

// ID generator - will be set from main store
let generateSimNodeId: () => string = () => `sim-${Date.now()}`;

export const setSimNodeIdGenerator = (fn: () => string) => {
  generateSimNodeId = fn;
};

export type SimNodeSliceCreator = StateCreator<
  SimNodeSlice & {
    nodes: UINode[];
    edges: UIEdge[];
    selectedNodeId: string | null;
    selectedEdgeId: string | null;
    selectedSimNodeName: string | null;
    triggerYamlRefresh: () => void;
    setError: (error: string | null) => void;
    saveToUndoHistory: () => void;
  },
  [],
  [],
  SimNodeSlice
>;

export const createSimNodeSlice: SimNodeSliceCreator = (set, get) => ({
  simulation: {
    simNodeTemplates: [],
    simNodes: [],
    topology: undefined,
  },

  addSimNode: (params: { name: string; template?: string; position: { x: number; y: number } }) => {
    get().saveToUndoHistory();
    const id = generateSimNodeId();
    const nodes = get().nodes;
    const { name, template, position } = params;

    const newNode: UINode = {
      id,
      type: 'simNode',
      position,
      selected: true,
      data: {
        id,
        name,
        nodeType: 'simnode',
        template,
        isNew: true,
      },
    };

    const deselectedNodes = nodes.map(n => ({ ...n, selected: false }));
    const deselectedEdges = get().edges.map(e => ({ ...e, selected: false }));
    set({
      nodes: [...deselectedNodes, newNode],
      edges: deselectedEdges,
      selectedNodeId: id,
      selectedEdgeId: null,
      selectedSimNodeName: name,
    } as Partial<SimNodeSlice>);
    get().triggerYamlRefresh();
  },

  updateSimNode: (name: string, data: Partial<UINode['data']>) => {
    const currentNode = get().nodes.find(n => n.data.nodeType === 'simnode' && n.data.name === name);
    if (!currentNode) return;

    const nodeId = currentNode.id;
    const newName = data.name;

    if (newName && newName !== name) {
      const allNodeNames = get().nodes.filter(n => n.id !== nodeId).map(n => n.data.name);
      const nameError = validateSimNodeName(newName, allNodeNames);
      if (nameError) {
        get().setError(`Invalid simNode name: ${nameError}`);
        return;
      }
    }

    // Update node in nodes array
    set({
      nodes: get().nodes.map(node =>
        node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node,
      ),
    });

    // Update edges if name changed
    if (newName && newName !== name) {
      set({
        edges: get().edges.map(edge => {
          if (!edge.data) return edge;
          const updates: Partial<typeof edge.data> = {};
          if (edge.data.sourceNode === name) updates.sourceNode = newName;
          if (edge.data.targetNode === name) updates.targetNode = newName;
          if (Object.keys(updates).length > 0) {
            return { ...edge, data: { ...edge.data, ...updates } };
          }
          return edge;
        }),
      });
    }
  },

  deleteSimNode: (name: string) => {
    get().saveToUndoHistory();
    const edges = get().edges;
    const node = get().nodes.find(n => n.data.nodeType === 'simnode' && n.data.name === name);
    if (!node) return;

    const nodeId = node.id;

    // Delete all edges connected to this simNode
    const edgesToKeep = edges.filter(edge => {
      // Check if this edge is connected to the simNode being deleted
      const isConnected = edge.source === nodeId || edge.target === nodeId;
      if (!isConnected) return true;

      // If it's an ESI-LAG, check if this simNode is a leaf
      if (edge.data?.edgeType === 'esilag' && edge.data.esiLeaves) {
        const isLeaf = edge.data.esiLeaves.some(leaf => leaf.nodeId === nodeId);
        if (isLeaf) return false;
      }

      return false;
    });

    set({
      nodes: get().nodes.filter(n => n.id !== nodeId),
      edges: edgesToKeep,
      selectedNodeId: get().selectedNodeId === nodeId ? null : get().selectedNodeId,
      selectedSimNodeName: name === get().selectedSimNodeName ? null : get().selectedSimNodeName,
    } as Partial<SimNodeSlice>);
    get().triggerYamlRefresh();
  },
});
