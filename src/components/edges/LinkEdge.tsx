import { useMemo } from 'react';
import { type EdgeProps, type Position, useInternalNode } from '@xyflow/react';

import { useTopologyStore } from '../../lib/store';
import type { EdgeRouting } from '../../lib/store/createStore';
import type { UIEdgeData, UIEsiLeaf, UIMemberLink, UINodeData } from '../../types/ui';
import { topologyEdgeTestId } from '../../lib/testIds';
import { getHandleCoordinates, getFloatingEdgeParams } from '../../lib/edgeUtils';
import { resolveNodePanel } from '../../lib/frontpanel';

import StandardEdge from './StandardEdge';
import BundleEdge from './BundleEdge';
import EsiLagEdge from './EsiLagEdge';
import PortBundleEdge from './PortBundleEdge';

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

type InternalFlowNode = NonNullable<ReturnType<typeof useInternalNode>>;

interface EsiLagInternalEdgeProps {
  id: string;
  testId?: string;
  sourceNode: InternalFlowNode;
  sourceName?: string;
  isSelected: boolean;
  isSimNodeEdge: boolean;
  isConnectedToSelectedNode: boolean;
  esiLeaves: UIEsiLeaf[];
  memberLinks?: UIMemberLink[];
  esiLagName?: string;
  routing?: EdgeRouting;
}

/** Subscribe to extra leaf positions only for ESI-LAG edges. */
function EsiLagInternalEdge({
  id,
  testId,
  sourceNode,
  sourceName,
  isSelected,
  isSimNodeEdge,
  isConnectedToSelectedNode,
  esiLeaves,
  memberLinks,
  esiLagName,
  routing,
}: EsiLagInternalEdgeProps) {
  const nodeTemplates = useTopologyStore(state => state.nodeTemplates);
  const leafNode0 = useInternalNode(esiLeaves[0]?.nodeId ?? '');
  const leafNode1 = useInternalNode(esiLeaves[1]?.nodeId ?? '');
  const leafNode2 = useInternalNode(esiLeaves[2]?.nodeId ?? '');
  const leafNode3 = useInternalNode(esiLeaves[3]?.nodeId ?? '');
  const leafNodes = new Map<string, InternalFlowNode>();

  for (const nodeInfo of [leafNode0, leafNode1, leafNode2, leafNode3]) {
    if (nodeInfo) leafNodes.set(nodeInfo.id, nodeInfo);
  }

  if (leafNodes.size === 0) return null;

  // Leaf faceplates anchor the legs at the exact member port (same as PortBundleEdge cables).
  const leafPanels = new Map(
    [...leafNodes.entries()].map(([nodeId, node]) => [
      nodeId,
      resolveNodePanel(node.data as UINodeData, nodeTemplates),
    ]),
  );

  return (
    <EsiLagEdge
      id={id}
      testId={testId}
      sourceNode={sourceNode}
      sourceName={sourceName}
      isSelected={isSelected}
      isSimNodeEdge={isSimNodeEdge}
      isConnectedToSelectedNode={isConnectedToSelectedNode}
      esiLeaves={esiLeaves}
      leafNodes={leafNodes}
      memberLinks={memberLinks}
      esiLagName={esiLagName}
      leafPanels={leafPanels}
      routing={routing}
    />
  );
}

export default function LinkEdge({
  id,
  source,
  target,
  sourceHandleId,
  targetHandleId,
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
  const nodeTemplates = useTopologyStore(state => state.nodeTemplates);
  const edgeRouting = useTopologyStore(state => state.edgeRouting);

  const isConnectedToSelectedNode = selectedNodeId !== null && (source === selectedNodeId || target === selectedNodeId);

  const sourcePanel = useMemo(() => {
    const data = sourceNode?.data as UINodeData | undefined;
    return data && !source.startsWith('sim-') ? resolveNodePanel(data, nodeTemplates) : null;
  }, [sourceNode?.data, source, nodeTemplates]);
  const targetPanel = useMemo(() => {
    const data = targetNode?.data as UINodeData | undefined;
    return data && !target.startsWith('sim-') ? resolveNodePanel(data, nodeTemplates) : null;
  }, [targetNode?.data, target, nodeTemplates]);

  if (!sourceNode || !targetNode) {
    return null;
  }

  let sourceX: number;
  let sourceY: number;
  let sourcePosition: Position;
  let targetX: number;
  let targetY: number;
  let targetPosition: Position;

  if (!sourceHandleId && !targetHandleId) {
    const floating = getFloatingEdgeParams(sourceNode, targetNode);
    sourceX = floating.sx;
    sourceY = floating.sy;
    sourcePosition = floating.sourcePos;
    targetX = floating.tx;
    targetY = floating.ty;
    targetPosition = floating.targetPos;
  } else {
    const sourceCoords = getHandleCoordinates(sourceNode, sourceHandleId ?? 'bottom');
    const targetCoords = getHandleCoordinates(targetNode, targetHandleId ?? 'bottom');
    sourceX = sourceCoords.x;
    sourceY = sourceCoords.y;
    sourcePosition = sourceCoords.position;
    targetX = targetCoords.x;
    targetY = targetCoords.y;
    targetPosition = targetCoords.position;
  }

  const isEsiLag = edgeData?.edgeType === 'esilag';
  const esiLeaves = edgeData?.esiLeaves;
  const memberLinks = asArray(edgeData?.memberLinks);
  const lagGroups = asArray(edgeData?.lagGroups);
  const linkCount = memberLinks.length;
  const isExpanded = expandedEdges.has(id);
  const isSelected = Boolean(selected);

  const renderBundleEdge = () => {
    if (!isExpanded || linkCount <= 0) return null;

    return (
      <BundleEdge
        edgeId={id}
        edgeNodeA={edgeNodeA}
        edgeNodeB={edgeNodeB}
        routing={edgeRouting}
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

  // Right-click selects the cable under the cursor (replacing the selection, like any item
  // context menu); shift-right-click extends the selection for multi-member actions (LAG).
  const handleMemberLinkContextMenu = (e: React.MouseEvent, index: number) => {
    if (!selectedMemberLinkIndices.includes(index)) {
      selectMemberLink(id, index, e.shiftKey);
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

  // ESI-LAGs fan out to as many as four leaves while React Flow itself only knows about the
  // first target. The child subscribes to those leaf internals so a locally buffered drag moves
  // every branch without publishing the whole nodes array to the application store.
  if (isEsiLag && esiLeaves?.length) {
    return (
      <EsiLagInternalEdge
        id={id}
        testId={edgeTestId}
        sourceNode={sourceNode}
        sourceName={edgeData?.sourceNode}
        isSelected={isSelected}
        isSimNodeEdge={isSimNodeEdge}
        isConnectedToSelectedNode={isConnectedToSelectedNode}
        esiLeaves={esiLeaves}
        memberLinks={memberLinks}
        esiLagName={edgeData?.esiLagName}
        routing={edgeRouting}
      />
    );
  }

  // Front-panel mode: as soon as either endpoint renders a real faceplate, every member link
  // is its own cable anchored at its exact port (no expand/collapse indirection).
  if (!isEsiLag && (sourcePanel || targetPanel) && linkCount > 0) {
    return (
      <g data-testid={edgeTestId}>
        <PortBundleEdge
          edgeId={id}
          edgeNodeA={edgeNodeA}
          edgeNodeB={edgeNodeB}
          sourceNode={sourceNode}
          targetNode={targetNode}
          sourcePanel={sourcePanel}
          targetPanel={targetPanel}
          sourceHandleId={sourceHandleId}
          targetHandleId={targetHandleId}
          memberLinks={memberLinks}
          lagGroups={lagGroups}
          routing={edgeRouting}
          isSelected={isSelected}
          isSimNodeEdge={isSimNodeEdge}
          isConnectedToSelectedNode={isConnectedToSelectedNode}
          selectedMemberLinkIndices={selectedMemberLinkIndices}
          selectedLagId={selectedLagId}
          onMemberLinkClick={handleMemberLinkClick}
          onMemberLinkContextMenu={handleMemberLinkContextMenu}
          onLagClick={handleLagClick}
          onLagContextMenu={handleLagContextMenu}
        />
      </g>
    );
  }

  const bundleEdgeElement = renderBundleEdge();
  if (bundleEdgeElement) return bundleEdgeElement;

  const singleMember = linkCount === 1 ? memberLinks[0] : undefined;
  return (
    <StandardEdge
      testId={edgeTestId}
      sourceX={sourceX}
      sourceY={sourceY}
      targetX={targetX}
      targetY={targetY}
      sourcePosition={sourcePosition}
      targetPosition={targetPosition}
      routing={edgeRouting}
      isSelected={isSelected}
      isSimNodeEdge={isSimNodeEdge}
      isConnectedToSelectedNode={isConnectedToSelectedNode}
      linkCount={linkCount}
      onDoubleClick={handleDoubleClick}
      hoverKey={`std:${id}`}
      hoverHud={{
        nodeA: edgeNodeA,
        ifaceA: singleMember?.sourceInterface ?? '',
        nodeB: edgeNodeB,
        ifaceB: singleMember?.targetInterface,
        kind: isSimNodeEdge ? 'sim' : 'link',
        linkName: singleMember ? singleMember.name : `${linkCount} links`,
      }}
    />
  );
}
