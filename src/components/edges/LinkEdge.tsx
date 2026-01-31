import { type EdgeProps } from '@xyflow/react';
import { useTopologyStore } from '../../lib/store';
import type { TopologyEdgeData } from '../../types/topology';
import StandardEdge from './StandardEdge';
import ExpandedBundleEdge from './ExpandedBundleEdge';
import EsiLagEdge from './EsiLagEdge';
import { topologyEdgeTestId } from '../../lib/testIds';

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
  const isSimNodeEdge = source?.startsWith('sim-') || target?.startsWith('sim-');

  const edgeNodeA = edgeData?.sourceNode ?? source;
  const edgeNodeB = edgeData?.targetNode ?? target;
  const edgeTestId = topologyEdgeTestId(edgeNodeA, edgeNodeB);

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
  const memberLinks = edgeData?.memberLinks || [];
  const lagGroups = edgeData?.lagGroups || [];
  const linkCount = memberLinks.length;
  const isExpanded = expandedEdges.has(id);
  const isSelected = selected ?? false;


  const handleDoubleClick = () => {
    if (linkCount > 1) {
      toggleEdgeExpanded(id);
    }
  };

  const handleMemberLinkClick = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    selectMemberLink(id, index, e.shiftKey);
  };

  const handleMemberLinkContextMenu = (e: React.MouseEvent, index: number) => {
    if (!selectedMemberLinkIndices.includes(index)) {
      selectMemberLink(id, index, true);
    }
  };

  const handleLagClick = (e: React.MouseEvent, lagId: string) => {
    e.stopPropagation();
    selectLag(id, lagId);
  };

  const handleLagContextMenu = (lagId: string) => {
    if (selectedLagId !== lagId) {
      selectLag(id, lagId);
    }
  };

  if (isMultihomed && esiLeaves?.length) {
    const findNodeInfo = (nodeId: string) => {
      const topoNode = nodes.find(n => n.id === nodeId);
      if (topoNode) return topoNode;
      const simNode = simNodes?.find(s => s.id === nodeId);
      if (simNode) return {
        id: simNode.id,
        position: simNode.position || { x: 0, y: 0 },
        measured: { width: 120, height: 40 },
      };
      return null;
    };

    const leafNodes = new Map<string, { id: string; position: { x: number; y: number }; measured?: { width?: number; height?: number } }>();

    for (const leaf of esiLeaves) {
      const nodeInfo = findNodeInfo(leaf.nodeId);
      if (nodeInfo) {
        leafNodes.set(leaf.nodeId, nodeInfo);
      }
    }

    if (leafNodes.size >= 1) {
      return (
        <EsiLagEdge
          id={id}
          testId={edgeTestId}
          sourceX={sourceX}
          sourceY={sourceY}
          targetX={targetX}
          targetY={targetY}
          sourcePosition={sourcePosition}
          targetPosition={targetPosition}
          isSelected={isSelected}
          isSimNodeEdge={isSimNodeEdge}
          esiLeaves={esiLeaves}
          leafNodes={leafNodes}
        />
      );
    }
  }

  if (isExpanded && linkCount > 0) {
    return (
      <ExpandedBundleEdge
        edgeNodeA={edgeNodeA}
        edgeNodeB={edgeNodeB}
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
      testId={edgeTestId}
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
