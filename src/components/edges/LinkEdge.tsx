import { type EdgeProps, useInternalNode } from '@xyflow/react';

import { useTopologyStore } from '../../lib/store';
import type { UIEdgeData } from '../../types/ui';
import { topologyEdgeTestId } from '../../lib/testIds';
import { getFloatingEdgeParams } from '../../lib/edgeUtils';

import StandardEdge from './StandardEdge';
import BundleEdge from './BundleEdge';
import EsiLagEdge from './EsiLagEdge';

function coalesce<T>(value: T | null | undefined, fallback: T): T {
  if (value == null) return fallback;
  return value;
}

function asArray<T>(value: T[] | undefined | null): T[] {
  if (value) return value;
  return [];
}

function isSimNodeEdgeFromIds(source: string, target: string): boolean {
  if (source.startsWith('sim-')) return true;
  if (target.startsWith('sim-')) return true;
  return false;
}

function getEdgeNodes(edgeData: UIEdgeData | undefined, source: string, target: string) {
  return {
    edgeNodeA: coalesce(edgeData?.sourceNode, source),
    edgeNodeB: coalesce(edgeData?.targetNode, target),
  };
}

export default function LinkEdge({
  id,
  source,
  target,
  data,
  selected,
}: EdgeProps) {
  const edgeData = data as UIEdgeData | undefined;
  const isSimNodeEdge = isSimNodeEdgeFromIds(source, target);

  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);

  const { edgeNodeA, edgeNodeB } = getEdgeNodes(edgeData, source, target);
  const edgeTestId = topologyEdgeTestId(edgeNodeA, edgeNodeB);

  const expandedEdges = useTopologyStore(state => state.expandedEdges);
  const selectedMemberLinkIndices = useTopologyStore(state => state.selectedMemberLinkIndices);
  const selectedLagId = useTopologyStore(state => state.selectedLagId);
  const selectedNodeId = useTopologyStore(state => state.selectedNodeId);
  const toggleEdgeExpanded = useTopologyStore(state => state.toggleEdgeExpanded);
  const selectMemberLink = useTopologyStore(state => state.selectMemberLink);
  const selectLag = useTopologyStore(state => state.selectLag);
  const nodes = useTopologyStore(state => state.nodes);

  const isConnectedToSelectedNode = selectedNodeId !== null && (source === selectedNodeId || target === selectedNodeId);

  if (!sourceNode || !targetNode) {
    return null;
  }

  const { sx: sourceX, sy: sourceY, tx: targetX, ty: targetY, sourcePos: sourcePosition, targetPos: targetPosition } = getFloatingEdgeParams(sourceNode, targetNode);

  const isEsiLag = edgeData?.edgeType === 'esilag';
  const esiLeaves = edgeData?.esiLeaves;
  const memberLinks = asArray(edgeData?.memberLinks);
  const lagGroups = asArray(edgeData?.lagGroups);
  const linkCount = memberLinks.length;
  const isExpanded = expandedEdges.has(id);
  const isSelected = Boolean(selected);

  const renderEsiLagEdge = () => {
    if (!isEsiLag || !esiLeaves?.length) return null;

    const nodeById = new Map(nodes.map(n => [n.id, n]));
    const leafNodes = new Map<string, { id: string; position: { x: number; y: number }; measured?: { width?: number; height?: number } }>();

    for (const leaf of esiLeaves) {
      const nodeInfo = nodeById.get(leaf.nodeId);
      if (nodeInfo) leafNodes.set(leaf.nodeId, nodeInfo);
    }

    if (leafNodes.size < 1) return null;

    return (
      <EsiLagEdge
        id={id}
        testId={edgeTestId}
        sourceNode={sourceNode}
        isSelected={isSelected}
        isSimNodeEdge={isSimNodeEdge}
        isConnectedToSelectedNode={isConnectedToSelectedNode}
        esiLeaves={esiLeaves}
        leafNodes={leafNodes}
      />
    );
  };

  const renderBundleEdge = () => {
    if (!isExpanded || linkCount <= 0) return null;

    return (
      <BundleEdge
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
        isConnectedToSelectedNode={isConnectedToSelectedNode}
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
  };

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

  const esiLagEdgeElement = renderEsiLagEdge();
  if (esiLagEdgeElement) return esiLagEdgeElement;

  const bundleEdgeElement = renderBundleEdge();
  if (bundleEdgeElement) return bundleEdgeElement;

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
      isConnectedToSelectedNode={isConnectedToSelectedNode}
      linkCount={linkCount}
      onDoubleClick={handleDoubleClick}
    />
  );
}
