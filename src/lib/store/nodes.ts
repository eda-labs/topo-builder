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
import { ANNOTATION_NAME_PREFIX } from '../constants';
import type { NodeTemplate } from '../../types/schema';

import { deselectAllElements } from './storeUtils';
import type { StoreSliceDeps } from './storeUtils';

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
  NodeSlice & StoreSliceDeps & { nodeTemplates: NodeTemplate[] },
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
    const namePrefix = templateObj?.annotations?.[ANNOTATION_NAME_PREFIX] || 'node-';
    const name = generateUniqueName(namePrefix, allNodeNames, 1);

    const newNode: UINode = {
      id,
      type: 'topoNode',
      position,
      selected: true,
      data: { id, name, template, isNew: true },
    };

    const { nodes: deselectedNodes, edges: deselectedEdges } = deselectAllElements({
      nodes: get().nodes,
      edges: get().edges,
    });
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
      const namePrefix = newTemplateObj?.annotations?.[ANNOTATION_NAME_PREFIX];
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

    if (newName && newName !== oldName && oldName) {
      set({
        edges: get().edges.map(edge => {
          if (!edge.data) return edge;
          let updated = false;
          const updates: Partial<UIEdge['data']> = {};

          if (edge.data.sourceNode === oldName) {
            updates.sourceNode = newName;
            updated = true;
          }
          if (edge.data.targetNode === oldName) {
            updates.targetNode = newName;
            updated = true;
          }

          const memberLinks = edge.data.memberLinks;
          if (memberLinks?.length) {
            const updatedLinks = memberLinks.map(link => {
              if (link.name.includes(oldName)) {
                return { ...link, name: link.name.replaceAll(oldName, newName) };
              }
              return link;
            });
            if (updatedLinks.some((l, i) => l !== memberLinks[i])) {
              updates.memberLinks = updatedLinks;
              updated = true;
            }
          }

          const esiLeaves = edge.data.esiLeaves;
          if (esiLeaves?.length) {
            const updatedLeaves = esiLeaves.map(leaf => {
              if (leaf.nodeName === oldName) {
                return { ...leaf, nodeName: newName };
              }
              return leaf;
            });
            if (updatedLeaves.some((l, i) => l !== esiLeaves[i])) {
              updates.esiLeaves = updatedLeaves;
              updated = true;
            }
          }

          if (updated) {
            return { ...edge, data: { ...edge.data, ...updates } };
          }
          return edge;
        }),
      });
    }
    get().triggerYamlRefresh();
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
