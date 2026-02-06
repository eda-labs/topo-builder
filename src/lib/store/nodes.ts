/**
 * Node Store Slice
 *
 * Contains all node-related actions for the topology store.
 */

import type { StateCreator } from 'zustand';
import type { Node, NodeChange } from '@xyflow/react';
import { applyNodeChanges } from '@xyflow/react';

import type { UINodeData, UINode, UIEdge } from '../../types/ui';
import { generateUniqueName, validateNodeName } from '../utils';
import { LABEL_NAME_PREFIX } from '../constants';
import type { NodeTemplate } from '../../types/schema';

export interface NodeState {
  nodes: UINode[];
}

export interface NodeActions {
  addNode: (position: { x: number; y: number }, templateName?: string) => void;
  updateNode: (id: string, data: Partial<UINodeData>) => void;
  deleteNode: (id: string) => void;
  onNodesChange: (changes: NodeChange<Node<UINodeData>>[]) => void;
}

export type NodeSlice = NodeState & NodeActions;

// ID generator - will be set from main store
let generateNodeId: () => string = () => `node-${Date.now()}`;

export const setNodeIdGenerator = (fn: () => string) => {
  generateNodeId = fn;
};

export type NodeSliceCreator = StateCreator<
  NodeSlice & {
    nodeTemplates: NodeTemplate[];
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
  NodeSlice
>;

export const createNodeSlice: NodeSliceCreator = (set, get) => ({
  nodes: [],

  addNode: (position: { x: number; y: number }, templateName?: string) => {
    get().saveToUndoHistory();
    const id = generateNodeId();
    const allNodeNames = get().nodes.map(n => n.data.name);
    const template = templateName || get().nodeTemplates[0]?.name;
    const templateObj = get().nodeTemplates.find(t => t.name === template);
    const namePrefix = templateObj?.labels?.[LABEL_NAME_PREFIX] || 'node';
    const name = generateUniqueName(namePrefix, allNodeNames, 1);

    const newNode: UINode = {
      id,
      type: 'topoNode',
      position,
      selected: true,
      data: { id, name, template, isNew: true },
    };

    const deselectedNodes = get().nodes.map(n => ({ ...n, selected: false }));
    const deselectedEdges = get().edges.map(e => ({ ...e, selected: false }));
    set({
      nodes: [...deselectedNodes, newNode],
      edges: deselectedEdges,
      selectedNodeId: id,
      selectedEdgeId: null,
      selectedSimNodeName: null,
    } as Partial<NodeSlice>);
    get().triggerYamlRefresh();
  },

  updateNode: (id: string, data: Partial<UINodeData>) => {
    const currentNode = get().nodes.find(n => n.id === id);
    const oldName = currentNode?.data.name;
    let newName = data.name;

    if (data.template && data.template !== currentNode?.data.template && !data.name) {
      const newTemplateObj = get().nodeTemplates.find(t => t.name === data.template);
      const namePrefix = newTemplateObj?.labels?.[LABEL_NAME_PREFIX];
      if (namePrefix) {
        const allNodeNames = get().nodes.filter(n => n.id !== id).map(n => n.data.name);
        newName = generateUniqueName(namePrefix, allNodeNames, 1);
        data = { ...data, name: newName };
      }
    }

    if (newName && newName !== oldName) {
      const allNodeNames = get().nodes.filter(n => n.id !== id).map(n => n.data.name);
      const nameError = validateNodeName(newName, allNodeNames);
      if (nameError) {
        get().setError(`Invalid node name: ${nameError}`);
        return;
      }
    }

    set({
      nodes: get().nodes.map(node =>
        node.id === id ? { ...node, data: { ...node.data, ...data } } : node,
      ),
    });
  },

  deleteNode: (id: string) => {
    get().saveToUndoHistory();
    set({
      nodes: get().nodes.filter(node => node.id !== id),
      edges: get().edges.filter(edge => edge.source !== id && edge.target !== id),
      selectedNodeId: get().selectedNodeId === id ? null : get().selectedNodeId,
    } as Partial<NodeSlice>);
    get().triggerYamlRefresh();
  },

  onNodesChange: (changes: NodeChange<Node<UINodeData>>[]) => {
    set({ nodes: applyNodeChanges(changes, get().nodes) });
    const hasRemove = changes.some(c => c.type === 'remove');
    const hasDragEnd = changes.some(c => c.type === 'position' && c.dragging === false);
    if (hasRemove || hasDragEnd) get().triggerYamlRefresh();
  },
});
