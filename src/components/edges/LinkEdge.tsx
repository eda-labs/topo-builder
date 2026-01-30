import type { MouseEvent } from 'react';
import { type EdgeProps } from '@xyflow/react';

import { useTopologyStore } from '../../lib/store';
import type { TopologyEdgeData } from '../../types/topology';

import StandardEdge from './StandardEdge';
import ExpandedBundleEdge from './ExpandedBundleEdge';
import EsiLagEdge from './EsiLagEdge';

function createDoubleClickHandler(toggleEdgeExpanded: (id: string) => void, id: string, linkCount: number) {
  return () => {
    if (linkCount > 1) {
      toggleEdgeExpanded(id);
    }
  };
}

function createMemberLinkClickHandler(selectMemberLink: (edgeId: string, index: number, multiSelect: boolean) => void, id: string) {
  return (e: MouseEvent, index: number) => {
    e.stopPropagation();
    selectMemberLink(id, index, e.shiftKey);
  };
}

function createMemberLinkContextMenuHandler(selectMemberLink: (edgeId: string, index: number, multiSelect: boolean) => void, id: string, selectedMemberLinkIndices: number[]) {
  return (e: MouseEvent, index: number) => {
    if (!selectedMemberLinkIndices.includes(index)) {
      selectMemberLink(id, index, true);
    }
  };
}

function createLagClickHandler(selectLag: (edgeId: string, lagId: string) => void, id: string) {
  return (e: MouseEvent, lagId: string) => {
    e.stopPropagation();
    selectLag(id, lagId);
  };
}

function createLagContextMenuHandler(selectLag: (edgeId: string, lagId: string) => void, id: string, selectedLagId: string | null) {
  return (lagId: string) => {
    if (selectedLagId !== lagId) {
      selectLag(id, lagId);
    }
  };
}

function isSimNodeEdgeFor(source?: string, target?: string) {
  return Boolean(source?.startsWith('sim-')) || Boolean(target?.startsWith('sim-'));
}

function buildEsiLagLeafNodes(
  esiLeaves: NonNullable<TopologyEdgeData["esiLeaves"]>,
  nodes: ReturnType<typeof useTopologyStore.getState>["nodes"],
  simNodes: ReturnType<typeof useTopologyStore.getState>["simulation"]["simNodes"],
) {
  const leafNodes = new Map<string, { id: string; position: { x: number; y: number }; measured?: { width?: number; height?: number } }>();

  const getNodeInfo = (nodeId: string) => {
    const topoNode = nodes.find(n => n.id === nodeId);
    if (topoNode) return topoNode;
    const simNode = simNodes?.find(s => s.id === nodeId);
    if (simNode) {
      return {
        id: simNode.id,
        position: simNode.position || { x: 0, y: 0 },
        measured: { width: 120, height: 40 },
      };
    }
    return null;
  };

  for (const leaf of esiLeaves) {
    const nodeInfo = getNodeInfo(leaf.nodeId);
    if (nodeInfo) {
      leafNodes.set(leaf.nodeId, nodeInfo);
    }
  }

  return leafNodes;
}

export default function LinkEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps) {
  const edgeData = data as TopologyEdgeData | undefined;
  const isSimNodeEdge = isSimNodeEdgeFor(source, target);

  const expandedEdges = useTopologyStore((state) => state.expandedEdges);
  const selectedMemberLinkIndices = useTopologyStore((state) => state.selectedMemberLinkIndices);
  const selectedLagId = useTopologyStore((state) => state.selectedLagId);
  const toggleEdgeExpanded = useTopologyStore((state) => state.toggleEdgeExpanded);
  const selectMemberLink = useTopologyStore((state) => state.selectMemberLink);
  const selectLag = useTopologyStore((state) => state.selectLag);
  const nodes = useTopologyStore((state) => state.nodes);
  const simNodes = useTopologyStore((state) => state.simulation.simNodes);

  const isMultihomed = edgeData?.isMultihomed;
  const esiLeaves = edgeData?.esiLeaves;
  const memberLinks = edgeData?.memberLinks ?? [];
  const lagGroups = edgeData?.lagGroups ?? [];
  const linkCount = memberLinks.length;
  const isExpanded = expandedEdges.has(id);
  const isSelected = selected ?? false;

  const handleDoubleClick = createDoubleClickHandler(toggleEdgeExpanded, id, linkCount);
  const handleMemberLinkClick = createMemberLinkClickHandler(selectMemberLink, id);
  const handleMemberLinkContextMenu = createMemberLinkContextMenuHandler(selectMemberLink, id, selectedMemberLinkIndices);
  const handleLagClick = createLagClickHandler(selectLag, id);
  const handleLagContextMenu = createLagContextMenuHandler(selectLag, id, selectedLagId);

  const leafNodes = isMultihomed && esiLeaves?.length
    ? buildEsiLagLeafNodes(esiLeaves, nodes, simNodes)
    : null;

  if (leafNodes && leafNodes.size >= 1) {
    return (
      <EsiLagEdge
        id={id}
        sourceX={sourceX}
        sourceY={sourceY}
        targetX={targetX}
        targetY={targetY}
        sourcePosition={sourcePosition}
        targetPosition={targetPosition}
        isSelected={isSelected}
        isSimNodeEdge={isSimNodeEdge}
        esiLeaves={esiLeaves!}
        leafNodes={leafNodes}
      />
    );
  }

  if (isExpanded && linkCount > 0) {
    return (
      <ExpandedBundleEdge
        sourceX={sourceX}
        sourceY={sourceY}
        targetX={targetX}
        targetY={targetY}
        sourcePosition={sourcePosition}
        targetPosition={targetPosition}
        isSelected={isSelected}
        isSimNodeEdge={isSimNodeEdge}
        memberLinks={memberLinks}
        lagGroups={lagGroups}
        selectedMemberLinkIndices={selectedMemberLinkIndices}
        selectedLagId={selectedLagId}
        onDoubleClick={handleDoubleClick}
        onMemberLinkClick={handleMemberLinkClick}
        onMemberLinkContextMenu={handleMemberLinkContextMenu}
        onLagClick={handleLagClick}
        onLagContextMenu={handleLagContextMenu}
      />
    );
  }

  return (
    <StandardEdge
      sourceX={sourceX}
      sourceY={sourceY}
      targetX={targetX}
      targetY={targetY}
      sourcePosition={sourcePosition}
      targetPosition={targetPosition}
      isSelected={isSelected}
      isSimNodeEdge={isSimNodeEdge}
      linkCount={linkCount}
      onDoubleClick={handleDoubleClick}
    />
  );
}
