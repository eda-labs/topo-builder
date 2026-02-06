/**
 * ESI-LAG Store Slice
 *
 * Contains all ESI-LAG-related actions for the topology store.
 */

import type { StateCreator } from 'zustand';
import type { Edge } from '@xyflow/react';

import type { UIEdge, UIEdgeData, UIMemberLink, UINode, UIEsiLeaf } from '../../types/ui';
import {
  findCommonNode,
  validateEsiLagEdges,
  createEsiLeaf,
  generateEsiLagName,
  incrementInterface,
} from '../utils';
import { DEFAULT_INTERFACE } from '../constants';

// ESI-LAG state is stored within edges (UIEdgeData.esiLeaves)
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface EsiLagState {}

export interface EsiLagActions {
  createMultihomedLag: (edgeId1: string, edgeId2: string, additionalEdgeIds?: string[]) => void;
  addLinkToEsiLag: (edgeId: string) => void;
  removeLinkFromEsiLag: (edgeId: string, leafIndex: number) => void;
  mergeEdgesIntoEsiLag: (esiLagId: string, edgeIds: string[]) => void;
}

export type EsiLagSlice = EsiLagState & EsiLagActions;

// ID generator - will be set from main store
let generateEdgeId: () => string = () => `edge-${Date.now()}`;

export const setEsiLagEdgeIdGenerator = (fn: () => string) => {
  generateEdgeId = fn;
};

export type EsiLagSliceCreator = StateCreator<
  EsiLagSlice & {
    nodes: UINode[];
    edges: UIEdge[];
    selectedEdgeId: string | null;
    selectedEdgeIds: string[];
    selectedMemberLinkIndices: number[];
    selectedLagId: string | null;
    triggerYamlRefresh: () => void;
    setError: (error: string | null) => void;
  },
  [],
  [],
  EsiLagSlice
>;

export const createEsiLagSlice: EsiLagSliceCreator = (set, get) => ({
  createMultihomedLag: (edgeId1: string, edgeId2: string, additionalEdgeIds?: string[]) => {
    const edges = get().edges;
    const nodes = get().nodes;

    const allEdgeIds = [edgeId1, edgeId2, ...(additionalEdgeIds || [])];
    const selectedEdges = allEdgeIds
      .map(id => edges.find(e => e.id === id))
      .filter((e): e is Edge<UIEdgeData> => e !== undefined && e.data !== undefined);

    const validationError = validateEsiLagEdges(selectedEdges.length);
    if (validationError) {
      get().setError(validationError);
      return;
    }

    const findNodeById = (id: string) => {
      const node = nodes.find(n => n.id === id);
      return node ? { id, name: node.data.name, isSimNode: id.startsWith('sim-') } : null;
    };

    const edgeNodes = selectedEdges.map(e => ({ source: e.source, target: e.target }));
    const commonNodeId = findCommonNode(edgeNodes);
    if (!commonNodeId) {
      get().setError('Selected edges must all share exactly one common node');
      return;
    }

    const commonNodeInfo = findNodeById(commonNodeId);
    if (!commonNodeInfo) {
      get().setError('Could not find common node');
      return;
    }

    const leafConnections: Array<{
      nodeId: string;
      nodeName: string;
      memberLinks: UIMemberLink[];
    }> = [];

    for (const edge of selectedEdges) {
      const leafId = edge.source === commonNodeId ? edge.target : edge.source;
      const leafInfo = findNodeById(leafId);
      if (!leafInfo) {
        get().setError('Could not find all leaf nodes');
        return;
      }

      leafConnections.push({
        nodeId: leafId,
        nodeName: leafInfo.name,
        memberLinks: edge.data?.memberLinks || [],
      });
    }

    const firstLeaf = leafConnections[0];
    const allMemberLinks = leafConnections.flatMap(lc => lc.memberLinks);
    const newEdgeId = generateEdgeId();

    const esiLeaves: UIEsiLeaf[] = leafConnections.map(lc =>
      createEsiLeaf(lc.nodeId, lc.nodeName),
    );

    const newEdge: UIEdge = {
      id: newEdgeId,
      source: commonNodeId,
      target: firstLeaf.nodeId,
      type: 'linkEdge',
      data: {
        id: newEdgeId,
        sourceNode: commonNodeInfo.name,
        targetNode: firstLeaf.nodeName,
        edgeType: 'esilag',
        memberLinks: allMemberLinks,
        esiLeaves,
        esiLagName: generateEsiLagName(commonNodeInfo.name),
      },
    };

    const edgeIdsToRemove = new Set(allEdgeIds);
    set({
      edges: [...edges.filter(e => !edgeIdsToRemove.has(e.id)), newEdge],
      selectedEdgeId: newEdgeId,
      selectedEdgeIds: [newEdgeId],
      selectedMemberLinkIndices: [],
      selectedLagId: null,
    });
    get().triggerYamlRefresh();
  },

  addLinkToEsiLag: (edgeId: string) => {
    const edges = get().edges;
    const edge = edges.find(e => e.id === edgeId);
    if (!edge || edge.data?.edgeType !== 'esilag' || !edge.data.esiLeaves) return;

    const esiLeaves = edge.data.esiLeaves;
    const memberLinks = edge.data.memberLinks || [];
    if (esiLeaves.length >= 4) return;

    const lastLeaf = esiLeaves[esiLeaves.length - 1];
    const lastMemberLink = memberLinks[memberLinks.length - 1];

    const newMemberLink: UIMemberLink = {
      name: `${edge.data.sourceNode}-${lastLeaf.nodeName}-${memberLinks.length + 1}`,
      sourceInterface: incrementInterface(lastMemberLink?.sourceInterface || DEFAULT_INTERFACE, esiLeaves.length + 1),
      targetInterface: incrementInterface(lastMemberLink?.targetInterface || DEFAULT_INTERFACE, esiLeaves.length + 1),
    };

    set({
      edges: edges.map(e =>
        e.id === edgeId && e.data
          ? {
            ...e,
            data: {
              ...e.data,
              memberLinks: [...memberLinks, newMemberLink],
              esiLeaves: [...esiLeaves, { ...lastLeaf }],
            },
          }
          : e,
      ),
    });
    get().triggerYamlRefresh();
  },

  removeLinkFromEsiLag: (edgeId: string, leafIndex: number) => {
    const edges = get().edges;
    const edge = edges.find(e => e.id === edgeId);
    if (!edge || edge.data?.edgeType !== 'esilag' || !edge.data.esiLeaves) return;

    const esiLeaves = edge.data.esiLeaves;
    const memberLinks = edge.data.memberLinks || [];
    if (esiLeaves.length <= 2) return;

    set({
      edges: edges.map(e =>
        e.id === edgeId && e.data
          ? {
            ...e,
            data: {
              ...e.data,
              memberLinks: memberLinks.filter((_, i) => i !== leafIndex),
              esiLeaves: esiLeaves.filter((_, i) => i !== leafIndex),
            },
          }
          : e,
      ),
    });
    get().triggerYamlRefresh();
  },

  mergeEdgesIntoEsiLag: (esiLagId: string, edgeIds: string[]) => {
    const edges = get().edges;
    const nodes = get().nodes;

    const esiLagEdge = edges.find(e => e.id === esiLagId);
    if (!esiLagEdge || esiLagEdge.data?.edgeType !== 'esilag' || !esiLagEdge.data.esiLeaves) return;

    const edgesToMerge = edgeIds
      .map(id => edges.find(e => e.id === id))
      .filter((e): e is Edge<UIEdgeData> => e !== undefined && e.data?.edgeType !== 'esilag');

    if (edgesToMerge.length === 0) return;

    const currentLeaves = esiLagEdge.data.esiLeaves;
    const currentMemberLinks = esiLagEdge.data.memberLinks || [];

    if (currentLeaves.length + edgesToMerge.length > 4) {
      get().setError('ESI-LAG cannot have more than 4 links');
      return;
    }

    const commonNodeId = esiLagEdge.source;
    const findNodeById = (id: string) => {
      const node = nodes.find(n => n.id === id);
      return node ? { id, name: node.data.name, isSimNode: id.startsWith('sim-') } : null;
    };

    const newLeaves = [...currentLeaves];
    const newMemberLinks = [...currentMemberLinks];

    for (const edge of edgesToMerge) {
      const leafId = edge.source === commonNodeId ? edge.target : edge.source;
      const leafInfo = findNodeById(leafId);
      if (!leafInfo) continue;

      newLeaves.push(createEsiLeaf(leafId, leafInfo.name));
      newMemberLinks.push(...(edge.data?.memberLinks || []));
    }

    const edgeIdsToRemove = new Set(edgeIds);
    set({
      edges: edges.filter(e => !edgeIdsToRemove.has(e.id)).map(e =>
        e.id === esiLagId && e.data ? { ...e, data: { ...e.data, memberLinks: newMemberLinks, esiLeaves: newLeaves } } : e,
      ),
      selectedEdgeId: esiLagId,
      selectedEdgeIds: [esiLagId],
      selectedMemberLinkIndices: [],
      selectedLagId: null,
    });
    get().triggerYamlRefresh();
  },
});
