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

function normalizeConnectionForSimNodes(connection: Connection): { sourceId: string; targetId: string } | null {
  const source = connection.source;
  const target = connection.target;
  if (!source || !target) return null;

  // Normalize: ensure SimNodes are always the source if one endpoint is a SimNode.
  const sourceIsSimNode = source.startsWith('sim-');
  const targetIsSimNode = target.startsWith('sim-');

  if (targetIsSimNode && !sourceIsSimNode) {
    return { sourceId: target, targetId: source };
  }

  return { sourceId: source, targetId: target };
}

function isSimNodeId(nodeId: string): boolean {
  return nodeId.startsWith('sim-');
}

function isSimNodeConnection(sourceId: string, targetId: string): boolean {
  if (isSimNodeId(sourceId)) return true;
  return isSimNodeId(targetId);
}

function getNodeName(nodes: UINode[], nodeId: string): string {
  const node = nodes.find(n => n.id === nodeId);
  return node ? node.data.name : nodeId;
}

function getDefaultTemplate(linkTemplates: LinkTemplate[], simConnection: boolean): string {
  if (!simConnection) return 'isl';
  return linkTemplates.find(t => t.type === 'edge')?.name || 'edge';
}

function findExistingEdge(edges: UIEdge[], sourceId: string, targetId: string): UIEdge | undefined {
  for (const edge of edges) {
    if (edge.data?.edgeType === 'esilag') continue;
    if (edge.source === sourceId && edge.target === targetId) return edge;
    if (edge.source === targetId && edge.target === sourceId) return edge;
  }
  return undefined;
}

function getInterfacesForNodeInEdge(edge: UIEdge, nodeId: string): string[] {
  const memberLinks = edge.data?.memberLinks;
  if (!memberLinks || memberLinks.length === 0) return [];

  if (edge.source === nodeId) return memberLinks.map(ml => ml.sourceInterface);
  if (edge.target === nodeId) return memberLinks.map(ml => ml.targetInterface);

  return [];
}

function getNextPortNumber(edges: UIEdge[], nodeId: string): number {
  let maxPort = 0;

  for (const edge of edges) {
    const interfaces = getInterfacesForNodeInEdge(edge, nodeId);
    for (const iface of interfaces) {
      const port = extractPortNumber(iface);
      if (port > maxPort) maxPort = port;
    }
  }

  return maxPort + 1;
}

function formatInterface(isSimNode: boolean, portNumber: number): string {
  if (isSimNode) return `eth${portNumber}`;
  return `ethernet-1-${portNumber}`;
}

function getEdgePairKey(a: string, b: string): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

function getNextLinkNumberForPair(edges: UIEdge[], sourceNodeName: string, targetNodeName: string): number {
  const pairKey = getEdgePairKey(sourceNodeName, targetNodeName);
  let memberLinkCount = 0;

  for (const edge of edges) {
    const edgeSource = edge.data?.sourceNode;
    const edgeTarget = edge.data?.targetNode;
    if (!edgeSource || !edgeTarget) continue;
    if (getEdgePairKey(edgeSource, edgeTarget) !== pairKey) continue;
    memberLinkCount += edge.data?.memberLinks?.length ?? 0;
  }

  return memberLinkCount + 1;
}

function selectExistingEdgeWithNewMemberLink({
  set,
  get,
  nodes,
  edges,
  existingEdge,
  newMemberLink,
}: {
  set: Parameters<LinkSliceCreator>[0];
  get: Parameters<LinkSliceCreator>[1];
  nodes: UINode[];
  edges: UIEdge[];
  existingEdge: UIEdge;
  newMemberLink: UIMemberLink;
}) {
  const existingMemberLinks = existingEdge.data?.memberLinks || [];
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
}

function createEdgeAndSelect({
  set,
  get,
  nodes,
  edges,
  id,
  source,
  target,
  data,
}: {
  set: Parameters<LinkSliceCreator>[0];
  get: Parameters<LinkSliceCreator>[1];
  nodes: UINode[];
  edges: UIEdge[];
  id: string;
  source: string;
  target: string;
  data: UIEdgeData;
}) {
  const newEdge: UIEdge = {
    id,
    type: 'linkEdge',
    source,
    target,
    selected: true,
    data,
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
}

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
    const state = get();
    const nodes = state.nodes;
    const edges = state.edges;
    const linkTemplates = state.linkTemplates;

    const normalized = normalizeConnectionForSimNodes(connection);
    if (!normalized) return;

    const sourceId = normalized.sourceId;
    const targetId = normalized.targetId;

    const sourceNodeName = getNodeName(nodes, sourceId);
    const targetNodeName = getNodeName(nodes, targetId);

    const sourceIsSimNode = isSimNodeId(sourceId);
    const targetIsSimNode = isSimNodeId(targetId);
    const simConnection = isSimNodeConnection(sourceId, targetId);
    const defaultTemplate = getDefaultTemplate(linkTemplates, simConnection);

    const nextSourcePort = getNextPortNumber(edges, sourceId);
    const nextTargetPort = getNextPortNumber(edges, targetId);

    const sourceInterface = formatInterface(sourceIsSimNode, nextSourcePort);
    const targetInterface = formatInterface(targetIsSimNode, nextTargetPort);

    const nextLinkNumber = getNextLinkNumberForPair(edges, sourceNodeName, targetNodeName);
    const existingEdge = findExistingEdge(edges, sourceId, targetId);

    const newMemberLink: UIMemberLink = {
      name: `${targetNodeName}-${sourceNodeName}-${nextLinkNumber}`,
      template: defaultTemplate,
      sourceInterface,
      targetInterface,
    };

    if (existingEdge?.data) {
      selectExistingEdgeWithNewMemberLink({
        set,
        get,
        nodes,
        edges,
        existingEdge,
        newMemberLink,
      });
      return;
    }

    const id = generateEdgeId();
    createEdgeAndSelect({
      set,
      get,
      nodes,
      edges,
      id,
      source: sourceId,
      target: targetId,
      data: {
        id,
        sourceNode: sourceNodeName,
        targetNode: targetNodeName,
        edgeType: 'normal',
        memberLinks: [newMemberLink],
      },
    });
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
