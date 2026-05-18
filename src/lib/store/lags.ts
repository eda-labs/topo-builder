/**
 * LAG Store Slice
 *
 * Contains all LAG-related actions for the topology store.
 */

import type { StateCreator } from 'zustand';

import type { UIEdge, UIMemberLink, UILagGroup, UINode } from '../../types/ui';
import type { NodeTemplate } from '../../types/schema';
import {
  generateLagId,
  generateLagName,
  indicesInExistingLag,
  incrementInterface,
} from '../utils';
import { getDefaultInterface } from '../interfaces';

function getEdgePairKey(a: string, b: string): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

function getNextLagNumberForPair(edges: UIEdge[], sourceNodeName: string, targetNodeName: string): number {
  const pairKey = getEdgePairKey(sourceNodeName, targetNodeName);
  let lagCount = 0;
  for (const edge of edges) {
    const edgeSource = edge.data?.sourceNode;
    const edgeTarget = edge.data?.targetNode;
    if (!edgeSource || !edgeTarget) continue;
    if (getEdgePairKey(edgeSource, edgeTarget) !== pairKey) continue;
    lagCount += edge.data?.lagGroups?.length ?? 0;
  }
  return lagCount + 1;
}

// LAG state is stored within edges (UIEdgeData.lagGroups)
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface LagState {}

export interface LagActions {
  createLagFromMemberLinks: (edgeId: string, memberLinkIndices: number[]) => void;
  addLinkToLag: (edgeId: string, lagId: string) => void;
  removeLinkFromLag: (edgeId: string, lagId: string, memberLinkIndex: number) => void;
}

export type LagSlice = LagState & LagActions;

export type LagSliceCreator = StateCreator<
  LagSlice & {
    edges: UIEdge[];
    nodes: UINode[];
    nodeTemplates: NodeTemplate[];
    selectedMemberLinkIndices: number[];
    selectedLagId: string | null;
    triggerYamlRefresh: () => void;
    setError: (error: string | null) => void;
    saveToUndoHistory: () => void;
  },
  [],
  [],
  LagSlice
>;

export const createLagSlice: LagSliceCreator = (set, get) => ({
  createLagFromMemberLinks: (edgeId: string, memberLinkIndices: number[]) => {
    get().saveToUndoHistory();
    const edges = get().edges;
    const sourceEdge = edges.find(e => e.id === edgeId);
    if (!sourceEdge || !sourceEdge.data?.memberLinks) return;

    const allMemberLinks = sourceEdge.data.memberLinks;
    const validIndices = memberLinkIndices.filter(i => i >= 0 && i < allMemberLinks.length).sort((a, b) => a - b);
    if (validIndices.length < 2) return;

    const existingLagGroups = sourceEdge.data.lagGroups || [];
    if (indicesInExistingLag(validIndices, existingLagGroups)) return;

    const lagGroupCount = getNextLagNumberForPair(edges, sourceEdge.data.sourceNode, sourceEdge.data.targetNode);
    const firstMemberLink = allMemberLinks[validIndices[0]];
    const newLagGroup: UILagGroup = {
      id: generateLagId(edgeId, lagGroupCount),
      name: generateLagName(sourceEdge.data.targetNode, sourceEdge.data.sourceNode, lagGroupCount),
      template: firstMemberLink?.template,
      memberLinkIndices: validIndices,
    };

    set({
      edges: edges.map(e =>
        e.id === edgeId && e.data
          ? { ...e, data: { ...e.data, edgeType: 'lag' as const, lagGroups: [...existingLagGroups, newLagGroup] } }
          : e,
      ),
      selectedMemberLinkIndices: [],
      selectedLagId: null,
    });
    get().triggerYamlRefresh();
  },

  addLinkToLag: (edgeId: string, lagId: string) => {
    get().saveToUndoHistory();
    const { edges, nodes, nodeTemplates } = get();
    const edge = edges.find(e => e.id === edgeId);
    if (!edge || !edge.data) return;

    const lagGroups = edge.data.lagGroups || [];
    const lag = lagGroups.find(l => l.id === lagId);
    if (!lag) return;

    const memberLinks = edge.data.memberLinks || [];
    const lagMemberLinks = lag.memberLinkIndices.map(i => memberLinks[i]).filter(Boolean);
    const lastLagLink = lagMemberLinks[lagMemberLinks.length - 1];

    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);

    const getDefaultForNode = (node: UINode | undefined): string => {
      return getDefaultInterface(node, nodeTemplates);
    };

    const newLink: UIMemberLink = {
      name: `${lag.name}-${lag.memberLinkIndices.length + 1}`,
      template: lag.template || lastLagLink?.template,
      sourceInterface: incrementInterface(lastLagLink?.sourceInterface || getDefaultForNode(sourceNode), lagMemberLinks.length + 1),
      targetInterface: incrementInterface(lastLagLink?.targetInterface || getDefaultForNode(targetNode), lagMemberLinks.length + 1),
    };

    const newMemberLinkIndex = memberLinks.length;

    set({
      edges: edges.map(e =>
        e.id === edgeId && e.data
          ? {
            ...e,
            data: {
              ...e.data,
              memberLinks: [...memberLinks, newLink],
              lagGroups: lagGroups.map(l =>
                l.id === lagId ? { ...l, memberLinkIndices: [...l.memberLinkIndices, newMemberLinkIndex] } : l,
              ),
            },
          }
          : e,
      ),
      selectedLagId: lagId,
    });
    get().triggerYamlRefresh();
  },

  removeLinkFromLag: (edgeId: string, lagId: string, memberLinkIndex: number) => {
    get().saveToUndoHistory();
    const edges = get().edges;
    const edge = edges.find(e => e.id === edgeId);
    if (!edge || !edge.data) return;

    const lagGroups = edge.data.lagGroups || [];
    const lag = lagGroups.find(l => l.id === lagId);
    if (!lag) return;

    if (lag.memberLinkIndices.length <= 2) {
      // Remove the LAG entirely if only 2 members remain
      set({
        edges: edges.map(e => {
          if (e.id === edgeId && e.data) {
            const updatedLagGroups = lagGroups.filter(l => l.id !== lagId);
            const hasAnyLagGroups = updatedLagGroups.length > 0;
            return {
              ...e,
              data: {
                ...e.data,
                lagGroups: updatedLagGroups,
                edgeType: hasAnyLagGroups ? e.data.edgeType : 'normal',
              },
            };
          }
          return e;
        }),
        selectedLagId: null,
      });
    } else {
      set({
        edges: edges.map(e =>
          e.id === edgeId && e.data
            ? {
              ...e,
              data: {
                ...e.data,
                lagGroups: lagGroups.map(l =>
                  l.id === lagId ? { ...l, memberLinkIndices: l.memberLinkIndices.filter(i => i !== memberLinkIndex) } : l,
                ),
              },
            }
            : e,
        ),
        selectedLagId: lagId,
      });
    }
    get().triggerYamlRefresh();
  },
});
