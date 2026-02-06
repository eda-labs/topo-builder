import type { Position } from '@xyflow/react';
import { EdgeLabelRenderer } from '@xyflow/react';
import { Chip } from '@mui/material';

import { createFannedBezierPath, calculateLinkOffsets } from '../../lib/edgeUtils';
import { EDGE_INTERACTION_WIDTH } from '../../lib/constants';
import type { UIMemberLink, UILagGroup } from '../../types/ui';
import { topologyLagTestId, topologyMemberLinkTestId } from '../../lib/testIds';

interface BundleEdgeProps {
  edgeNodeA?: string;
  edgeNodeB?: string;
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
  index,
  curvePath,
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
  index: number;
  curvePath: string;
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
  const isSelectedMemberLink = isSelected && selectedMemberLinkIndices.includes(index);
  const memberTestId =
    canBuildTestIds && edgeNodeA && edgeNodeB
      ? topologyMemberLinkTestId(edgeNodeA, edgeNodeB, index)
      : undefined;

  let strokeColor = 'var(--color-link-stroke)';
  if (isConnectedToSelectedNode) {
    strokeColor = 'var(--color-link-stroke-highlight)';
  }
  if (isSelectedMemberLink) {
    strokeColor = 'var(--color-link-stroke-selected)';
  }

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
      />
      <path
        d={curvePath}
        fill="none"
        stroke={strokeColor}
        strokeWidth={1}
        strokeDasharray={isSimNodeEdge ? '5 5' : undefined}
        pointerEvents="none"
      />
    </g>
  );
}

function LagVisual({
  lag,
  curvePath,
  curveMidpoint,
  isSelected,
  isSimNodeEdge,
  isConnectedToSelectedNode,
  selectedLagId,
  onDoubleClick,
  onLagClick,
  onLagContextMenu,
  canBuildTestIds,
  edgeNodeA,
  edgeNodeB,
}: {
  lag: UILagGroup;
  curvePath: string;
  curveMidpoint: { x: number; y: number };
  isSelected: boolean;
  isSimNodeEdge: boolean;
  isConnectedToSelectedNode?: boolean;
  selectedLagId: string | null;
  onDoubleClick: (e: React.MouseEvent) => void;
  onLagClick: (e: React.MouseEvent, lagId: string) => void;
  onLagContextMenu: (lagId: string) => void;
  canBuildTestIds: boolean;
  edgeNodeA?: string;
  edgeNodeB?: string;
}) {
  const isLagSelected = isSelected && selectedLagId === lag.id;
  const lagTestId =
    canBuildTestIds && edgeNodeA && edgeNodeB
      ? topologyLagTestId(edgeNodeA, edgeNodeB, lag.name)
      : undefined;

  let strokeColor = 'var(--color-link-stroke)';
  if (isConnectedToSelectedNode) {
    strokeColor = 'var(--color-link-stroke-highlight)';
  }
  if (isLagSelected) {
    strokeColor = 'var(--color-link-stroke-selected)';
  }

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
        />
        <path
          d={curvePath}
          fill="none"
          stroke={strokeColor}
          strokeWidth={1}
          strokeDasharray={isSimNodeEdge ? '5 5' : undefined}
          pointerEvents="none"
        />
      </g>
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${curveMidpoint.x}px, ${curveMidpoint.y}px)`,
            pointerEvents: 'none',
          }}
        >
          <Chip
            label="LAG"
            size="small"
            title={`Local LAG: ${lag.name} (${lag.memberLinkIndices.length} endpoints)`}
            sx={{
              height: '14px',
              fontSize: '8px',
              fontWeight: 400,
              bgcolor: 'var(--color-node-bg)',
              color: 'var(--color-node-text)',
              border: '1px solid var(--color-link-stroke)',
              '& .MuiChip-label': { px: '3px' },
            }}
          />
        </div>
      </EdgeLabelRenderer>
    </g>
  );
}

export default function BundleEdge({
  edgeNodeA,
  edgeNodeB,
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
        const { path: curvePath, midpoint: curveMidpoint } = createFannedBezierPath(
          sourceX, sourceY, targetX, targetY,
          sourcePosition, targetPosition, offset,
        );

        if (item.type === 'link') {
          return (
            <MemberLinkVisual
              key={`link-${item.index}`}
              index={item.index}
              curvePath={curvePath}
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
            lag={item.lag}
            curvePath={curvePath}
            curveMidpoint={curveMidpoint}
            isSelected={isSelected}
            isSimNodeEdge={isSimNodeEdge}
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
