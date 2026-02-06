/**
 * Link Store Slice
 *
 * Contains all link-related actions for the topology store.
 */

import type { StateCreator } from 'zustand';
import type { Edge, EdgeChange, Connection } from '@xyflow/react';
import { applyEdgeChanges } from '@xyflow/react';

import type { UIEdgeData, UIEdge, UIMemberLink, UINode } from '../../types/ui';
import { extractPortNumber, getNameError } from '../utils';
import type { LinkTemplate } from '../../types/schema';

export interface LinkState {
  edges: UIEdge[];
  expandedEdges: Set<string>;
}

export interface LinkActions {
  addEdge: (connection: Connection) => void;
  updateEdge: (id: string, data: Partial<UIEdgeData>) => void;
  deleteEdge: (id: string) => void;
  onEdgesChange: (changes: EdgeChange<Edge<UIEdgeData>>[]) => void;
  onConnect: (connection: Connection) => void;
  addMemberLink: (edgeId: string, link: UIMemberLink) => void;
  updateMemberLink: (edgeId: string, index: number, link: Partial<UIMemberLink>) => void;
  deleteMemberLink: (edgeId: string, index: number) => void;
  toggleEdgeExpanded: (edgeId: string) => void;
  toggleAllEdgesExpanded: () => void;
}

export type LinkSlice = LinkState & LinkActions;

// ID generator - will be set from main store
let generateEdgeId: () => string = () => `edge-${Date.now()}`;

export const setEdgeIdGenerator = (fn: () => string) => {
  generateEdgeId = fn;
};

export type LinkSliceCreator = StateCreator<
  LinkSlice & {
    nodes: UINode[];
    linkTemplates: LinkTemplate[];
    selectedEdgeId: string | null;
    selectedEdgeIds: string[];
    selectedNodeId: string | null;
    selectedSimNodeName: string | null;
    selectedMemberLinkIndices: number[];
    selectedLagId: string | null;
    triggerYamlRefresh: () => void;
    setError: (error: string | null) => void;
    saveToUndoHistory: () => void;
  },
  [],
  [],
  LinkSlice
>;

export const createLinkSlice: LinkSliceCreator = (set, get) => ({
  edges: [],
  expandedEdges: new Set<string>(),

  addEdge: (connection: Connection) => {
    get().saveToUndoHistory();
    const nodes = get().nodes;
    const edges = get().edges;
    const linkTemplates = get().linkTemplates;

    // Normalize: ensure SimNodes are always the source if one endpoint is a SimNode
    const origSourceIsSimNode = connection.source?.startsWith('sim-');
    const origTargetIsSimNode = connection.target?.startsWith('sim-');
    const needsSwap = origTargetIsSimNode && !origSourceIsSimNode;

    const normalizedSource = needsSwap ? connection.target : connection.source;
    const normalizedTarget = needsSwap ? connection.source : connection.target;

    const sourceNodeName = nodes.find(n => n.id === normalizedSource)?.data.name || normalizedSource;
    const targetNodeName = nodes.find(n => n.id === normalizedTarget)?.data.name || normalizedTarget;

    const sourceIsSimNode = normalizedSource?.startsWith('sim-');
    const targetIsSimNode = normalizedTarget?.startsWith('sim-');
    const isSimNodeConnection = sourceIsSimNode || targetIsSimNode;
    const defaultTemplate = isSimNodeConnection
      ? linkTemplates.find(t => t.type === 'edge')?.name || 'edge'
      : 'isl';

    // Find existing edge between same node pair (ignoring handles since edges are now floating)
    const existingEdge = edges.find(e => {
      if (e.data?.edgeType === 'esilag') return false;
      const sameDirection = e.source === normalizedSource && e.target === normalizedTarget;
      const reversedDirection = e.source === normalizedTarget && e.target === normalizedSource;
      return sameDirection || reversedDirection;
    });

    const sourcePortNumbers = edges.flatMap(e => {
      if (e.source === normalizedSource) return e.data?.memberLinks?.map(ml => extractPortNumber(ml.sourceInterface)) || [];
      if (e.target === normalizedSource) return e.data?.memberLinks?.map(ml => extractPortNumber(ml.targetInterface)) || [];
      return [];
    });
    const nextSourcePort = Math.max(0, ...sourcePortNumbers) + 1;

    const targetPortNumbers = edges.flatMap(e => {
      if (e.source === normalizedTarget) return e.data?.memberLinks?.map(ml => extractPortNumber(ml.sourceInterface)) || [];
      if (e.target === normalizedTarget) return e.data?.memberLinks?.map(ml => extractPortNumber(ml.targetInterface)) || [];
      return [];
    });
    const nextTargetPort = Math.max(0, ...targetPortNumbers) + 1;

    const sourceInterface = sourceIsSimNode ? `eth${nextSourcePort}` : `ethernet-1-${nextSourcePort}`;
    const targetInterface = targetIsSimNode ? `eth${nextTargetPort}` : `ethernet-1-${nextTargetPort}`;

    const sortedPair = [sourceNodeName, targetNodeName].sort().join('-');
    const allLinksForPair = edges.flatMap(e => {
      const edgePair = [e.data?.sourceNode, e.data?.targetNode].sort().join('-');
      return edgePair === sortedPair ? e.data?.memberLinks || [] : [];
    });
    const nextLinkNumber = allLinksForPair.length + 1;

    if (existingEdge && existingEdge.data) {
      const existingMemberLinks = existingEdge.data.memberLinks || [];
      const newMemberLink: UIMemberLink = {
        name: `${targetNodeName}-${sourceNodeName}-${nextLinkNumber}`,
        template: defaultTemplate,
        sourceInterface,
        targetInterface,
      };
      const updatedEdges = edges.map(e =>
        e.id === existingEdge.id
          ? { ...e, selected: true, data: { ...e.data, memberLinks: [...existingMemberLinks, newMemberLink] } as UIEdgeData }
          : { ...e, selected: false },
      );
      set({
        nodes: nodes.map(n => ({ ...n, selected: false })),
        edges: updatedEdges,
        selectedEdgeId: existingEdge.id,
        selectedEdgeIds: [existingEdge.id],
        selectedNodeId: null,
        selectedSimNodeName: null,
        selectedMemberLinkIndices: [existingMemberLinks.length],
      } as Partial<LinkSlice>);
      sessionStorage.setItem('topology-new-link-id', existingEdge.id);
      get().triggerYamlRefresh();
      return;
    }

    const id = generateEdgeId();
    const newEdge: UIEdge = {
      id,
      type: 'linkEdge',
      source: normalizedSource,
      target: normalizedTarget,
      selected: true,
      data: {
        id,
        sourceNode: sourceNodeName,
        targetNode: targetNodeName,
        edgeType: 'normal',
        memberLinks: [{
          name: `${targetNodeName}-${sourceNodeName}-${nextLinkNumber}`,
          template: defaultTemplate,
          sourceInterface,
          targetInterface,
        }],
      },
    };

    set({
      nodes: nodes.map(n => ({ ...n, selected: false })),
      edges: [...edges.map(e => ({ ...e, selected: false })), newEdge],
      selectedEdgeId: id,
      selectedEdgeIds: [id],
      selectedNodeId: null,
      selectedSimNodeName: null,
      selectedMemberLinkIndices: [],
      selectedLagId: null,
    } as Partial<LinkSlice>);
    sessionStorage.setItem('topology-new-link-id', id);
    get().triggerYamlRefresh();
  },

  updateEdge: (id: string, data: Partial<UIEdgeData>) => {
    set({
      edges: get().edges.map(edge =>
        edge.id === id ? { ...edge, data: { ...edge.data, ...data } as UIEdgeData } : edge,
      ),
    });
  },

  deleteEdge: (id: string) => {
    get().saveToUndoHistory();
    const newExpandedEdges = new Set(get().expandedEdges);
    newExpandedEdges.delete(id);
    set({
      edges: get().edges.filter(edge => edge.id !== id),
      selectedEdgeId: get().selectedEdgeId === id ? null : get().selectedEdgeId,
      selectedMemberLinkIndices: get().selectedEdgeId === id ? [] : get().selectedMemberLinkIndices,
      expandedEdges: newExpandedEdges,
    });
    get().triggerYamlRefresh();
  },

  addMemberLink: (edgeId: string, link: UIMemberLink) => {
    set({
      edges: get().edges.map(edge =>
        edge.id === edgeId
          ? { ...edge, data: { ...edge.data, memberLinks: [...(edge.data?.memberLinks || []), link] } as UIEdgeData }
          : edge,
      ),
    });
  },

  updateMemberLink: (edgeId: string, index: number, link: Partial<UIMemberLink>) => {
    if (link.name !== undefined) {
      const nameError = getNameError(link.name);
      if (nameError) {
        get().setError(`Invalid link name: ${nameError}`);
        return;
      }
    }
    set({
      edges: get().edges.map(edge =>
        edge.id === edgeId
          ? { ...edge, data: { ...edge.data, memberLinks: edge.data?.memberLinks?.map((m, i) => i === index ? { ...m, ...link } : m) || [] } as UIEdgeData }
          : edge,
      ),
    });
  },

  deleteMemberLink: (edgeId: string, index: number) => {
    const edge = get().edges.find(e => e.id === edgeId);
    if (!edge) return;
    const memberLinks = edge.data?.memberLinks || [];
    const newMemberLinks = memberLinks.filter((_, i) => i !== index);
    if (newMemberLinks.length === 0) {
      set({ edges: get().edges.filter(e => e.id !== edgeId), selectedEdgeId: null, selectedMemberLinkIndices: [] });
    } else {
      set({
        edges: get().edges.map(e =>
          e.id === edgeId ? { ...e, data: { ...e.data, memberLinks: newMemberLinks } as UIEdgeData } : e,
        ),
      });
    }
  },

  onEdgesChange: (changes: EdgeChange<Edge<UIEdgeData>>[]) => {
    const currentEdges = get().edges;
    const esiLagEdgeIds = new Set(currentEdges.filter(e => e.data?.edgeType === 'esilag').map(e => e.id));

    // Only filter ESI-LAG removal - let ReactFlow handle all selection
    const allowedChanges = changes.filter(c => {
      if (c.type === 'remove' && esiLagEdgeIds.has(c.id)) return false;
      return true;
    });

    if (allowedChanges.length > 0) {
      set({ edges: applyEdgeChanges(allowedChanges, get().edges) });
      if (allowedChanges.some(c => c.type === 'remove')) get().triggerYamlRefresh();
    }
  },

  onConnect: (connection: Connection) => { get().addEdge(connection); },

  toggleEdgeExpanded: (edgeId: string) => {
    const current = get().expandedEdges;
    const newSet = new Set(current);
    if (newSet.has(edgeId)) newSet.delete(edgeId);
    else newSet.add(edgeId);
    set({ expandedEdges: newSet });
  },

  toggleAllEdgesExpanded: () => {
    const edges = get().edges;
    const current = get().expandedEdges;
    const multiLinkEdges = edges.filter(e => (e.data?.memberLinks?.length || 0) > 1);
    const anyExpanded = multiLinkEdges.some(e => current.has(e.id));
    set({ expandedEdges: anyExpanded ? new Set() : new Set(multiLinkEdges.map(e => e.id)) });
  },
});
