/**
 * External Node Store Slice
 *
 * External nodes are UI-only stand-ins for devices outside the topology. Cables between a real
 * node and an external node are exported to YAML as edge links (single-endpoint links); the
 * external node itself is never written to YAML.
 */

import type { StateCreator } from 'zustand';

import type { UINode, UIEdge, UIMemberLink, UIEdgeData } from '../../types/ui';
import { generateUniqueName } from '../utils';

export const isExternalNodeId = (nodeId: string): boolean => nodeId.startsWith('ext-');

export const isExternalEdge = (edge: { source: string; target: string }): boolean =>
  isExternalNodeId(edge.source) || isExternalNodeId(edge.target);

/** member-link view of one edge-link cable, from the real node's perspective */
export interface EdgeLinkCable {
  edgeId: string;
  memberIndex: number;
  name: string;
  interface: string;
  template?: string;
  externalName: string;
}

/** All edge-link cables of a real node (its member links on edges to external nodes). */
export function collectEdgeLinkCables(edges: UIEdge[], nodeId: string): EdgeLinkCable[] {
  const cables: EdgeLinkCable[] = [];
  for (const edge of edges) {
    if (!isExternalEdge(edge)) continue;
    const nodeIsSource = edge.source === nodeId;
    const nodeIsTarget = edge.target === nodeId;
    if (!nodeIsSource && !nodeIsTarget) continue;
    edge.data?.memberLinks?.forEach((ml, memberIndex) => {
      cables.push({
        edgeId: edge.id,
        memberIndex,
        name: ml.name,
        interface: nodeIsSource ? ml.sourceInterface : ml.targetInterface,
        template: ml.template || undefined,
        externalName: (nodeIsSource ? edge.data?.targetNode : edge.data?.sourceNode) ?? '',
      });
    });
  }
  return cables;
}

/** eth-style interface for the external side, unique across the external node's edges. */
export function nextExternalInterface(edges: UIEdge[], externalId: string): string {
  let maxPort = 0;
  for (const edge of edges) {
    let ifaces: (string | undefined)[] | undefined;
    if (edge.source === externalId) ifaces = edge.data?.memberLinks?.map(ml => ml.sourceInterface);
    else if (edge.target === externalId) ifaces = edge.data?.memberLinks?.map(ml => ml.targetInterface);
    for (const iface of ifaces ?? []) {
      const match = iface?.match(/eth(\d+)/);
      if (match) maxPort = Math.max(maxPort, parseInt(match[1], 10));
    }
  }
  return `eth${maxPort + 1}`;
}

export interface ExternalActions {
  addExternalNode: (params: { name?: string; position: { x: number; y: number } }) => string;
  updateExternalNode: (id: string, data: Partial<UINode['data']>) => void;
  /** Add an edge link on a real node: cables it to its external peer (created if missing). */
  addEdgeLinkCable: (nodeId: string, iface: string, template?: string) => void;
}

export type ExternalSlice = ExternalActions;

// ID generator - will be set from main store
let generateExternalId: () => string = () => `ext-${Date.now()}`;

export const setExternalIdGenerator = (fn: () => string) => {
  generateExternalId = fn;
};

// Edge id generator shared with the link slice - set from main store
let generateEdgeId: () => string = () => `edge-${Date.now()}`;

export const setExternalEdgeIdGenerator = (fn: () => string) => {
  generateEdgeId = fn;
};

export function externalNodeName(nodes: UINode[]): string {
  const existing = nodes.filter(n => n.data.nodeType === 'external').map(n => n.data.name);
  return generateUniqueName('external', existing, existing.length + 1);
}

export function buildExternalNode(id: string, name: string, position: { x: number; y: number }): UINode {
  return {
    id,
    type: 'externalNode',
    position,
    data: { id, name, nodeType: 'external' },
  };
}

export type ExternalSliceCreator = StateCreator<
  ExternalSlice & {
    nodes: UINode[];
    edges: UIEdge[];
    triggerYamlRefresh: () => void;
    saveToUndoHistory: () => void;
  },
  [],
  [],
  ExternalSlice
>;

export const createExternalSlice: ExternalSliceCreator = (set, get) => ({
  addExternalNode: ({ name, position }) => {
    get().saveToUndoHistory();
    const nodes = get().nodes;
    const id = generateExternalId();
    const newNode = buildExternalNode(id, name || externalNodeName(nodes), position);
    set({ nodes: [...nodes, newNode] } as Partial<ExternalSlice>);
    return id;
  },

  updateExternalNode: (id, data) => {
    const currentNode = get().nodes.find(n => n.id === id);
    if (!currentNode) return;

    get().saveToUndoHistory();
    const oldName = currentNode.data.name;
    const newName = data.name;

    set({
      nodes: get().nodes.map(node =>
        node.id === id ? { ...node, data: { ...node.data, ...data } } : node,
      ),
    } as Partial<ExternalSlice>);

    // Edges reference nodes by display name — keep them in sync on rename.
    if (newName && newName !== oldName) {
      set({
        edges: get().edges.map(edge => {
          if (!edge.data) return edge;
          if (edge.source !== id && edge.target !== id) return edge;
          return {
            ...edge,
            data: {
              ...edge.data,
              sourceNode: edge.source === id ? newName : edge.data.sourceNode,
              targetNode: edge.target === id ? newName : edge.data.targetNode,
            },
          };
        }),
      } as Partial<ExternalSlice>);
    }
    get().triggerYamlRefresh();
  },

  addEdgeLinkCable: (nodeId, iface, template) => {
    const node = get().nodes.find(n => n.id === nodeId);
    if (!node) return;

    get().saveToUndoHistory();
    const nodeName = node.data.name;
    let nodes = get().nodes;
    let edges = get().edges;

    // Reuse the node's existing external peer so edge links bundle onto one cable run.
    let peerEdge = edges.find(e => isExternalEdge(e) && (e.source === nodeId || e.target === nodeId));
    let externalId: string | undefined;
    if (peerEdge) {
      externalId = isExternalNodeId(peerEdge.source) ? peerEdge.source : peerEdge.target;
    }

    if (!externalId) {
      externalId = generateExternalId();
      const extNode = buildExternalNode(
        externalId,
        externalNodeName(nodes),
        { x: node.position.x + 40, y: node.position.y + 220 },
      );
      nodes = [...nodes, extNode];
    }

    const newMemberLink: UIMemberLink = {
      name: `${nodeName}-${iface}`,
      template: template ?? '',
      // Convention: the external node is always the edge source (mirrors sim nodes).
      sourceInterface: nextExternalInterface(edges, externalId),
      targetInterface: iface,
    };

    if (peerEdge) {
      const peerEdgeId = peerEdge.id;
      const reversed = peerEdge.source === nodeId;
      const member = reversed
        ? { ...newMemberLink, sourceInterface: newMemberLink.targetInterface, targetInterface: newMemberLink.sourceInterface }
        : newMemberLink;
      edges = edges.map(e =>
        e.id === peerEdgeId
          ? { ...e, data: { ...e.data, memberLinks: [...(e.data?.memberLinks ?? []), member] } as UIEdgeData }
          : e,
      );
    } else {
      const edgeId = generateEdgeId();
      const extName = nodes.find(n => n.id === externalId)?.data.name ?? externalId;
      peerEdge = {
        id: edgeId,
        type: 'linkEdge',
        source: externalId,
        target: nodeId,
        sourceHandle: null,
        targetHandle: null,
        selected: false,
        data: {
          id: edgeId,
          sourceNode: extName,
          targetNode: nodeName,
          edgeType: 'normal',
          memberLinks: [newMemberLink],
        },
      };
      edges = [...edges, peerEdge];
    }

    set({ nodes, edges } as Partial<ExternalSlice>);
    get().triggerYamlRefresh();
  },
});
