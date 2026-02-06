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

import {
  createNodeSlice,
  setNodeIdGenerator,
  type NodeSlice,
  createLinkSlice,
  setEdgeIdGenerator,
  type LinkSlice,
  createLagSlice,
  type LagSlice,
  createEsiLagSlice,
  setEsiLagEdgeIdGenerator,
  type EsiLagSlice,
  createSimNodeSlice,
  setSimNodeIdGenerator,
  type SimNodeSlice,
  createTemplateSlice,
  type TemplateSlice,
  createSelectionSlice,
  type SelectionSlice,
} from './slices';
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

type StoreSetFn = (partial: Partial<TopologyStore>) => void;

function buildPastedNodes({
  copiedNodes,
  offset,
  allNames,
  idMap,
  nameMap,
}: {
  copiedNodes: Node<UINodeData>[];
  offset: { x: number; y: number };
  allNames: string[];
  idMap: Map<string, string>;
  nameMap: Map<string, string>;
}): Node<UINodeData>[] {
  return copiedNodes.map(node => {
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
}

function getSimNodePastePosition(
  simNode: UISimNode,
  offset: { x: number; y: number },
  cursorPos: { x: number; y: number } | undefined,
): { x: number; y: number } {
  if (simNode.position) return { x: simNode.position.x + offset.x, y: simNode.position.y + offset.y };
  if (cursorPos) return cursorPos;
  return { x: 0, y: 0 };
}

function buildPastedSimNodeNodes({
  copiedSimNodes,
  offset,
  cursorPos,
  allNames,
  idMap,
  nameMap,
}: {
  copiedSimNodes: UISimNode[] | undefined;
  offset: { x: number; y: number };
  cursorPos: { x: number; y: number } | undefined;
  allNames: string[];
  idMap: Map<string, string>;
  nameMap: Map<string, string>;
}): { newSimNodeNodes: Node<UINodeData>[]; newSimNodeNames: string[] } {
  const newSimNodeNodes: Node<UINodeData>[] = [];
  const newSimNodeNames: string[] = [];
  if (!copiedSimNodes || copiedSimNodes.length === 0) return { newSimNodeNodes, newSimNodeNames };

  for (const simNode of copiedSimNodes) {
    const newName = generateCopyName(simNode.name, allNames);
    allNames.push(newName);
    newSimNodeNames.push(newName);

    const newId = generateSimNodeId();

    // Add to idMap so edges connecting to simNodes will pass the filter.
    idMap.set(simNode.id, newId);
    nameMap.set(simNode.name, newName);

    newSimNodeNodes.push({
      id: newId,
      type: 'simNode',
      position: getSimNodePastePosition(simNode, offset, cursorPos),
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

  return { newSimNodeNodes, newSimNodeNames };
}

function getLinkNameSuffix(name: string): string {
  const parts = name.split('-');
  const last = parts.length > 0 ? parts[parts.length - 1] : '';
  return last || '1';
}

function remapMemberLinks(
  memberLinks: UIEdgeData['memberLinks'] | undefined,
  newTargetName: string,
  newSourceName: string,
): UIEdgeData['memberLinks'] | undefined {
  if (!memberLinks) return undefined;

  return memberLinks.map(link => ({
    ...link,
    name: `${newTargetName}-${newSourceName}-${getLinkNameSuffix(link.name)}`,
  }));
}

function replaceLagNameSegment(lagName: string, oldName: string, newName: string): string {
  return lagName.replace(new RegExp(`(^|-)${oldName}(-|$)`, 'g'), `$1${newName}$2`);
}

function remapLagGroups(
  lagGroups: UIEdgeData['lagGroups'] | undefined,
  oldSourceName: string,
  oldTargetName: string,
  newSourceName: string,
  newTargetName: string,
): UIEdgeData['lagGroups'] | undefined {
  if (!lagGroups) return undefined;

  return lagGroups.map(lag => ({
    ...lag,
    name: replaceLagNameSegment(
      replaceLagNameSegment(lag.name, oldSourceName, newSourceName),
      oldTargetName,
      newTargetName,
    ),
    memberLinkIndices: [...lag.memberLinkIndices],
  }));
}

function remapEsiLeaves(
  esiLeaves: UIEdgeData['esiLeaves'] | undefined,
  idMap: Map<string, string>,
  nameMap: Map<string, string>,
): UIEdgeData['esiLeaves'] | undefined {
  if (!esiLeaves) return undefined;

  return esiLeaves.map(leaf => ({
    nodeId: idMap.get(leaf.nodeId) || leaf.nodeId,
    nodeName: nameMap.get(leaf.nodeName) || leaf.nodeName,
  }));
}

function remapEsiLagName(
  esiLagName: string | undefined,
  oldSourceName: string,
  newSourceName: string,
): string | undefined {
  if (!esiLagName) return undefined;
  if (!oldSourceName) return esiLagName;
  return esiLagName.replace(oldSourceName, newSourceName || oldSourceName);
}

function remapCopiedEdge({
  edge,
  idMap,
  nameMap,
}: {
  edge: Edge<UIEdgeData>;
  idMap: Map<string, string>;
  nameMap: Map<string, string>;
}): Edge<UIEdgeData> | null {
  if (!idMap.has(edge.source) || !idMap.has(edge.target)) return null;

  const newSource = idMap.get(edge.source);
  const newTarget = idMap.get(edge.target);
  if (!newSource || !newTarget) return null;

  const newId = generateEdgeId();

  const oldSourceName = edge.data?.sourceNode || '';
  const oldTargetName = edge.data?.targetNode || '';
  const newSourceName = nameMap.get(oldSourceName) || oldSourceName;
  const newTargetName = nameMap.get(oldTargetName) || oldTargetName;

  return {
    ...edge,
    id: newId,
    source: newSource,
    target: newTarget,
    selected: true,
    data: edge.data
      ? {
        ...edge.data,
        id: newId,
        sourceNode: newSourceName,
        targetNode: newTargetName,
        memberLinks: remapMemberLinks(edge.data.memberLinks, newTargetName, newSourceName),
        lagGroups: remapLagGroups(edge.data.lagGroups, oldSourceName, oldTargetName, newSourceName, newTargetName),
        esiLeaves: remapEsiLeaves(edge.data.esiLeaves, idMap, nameMap),
        esiLagName: remapEsiLagName(edge.data.esiLagName, oldSourceName, newSourceName),
      }
      : undefined,
  };
}

function buildPastedEdges({
  copiedEdges,
  idMap,
  nameMap,
}: {
  copiedEdges: Edge<UIEdgeData>[];
  idMap: Map<string, string>;
  nameMap: Map<string, string>;
}): Edge<UIEdgeData>[] {
  const newEdges: Edge<UIEdgeData>[] = [];

  for (const edge of copiedEdges) {
    const remapped = remapCopiedEdge({ edge, idMap, nameMap });
    if (remapped) newEdges.push(remapped);
  }

  return newEdges;
}

function applyPasteSelectionToStore({
  set,
  existingNodes,
  existingEdges,
  newNodes,
  newEdges,
  newSimNodeNames,
}: {
  set: StoreSetFn;
  existingNodes: Node<UINodeData>[];
  existingEdges: Edge<UIEdgeData>[];
  newNodes: Node<UINodeData>[];
  newEdges: Edge<UIEdgeData>[];
  newSimNodeNames: string[];
}) {
  const allNewNodes = newNodes;
  const allNewNodeIds = allNewNodes.map(n => n.id);

  // Deselect existing nodes and edges to ensure only pasted items are selected.
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
}

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

            const state = get();
            const existingNodes = state.nodes;
            const existingEdges = state.edges;
            const allNames = existingNodes.map(n => n.data.name);

            const idMap = new Map<string, string>();
            const nameMap = new Map<string, string>();

            const newNodes = buildPastedNodes({ copiedNodes, offset, allNames, idMap, nameMap });

            // Process simNodes first so their IDs are in idMap for edge filtering.
            const { newSimNodeNodes, newSimNodeNames } = buildPastedSimNodeNodes({
              copiedSimNodes,
              offset,
              cursorPos,
              allNames,
              idMap,
              nameMap,
            });

            // Now filter edges - both regular node IDs and simNode IDs are in idMap.
            const newEdges = buildPastedEdges({ copiedEdges, idMap, nameMap });

            applyPasteSelectionToStore({
              set: set as StoreSetFn,
              existingNodes,
              existingEdges,
              newNodes: [...newNodes, ...newSimNodeNodes],
              newEdges,
              newSimNodeNames,
            });

            state.triggerYamlRefresh();
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
