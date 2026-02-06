/**
 * LAG Store Slice
 *
 * Contains all LAG-related actions for the topology store.
 */

import type { StateCreator } from 'zustand';

import type { UIEdge, UIMemberLink, UILagGroup } from '../../types/ui';
import {
  generateLagId,
  generateLagName,
  indicesInExistingLag,
  incrementInterface,
} from '../utils';
import { DEFAULT_INTERFACE } from '../constants';

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
    selectedMemberLinkIndices: number[];
    selectedLagId: string | null;
    triggerYamlRefresh: () => void;
    setError: (error: string | null) => void;
  },
  [],
  [],
  LagSlice
>;

export const createLagSlice: LagSliceCreator = (set, get) => ({
  createLagFromMemberLinks: (edgeId: string, memberLinkIndices: number[]) => {
    const edges = get().edges;
    const sourceEdge = edges.find(e => e.id === edgeId);
    if (!sourceEdge || !sourceEdge.data?.memberLinks) return;

    const allMemberLinks = sourceEdge.data.memberLinks;
    const validIndices = memberLinkIndices.filter(i => i >= 0 && i < allMemberLinks.length).sort((a, b) => a - b);
    if (validIndices.length < 2) return;

    const existingLagGroups = sourceEdge.data.lagGroups || [];
    if (indicesInExistingLag(validIndices, existingLagGroups)) return;

    const lagGroupCount = existingLagGroups.length + 1;
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
    const edges = get().edges;
    const edge = edges.find(e => e.id === edgeId);
    if (!edge || !edge.data) return;

    const lagGroups = edge.data.lagGroups || [];
    const lag = lagGroups.find(l => l.id === lagId);
    if (!lag) return;

    const memberLinks = edge.data.memberLinks || [];
    const lagMemberLinks = lag.memberLinkIndices.map(i => memberLinks[i]).filter(Boolean);
    const lastLagLink = lagMemberLinks[lagMemberLinks.length - 1];

    const newLink: UIMemberLink = {
      name: `${lag.name}-${lag.memberLinkIndices.length + 1}`,
      template: lag.template || lastLagLink?.template,
      sourceInterface: incrementInterface(lastLagLink?.sourceInterface || DEFAULT_INTERFACE, lagMemberLinks.length + 1),
      targetInterface: incrementInterface(lastLagLink?.targetInterface || DEFAULT_INTERFACE, lagMemberLinks.length + 1),
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
    const edges = get().edges;
    const edge = edges.find(e => e.id === edgeId);
    if (!edge || !edge.data) return;

    const lagGroups = edge.data.lagGroups || [];
    const lag = lagGroups.find(l => l.id === lagId);
    if (!lag) return;

    if (lag.memberLinkIndices.length <= 2) {
      // Remove the LAG entirely if only 2 members remain
      set({
        edges: edges.map(e =>
          e.id === edgeId && e.data ? { ...e, data: { ...e.data, lagGroups: lagGroups.filter(l => l.id !== lagId) } } : e,
        ),
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
