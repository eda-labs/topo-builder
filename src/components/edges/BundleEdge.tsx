import { useEffect } from 'react';
import type { Position } from '@xyflow/react';
import { getSmoothStepPath } from '@xyflow/react';

import { createFannedBezierPath, calculateLinkOffsets } from '../../lib/edgeUtils';
import { EDGE_INTERACTION_WIDTH } from '../../lib/constants';
import { LINK_KIND_COLOR, cableOpacity, cableStrokeWidth } from '../../lib/linkColors';
import type { EdgeRouting } from '../../lib/store/createStore';
import { lagHoverKey, memberHoverKey, useHoverMode, useHoverTrace, type HoverHudInfo } from '../../lib/store/hoverTrace';
import type { UIMemberLink, UILagGroup } from '../../types/ui';
import { topologyLagTestId, topologyMemberLinkTestId } from '../../lib/testIds';

import CableLabel from './CableLabel';

interface BundleEdgeProps {
  edgeId: string;
  edgeNodeA?: string;
  edgeNodeB?: string;
  routing?: EdgeRouting;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: Position;
  targetPosition: Position;
  isSelected: boolean;
  isSimNodeEdge: boolean;
  isConnectedToSelectedNode?: boolean;
  memberLinks: UIMemberLink[];
  lagGroups: UILagGroup[];
  selectedMemberLinkIndices: number[];
  selectedLagId: string | null;
  onDoubleClick?: () => void;
  onMemberLinkClick: (e: React.MouseEvent, index: number) => void;
  onMemberLinkContextMenu: (e: React.MouseEvent, index: number) => void;
  onLagClick: (e: React.MouseEvent, lagId: string) => void;
  onLagContextMenu: (lagId: string) => void;
}

function MemberLinkVisual({
  edgeId,
  member,
  index,
  curvePath,
  curveMidpoint,
  isSelected,
  isSimNodeEdge,
  isConnectedToSelectedNode,
  selectedMemberLinkIndices,
  onDoubleClick,
  onMemberLinkClick,
  onMemberLinkContextMenu,
  canBuildTestIds,
  edgeNodeA,
  edgeNodeB,
}: {
  edgeId: string;
  member: UIMemberLink;
  index: number;
  curvePath: string;
  curveMidpoint: { x: number; y: number };
  isSelected: boolean;
  isSimNodeEdge: boolean;
  isConnectedToSelectedNode?: boolean;
  selectedMemberLinkIndices: number[];
  onDoubleClick: (e: React.MouseEvent) => void;
  onMemberLinkClick: (e: React.MouseEvent, index: number) => void;
  onMemberLinkContextMenu: (e: React.MouseEvent, index: number) => void;
  canBuildTestIds: boolean;
  edgeNodeA?: string;
  edgeNodeB?: string;
}) {
  const hoverKey = memberHoverKey(edgeId, index);
  const hoverMode = useHoverMode(hoverKey);
  const setHover = useHoverTrace(state => state.setHover);
  const clearHover = useHoverTrace(state => state.clearHover);

  // A member deleted mid-hover never fires mouseleave — drop its trace on unmount.
  useEffect(() => () => { clearHover(hoverKey); }, [hoverKey, clearHover]);

  const isSelectedMemberLink = isSelected && selectedMemberLinkIndices.includes(index);
  const memberTestId =
    canBuildTestIds && edgeNodeA && edgeNodeB
      ? topologyMemberLinkTestId(edgeNodeA, edgeNodeB, index)
      : undefined;

  const handleMouseEnter = () => {
    const hud: HoverHudInfo = {
      nodeA: edgeNodeA ?? '',
      ifaceA: member.sourceInterface,
      nodeB: edgeNodeB ?? '',
      ifaceB: member.targetInterface,
      kind: isSimNodeEdge ? 'sim' : 'link',
      linkName: member.name,
    };
    setHover(hoverKey, hud);
  };

  const hovered = hoverMode === 'on';
  // Hover reveals the same interface label a click would — no selection required.
  const showLabel = hovered || isSelectedMemberLink;

  // Cable-map look: always the kind colour — a thin muted thread at idle that pops when
  // hovered, selected or attached to the selected node.
  const strokeColor = LINK_KIND_COLOR[isSimNodeEdge ? 'sim' : 'link'];
  const on = hovered || isSelectedMemberLink || Boolean(isConnectedToSelectedNode);

  return (
    <g
      onDoubleClick={onDoubleClick}
      style={{ cursor: 'pointer' }}
    >
      <path
        className="react-flow__edge-interaction"
        data-testid={memberTestId}
        d={curvePath}
        fill="none"
        stroke="transparent"
        strokeWidth={EDGE_INTERACTION_WIDTH}
        onClick={e => { onMemberLinkClick(e, index); }}
        onContextMenu={e => { onMemberLinkContextMenu(e, index); }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => { clearHover(hoverKey); }}
      />
      <path
        d={curvePath}
        fill="none"
        stroke={strokeColor}
        strokeWidth={cableStrokeWidth(on)}
        opacity={cableOpacity(on, hoverMode === 'dim')}
        style={{ transition: 'opacity 120ms, stroke-width 120ms' }}
        pointerEvents="none"
      />
      {showLabel && (
        <CableLabel
          x={curveMidpoint.x}
          y={curveMidpoint.y}
          label={`${member.sourceInterface} ↔ ${member.targetInterface}`}
          title={member.name}
          color={strokeColor}
        />
      )}
    </g>
  );
}

function LagVisual({
  edgeId,
  lag,
  firstMember,
  curvePath,
  curveMidpoint,
  isSelected,
  isConnectedToSelectedNode,
  selectedLagId,
  onDoubleClick,
  onLagClick,
  onLagContextMenu,
  canBuildTestIds,
  edgeNodeA,
  edgeNodeB,
}: {
  edgeId: string;
  lag: UILagGroup;
  firstMember?: UIMemberLink;
  curvePath: string;
  curveMidpoint: { x: number; y: number };
  isSelected: boolean;
  isConnectedToSelectedNode?: boolean;
  selectedLagId: string | null;
  onDoubleClick: (e: React.MouseEvent) => void;
  onLagClick: (e: React.MouseEvent, lagId: string) => void;
  onLagContextMenu: (lagId: string) => void;
  canBuildTestIds: boolean;
  edgeNodeA?: string;
  edgeNodeB?: string;
}) {
  const hoverKey = lagHoverKey(edgeId, lag.id);
  const hoverMode = useHoverMode(hoverKey);
  const setHover = useHoverTrace(state => state.setHover);
  const clearHover = useHoverTrace(state => state.clearHover);

  // A LAG deleted mid-hover never fires mouseleave — drop its trace on unmount.
  useEffect(() => () => { clearHover(hoverKey); }, [hoverKey, clearHover]);

  const isLagSelected = isSelected && selectedLagId === lag.id;
  const lagTestId =
    canBuildTestIds && edgeNodeA && edgeNodeB
      ? topologyLagTestId(edgeNodeA, edgeNodeB, lag.name)
      : undefined;

  const handleMouseEnter = () => {
    const hud: HoverHudInfo = {
      nodeA: edgeNodeA ?? '',
      ifaceA: firstMember?.sourceInterface ?? '',
      nodeB: edgeNodeB ?? '',
      ifaceB: firstMember?.targetInterface,
      kind: 'lag',
      linkName: `${lag.memberLinkIndices.length} links`,
      lagName: lag.name,
    };
    setHover(hoverKey, hud);
  };

  const hovered = hoverMode === 'on';
  // Cable-map look: the LAG line always wears the local-LAG yellow — a thin muted thread at
  // idle that pops when hovered, selected or attached to the selected node.
  const on = hovered || isLagSelected || Boolean(isConnectedToSelectedNode);
  const showLabel = hovered || isLagSelected;

  return (
    <g>
      <g
        onDoubleClick={onDoubleClick}
        style={{ cursor: 'pointer' }}
      >
        <path
          className="react-flow__edge-interaction"
          data-testid={lagTestId}
          d={curvePath}
          fill="none"
          stroke="transparent"
          strokeWidth={EDGE_INTERACTION_WIDTH}
          onClick={e => { onLagClick(e, lag.id); }}
          onContextMenu={() => { onLagContextMenu(lag.id); }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={() => { clearHover(hoverKey); }}
        />
        <path
          d={curvePath}
          fill="none"
          stroke={LINK_KIND_COLOR.lag}
          strokeWidth={cableStrokeWidth(on)}
          opacity={cableOpacity(on, hoverMode === 'dim')}
          style={{ transition: 'opacity 120ms, stroke-width 120ms' }}
          pointerEvents="none"
        />
      </g>
      {showLabel && (
        <CableLabel
          x={curveMidpoint.x}
          y={curveMidpoint.y}
          label={`${lag.name} × ${lag.memberLinkIndices.length}`}
          title={`Local LAG: ${lag.name} (${lag.memberLinkIndices.length} endpoints)`}
          color={LINK_KIND_COLOR.lag}
        />
      )}
    </g>
  );
}

export default function BundleEdge({
  edgeId,
  edgeNodeA,
  edgeNodeB,
  routing = 'curved',
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  isSelected,
  isSimNodeEdge,
  isConnectedToSelectedNode,
  memberLinks,
  lagGroups,
  selectedMemberLinkIndices,
  selectedLagId,
  onDoubleClick,
  onMemberLinkClick,
  onMemberLinkContextMenu,
  onLagClick,
  onLagContextMenu,
}: BundleEdgeProps) {
  const canBuildTestIds = Boolean(edgeNodeA && edgeNodeB);
  const indicesInLags = new Set<number>();
  for (const lag of lagGroups) {
    for (const idx of lag.memberLinkIndices) {
      indicesInLags.add(idx);
    }
  }

  type VisualItem = { type: 'link'; index: number } | { type: 'lag'; lag: UILagGroup };
  const visualItems: VisualItem[] = [];

  memberLinks.forEach((_, index) => {
    if (!indicesInLags.has(index)) {
      visualItems.push({ type: 'link', index });
    }
  });

  for (const lag of lagGroups) {
    visualItems.push({ type: 'lag', lag });
  }

  const offsets = calculateLinkOffsets(visualItems.length);

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onDoubleClick?.();
  };

  return (
    <g>
      {visualItems.map((item, visualIndex) => {
        const offset = offsets[visualIndex];
        // Elbow mode routes each bundle line as a smoothstep with its own spread, matching the
        // per-port cables; curved mode keeps the fanned beziers.
        const { path: curvePath, midpoint: curveMidpoint } = routing === 'elbow'
          ? (() => {
            const [path, labelX, labelY] = getSmoothStepPath({
              sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
              borderRadius: 6,
              offset: 14 + (visualIndex % 8) * 5,
            });
            return { path, midpoint: { x: labelX, y: labelY } };
          })()
          : createFannedBezierPath(
            sourceX, sourceY, targetX, targetY,
            sourcePosition, targetPosition, offset,
          );

        if (item.type === 'link') {
          return (
            <MemberLinkVisual
              key={`link-${item.index}`}
              edgeId={edgeId}
              member={memberLinks[item.index]}
              index={item.index}
              curvePath={curvePath}
              curveMidpoint={curveMidpoint}
              isSelected={isSelected}
              isSimNodeEdge={isSimNodeEdge}
              isConnectedToSelectedNode={isConnectedToSelectedNode}
              selectedMemberLinkIndices={selectedMemberLinkIndices}
              onDoubleClick={handleDoubleClick}
              onMemberLinkClick={onMemberLinkClick}
              onMemberLinkContextMenu={onMemberLinkContextMenu}
              canBuildTestIds={canBuildTestIds}
              edgeNodeA={edgeNodeA}
              edgeNodeB={edgeNodeB}
            />
          );
        }

        return (
          <LagVisual
            key={`lag-${item.lag.id}`}
            edgeId={edgeId}
            lag={item.lag}
            firstMember={memberLinks[item.lag.memberLinkIndices[0]]}
            curvePath={curvePath}
            curveMidpoint={curveMidpoint}
            isSelected={isSelected}
            isConnectedToSelectedNode={isConnectedToSelectedNode}
            selectedLagId={selectedLagId}
            onDoubleClick={handleDoubleClick}
            onLagClick={onLagClick}
            onLagContextMenu={onLagContextMenu}
            canBuildTestIds={canBuildTestIds}
            edgeNodeA={edgeNodeA}
            edgeNodeB={edgeNodeB}
          />
        );
      })}
    </g>
  );
}
