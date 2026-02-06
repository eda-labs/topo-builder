/**
 * Store Composition
 *
 * Composes all domain slices into the main topology store.
 * This file orchestrates the creation of the store from domain slices.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Node, Edge } from '@xyflow/react';

import baseTemplateYaml from '../../static/base-template.yaml?raw';
import type { UINodeData, UIEdgeData, UISimNode, UIState } from '../../types/ui';
import type { Operation } from '../../types/schema';
import { EMPTY_STRING_SET, generateCopyName, getNameError } from '../utils';
import { yamlToUI, setIdCounters } from '../yaml-converter';

import { createNodeSlice, setNodeIdGenerator, type NodeSlice } from './nodes';
import { createLinkSlice, setEdgeIdGenerator, type LinkSlice } from './links';
import { createLagSlice, type LagSlice } from './lags';
import { createEsiLagSlice, setEsiLagEdgeIdGenerator, type EsiLagSlice } from './esiLags';
import { createSimNodeSlice, setSimNodeIdGenerator, type SimNodeSlice } from './simNodes';
import { createTemplateSlice, type TemplateSlice } from './templates';
import { createSelectionSlice, type SelectionSlice } from './selection';
import {
  captureState,
  pushToUndoHistory,
  pushToUndoHistoryForRedo,
  popFromUndoHistory,
  pushToRedoHistory,
  popFromRedoHistory,
  canUndo as historyCanUndo,
  canRedo as historyCanRedo,
  clearHistory,
} from './history';

// ID counters
let nodeIdCounter = 1;
let edgeIdCounter = 1;
let simNodeIdCounter = 1;

const generateNodeId = () => `node-${nodeIdCounter++}`;
const generateEdgeId = () => `edge-${edgeIdCounter++}`;
const generateSimNodeId = () => `sim-${simNodeIdCounter++}`;

// Set ID generators for slices
setNodeIdGenerator(generateNodeId);
setEdgeIdGenerator(generateEdgeId);
setEsiLagEdgeIdGenerator(generateEdgeId);
setSimNodeIdGenerator(generateSimNodeId);

// Core actions that span multiple domains
interface CoreState {
  topologyName: string;
  namespace: string;
  operation: Operation;
  showSimNodes: boolean;
  darkMode: boolean;
  yamlRefreshCounter: number;
  layoutVersion: number;
  error: string | null;
}

interface CoreActions {
  setError: (error: string | null) => void;
  setTopologyName: (name: string) => void;
  setNamespace: (namespace: string) => void;
  setOperation: (operation: Operation) => void;
  setDarkMode: (darkMode: boolean) => void;
  setShowSimNodes: (show: boolean) => void;
  triggerYamlRefresh: () => void;
  saveToUndoHistory: () => void;
  importFromYaml: (yaml: string) => boolean;
  clearAll: () => void;
  pasteSelection: (
    copiedNodes: Node<UINodeData>[],
    copiedEdges: Edge<UIEdgeData>[],
    offset: { x: number; y: number },
    copiedSimNodes?: UISimNode[],
    cursorPos?: { x: number; y: number },
  ) => void;
}

type CoreSlice = CoreState & CoreActions;

// Combined store type
export type TopologyStore =
  & CoreSlice
  & NodeSlice
  & LinkSlice
  & LagSlice
  & EsiLagSlice
  & SimNodeSlice
  & TemplateSlice
  & SelectionSlice;

// Parse base template from YAML file
function parseBaseTemplate(): Partial<UIState> {
  try {
    const result = yamlToUI(baseTemplateYaml);
    if (result) {
      return {
        topologyName: result.topologyName,
        namespace: result.namespace,
        operation: result.operation,
        nodeTemplates: result.nodeTemplates,
        linkTemplates: result.linkTemplates,
        simulation: result.simulation,
      };
    }
    return {};
  } catch (e) {
    console.error('Failed to parse base template:', e);
    return {};
  }
}

const baseTemplate = parseBaseTemplate();

// Default initial state
const initialCoreState: CoreState = {
  topologyName: baseTemplate.topologyName || 'my-topology',
  namespace: baseTemplate.namespace || 'eda',
  operation: baseTemplate.operation || 'replaceAll',
  showSimNodes: true,
  darkMode: true,
  yamlRefreshCounter: 0,
  layoutVersion: 0,
  error: null,
};

export const createTopologyStore = () => {
  return create<TopologyStore>()(
    persist(
      (set, get, api) => {
        // Create core slice
        const coreSlice: CoreSlice = {
          ...initialCoreState,

          setError: (error: string | null) => set({ error }),

          setTopologyName: (name: string) => {
            const nameError = getNameError(name);
            if (nameError) {
              get().setError(`Invalid topology name: ${nameError}`);
              return;
            }
            set({ topologyName: name });
          },

          setNamespace: (namespace: string) => {
            const nameError = getNameError(namespace);
            if (nameError) {
              get().setError(`Invalid namespace: ${nameError}`);
              return;
            }
            set({ namespace });
          },

          setOperation: (operation: Operation) => set({ operation }),
          setDarkMode: (darkMode: boolean) => set({ darkMode }),
          setShowSimNodes: (show: boolean) => set({ showSimNodes: show }),
          triggerYamlRefresh: () => set({ yamlRefreshCounter: get().yamlRefreshCounter + 1 }),

          saveToUndoHistory: () => {
            const state = get();
            pushToUndoHistory(captureState(state));
          },

          importFromYaml: (yamlString: string): boolean => {
            const result = yamlToUI(yamlString, {
              existingNodes: get().nodes,
              existingEdges: get().edges,
              existingSimNodes: get().simulation.simNodes,
            });

            if (!result) return false;

            set({
              topologyName: result.topologyName,
              namespace: result.namespace,
              operation: result.operation,
              nodeTemplates: result.nodeTemplates,
              linkTemplates: result.linkTemplates,
              nodes: result.nodes,
              edges: result.edges,
              simulation: result.simulation,
              layoutVersion: get().layoutVersion + 1,
            });

            return true;
          },

          clearAll: () => {
            get().saveToUndoHistory();
            nodeIdCounter = 1;
            edgeIdCounter = 1;
            const { darkMode, showSimNodes, yamlRefreshCounter } = get();
            set({
              ...initialCoreState,
              nodes: [],
              edges: [],
              expandedEdges: new Set<string>(),
              nodeTemplates: baseTemplate.nodeTemplates || [],
              linkTemplates: baseTemplate.linkTemplates || [],
              simulation: baseTemplate.simulation || { simNodeTemplates: [], simNodes: [] },
              selectedNodeId: null,
              selectedNodeIds: [],
              selectedEdgeId: null,
              selectedEdgeIds: [],
              selectedSimNodeName: null,
              selectedSimNodeNames: EMPTY_STRING_SET,
              selectedMemberLinkIndices: [],
              selectedLagId: null,
              darkMode,
              showSimNodes,
              yamlRefreshCounter: yamlRefreshCounter + 1,
            });
          },

          pasteSelection: (
            copiedNodes: Node<UINodeData>[],
            copiedEdges: Edge<UIEdgeData>[],
            offset: { x: number; y: number },
            copiedSimNodes?: UISimNode[],
            cursorPos?: { x: number; y: number },
          ) => {
            if (copiedNodes.length === 0 && (!copiedSimNodes || copiedSimNodes.length === 0)) return;
            get().saveToUndoHistory();

            const existingNodes = get().nodes;
            const existingEdges = get().edges;
            const allNames = existingNodes.map(n => n.data.name);

            const idMap = new Map<string, string>();
            const nameMap = new Map<string, string>();

            const newNodes: Node<UINodeData>[] = copiedNodes.map(node => {
              const newId = generateNodeId();
              idMap.set(node.id, newId);
              const newName = generateCopyName(node.data.name, allNames);
              allNames.push(newName);
              nameMap.set(node.data.name, newName);

              return {
                ...node,
                id: newId,
                position: { x: node.position.x + offset.x, y: node.position.y + offset.y },
                selected: true,
                data: { ...node.data, id: newId, name: newName },
              };
            });

            // Process simNodes first so their IDs are in idMap for edge filtering
            const newSimNodeNodes: Node<UINodeData>[] = [];
            const newSimNodeNames: string[] = [];
            if (copiedSimNodes && copiedSimNodes.length > 0) {
              for (const simNode of copiedSimNodes) {
                const newName = generateCopyName(simNode.name, allNames);
                allNames.push(newName);
                newSimNodeNames.push(newName);
                const newId = generateSimNodeId();

                // Add to idMap so edges connecting to simNodes will pass the filter
                idMap.set(simNode.id, newId);
                nameMap.set(simNode.name, newName);

                const position = simNode.position
                  ? { x: simNode.position.x + offset.x, y: simNode.position.y + offset.y }
                  : cursorPos || { x: 0, y: 0 };

                newSimNodeNodes.push({
                  id: newId,
                  type: 'simNode',
                  position,
                  selected: true,
                  data: {
                    id: newId,
                    name: newName,
                    nodeType: 'simnode',
                    template: simNode.template,
                    simNodeType: simNode.type,
                    image: simNode.image,
                    labels: simNode.labels,
                  },
                });
              }
            }

            // Now filter edges - both regular node IDs and simNode IDs are in idMap
            const newEdges: Edge<UIEdgeData>[] = [];
            for (const edge of copiedEdges) {
              if (!idMap.has(edge.source) || !idMap.has(edge.target)) continue;

              const newSource = idMap.get(edge.source);
              const newTarget = idMap.get(edge.target);
              if (!newSource || !newTarget) continue;

              const newId = generateEdgeId();
              const newSourceName = nameMap.get(edge.data?.sourceNode || '') || edge.data?.sourceNode;
              const newTargetName = nameMap.get(edge.data?.targetNode || '') || edge.data?.targetNode;

              const memberLinks = edge.data?.memberLinks?.map(link => ({
                ...link,
                name: `${newTargetName}-${newSourceName}-${link.name.split('-').pop() || '1'}`,
              }));

              const lagGroups = edge.data?.lagGroups?.map(lag => ({
                ...lag,
                name: lag.name
                  .replace(new RegExp(`(^|-)${edge.data?.sourceNode}(-|$)`, 'g'), `$1${newSourceName}$2`)
                  .replace(new RegExp(`(^|-)${edge.data?.targetNode}(-|$)`, 'g'), `$1${newTargetName}$2`),
                memberLinkIndices: [...lag.memberLinkIndices],
              }));

              const esiLeaves = edge.data?.esiLeaves?.map(leaf => ({
                nodeId: idMap.get(leaf.nodeId) || leaf.nodeId,
                nodeName: nameMap.get(leaf.nodeName) || leaf.nodeName,
              }));

              const esiLagName = edge.data?.esiLagName && edge.data.sourceNode
                ? edge.data.esiLagName.replace(
                  edge.data.sourceNode,
                  newSourceName || edge.data.sourceNode,
                )
                : edge.data?.esiLagName;

              newEdges.push({
                ...edge,
                id: newId,
                source: newSource,
                target: newTarget,
                selected: true,
                data: edge.data ? {
                  ...edge.data,
                  id: newId,
                  sourceNode: newSourceName || '',
                  targetNode: newTargetName || '',
                  memberLinks,
                  lagGroups,
                  esiLeaves,
                  esiLagName,
                } : undefined,
              });
            }

            const allNewNodes = [...newNodes, ...newSimNodeNodes];
            const allNewNodeIds = allNewNodes.map(n => n.id);

            // Deselect existing nodes and edges to ensure only pasted items are selected
            // This prevents selection state mismatch where original nodes have selected: true
            // but their IDs are not in selectedNodeIds
            const deselectedExistingNodes = existingNodes.map(n => ({ ...n, selected: false }));
            const deselectedExistingEdges = existingEdges.map(e => ({ ...e, selected: false }));

            set({
              nodes: [...deselectedExistingNodes, ...allNewNodes],
              edges: [...deselectedExistingEdges, ...newEdges],
              selectedNodeId: allNewNodeIds.length > 0 ? allNewNodeIds[allNewNodeIds.length - 1] : null,
              selectedNodeIds: allNewNodeIds,
              selectedEdgeId: allNewNodes.length === 0 && newEdges.length > 0 ? newEdges[newEdges.length - 1].id : null,
              selectedEdgeIds: newEdges.map(e => e.id),
              selectedSimNodeName: newSimNodeNames.length > 0 ? newSimNodeNames[newSimNodeNames.length - 1] : null,
              selectedSimNodeNames: new Set(newSimNodeNames),
              selectedMemberLinkIndices: [],
              selectedLagId: null,
            });
            get().triggerYamlRefresh();
          },
        };

        // Compose all slices
        // Using 'as any' for slice creators due to complex generic inference across slices
        /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument */
        return {
          ...coreSlice,
          ...createNodeSlice(set as any, get as any, api as any),
          ...createLinkSlice(set as any, get as any, api as any),
          ...createLagSlice(set as any, get as any, api as any),
          ...createEsiLagSlice(set as any, get as any, api as any),
          ...createSimNodeSlice(set as any, get as any, api as any),
          ...createTemplateSlice(set as any, get as any, api as any),
          ...createSelectionSlice(set as any, get as any, api as any),
          /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument */

          // Override initial state from base template
          nodeTemplates: baseTemplate.nodeTemplates || [],
          linkTemplates: baseTemplate.linkTemplates || [],
          simulation: baseTemplate.simulation || { simNodeTemplates: [], simNodes: [] },
        };
      },
      {
        name: 'topology-storage',
        partialize: state => ({
          ...state,
          expandedEdges: Array.from(state.expandedEdges),
          selectedSimNodeNames: Array.from(state.selectedSimNodeNames),
        }),
        merge: (persistedState, currentState) => {
          const persisted = persistedState as Partial<UIState> & { expandedEdges?: string[]; selectedSimNodeNames?: string[] };
          const nodes = persisted.nodes?.map(node => ({ ...node, data: { ...node.data, isNew: false } })) || currentState.nodes;

          // Migrate edges: infer edgeType from lagGroups/esiLeaves
          let edges = persisted.edges || currentState.edges;
          edges = edges.map(edge => {
            if (edge.data && !edge.data.edgeType) {
              let edgeType: 'normal' | 'lag' | 'esilag' = 'normal';
              if (edge.data.esiLeaves) edgeType = 'esilag';
              else if (edge.data.lagGroups && edge.data.lagGroups.length > 0) edgeType = 'lag';
              return { ...edge, data: { ...edge.data, edgeType } };
            }
            return edge;
          });

          const expandedEdges = persisted.expandedEdges ? new Set(persisted.expandedEdges) : currentState.expandedEdges;
          const selectedSimNodeNames = persisted.selectedSimNodeNames ? new Set(persisted.selectedSimNodeNames) : currentState.selectedSimNodeNames;

          return {
            ...currentState,
            ...persisted,
            nodes,
            edges,
            expandedEdges,
            selectedSimNodeNames,
            nodeTemplates: persisted.nodeTemplates?.length ? persisted.nodeTemplates : (baseTemplate.nodeTemplates || []),
            linkTemplates: persisted.linkTemplates?.length ? persisted.linkTemplates : (baseTemplate.linkTemplates || []),
          };
        },
        onRehydrateStorage: () => state => {
          if (state) {
            let maxNodeId = 0;
            let maxSimNodeId = 0;
            for (const node of state.nodes) {
              const parts = node.id.split('-');
              const prefix = parts[0];
              const num = parseInt(parts[1] || '0', 10);
              if (prefix === 'sim') maxSimNodeId = Math.max(maxSimNodeId, num);
              else if (prefix === 'node') maxNodeId = Math.max(maxNodeId, num);
            }
            const maxEdgeId = state.edges.reduce((max, edge) => {
              const num = parseInt(edge.id.split('-')[1] || '0', 10);
              return Math.max(max, num);
            }, 0);
            nodeIdCounter = maxNodeId + 1;
            edgeIdCounter = maxEdgeId + 1;
            simNodeIdCounter = maxSimNodeId + 1;
            setIdCounters(nodeIdCounter, edgeIdCounter, simNodeIdCounter);
          }
        },
      },
    ),
  );
};

// Singleton store instance
export const useTopologyStore = createTopologyStore();

// Undo/Redo exports
export const saveToUndoHistory = () => {
  const state = useTopologyStore.getState();
  pushToUndoHistory(captureState(state));
};

export const undo = () => {
  if (!historyCanUndo()) return;
  const previousState = popFromUndoHistory();
  if (!previousState) return;
  const state = useTopologyStore.getState();
  pushToRedoHistory(captureState(state));
  useTopologyStore.setState({
    nodes: previousState.nodes,
    edges: previousState.edges,
    simulation: previousState.simulation,
    nodeTemplates: previousState.nodeTemplates,
    linkTemplates: previousState.linkTemplates,
    topologyName: previousState.topologyName,
    namespace: previousState.namespace,
    selectedNodeId: null,
    selectedNodeIds: [],
    selectedEdgeId: null,
    selectedEdgeIds: [],
    selectedSimNodeName: null,
    selectedMemberLinkIndices: [],
    selectedLagId: null,
  });
};

export const redo = () => {
  if (!historyCanRedo()) return;
  const nextState = popFromRedoHistory();
  if (!nextState) return;
  const state = useTopologyStore.getState();
  pushToUndoHistoryForRedo(captureState(state));
  useTopologyStore.setState({
    nodes: nextState.nodes,
    edges: nextState.edges,
    simulation: nextState.simulation,
    nodeTemplates: nextState.nodeTemplates,
    linkTemplates: nextState.linkTemplates,
    topologyName: nextState.topologyName,
    namespace: nextState.namespace,
    selectedNodeId: null,
    selectedNodeIds: [],
    selectedEdgeId: null,
    selectedEdgeIds: [],
    selectedSimNodeName: null,
    selectedMemberLinkIndices: [],
    selectedLagId: null,
  });
};

export const canUndo = historyCanUndo;
export const canRedo = historyCanRedo;
export const clearUndoHistory = clearHistory;

// Re-export utilities
export { generateUniqueName, generateCopyName } from '../utils';
export { exportToYaml, downloadYaml } from '../yaml-converter';
