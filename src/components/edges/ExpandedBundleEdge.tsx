import { EdgeLabelRenderer, Position } from '@xyflow/react';
import { Chip } from '@mui/material';
import { createFannedBezierPath, calculateLinkOffsets } from './edgeUtils';
import { EDGE_INTERACTION_WIDTH } from '../../lib/constants';
import type { MemberLink, LagGroup } from '../../types/topology';
import { topologyLagTestId, topologyMemberLinkTestId } from '../../lib/testIds';

interface ExpandedBundleEdgeProps {
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
  memberLinks: MemberLink[];
  lagGroups: LagGroup[];
  selectedMemberLinkIndices: number[];
  selectedLagId: string | null;
  onDoubleClick?: () => void;
  onMemberLinkClick: (e: React.MouseEvent, index: number) => void;
  onMemberLinkContextMenu: (e: React.MouseEvent, index: number) => void;
  onLagClick: (e: React.MouseEvent, lagId: string) => void;
  onLagContextMenu: (lagId: string) => void;
}

export default function ExpandedBundleEdge({
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
  memberLinks,
  lagGroups,
  selectedMemberLinkIndices,
  selectedLagId,
  onDoubleClick,
  onMemberLinkClick,
  onMemberLinkContextMenu,
  onLagClick,
  onLagContextMenu,
}: ExpandedBundleEdgeProps) {
  const canBuildTestIds = Boolean(edgeNodeA && edgeNodeB);
  const indicesInLags = new Set<number>();
  for (const lag of lagGroups) {
    for (const idx of lag.memberLinkIndices) {
      indicesInLags.add(idx);
    }
  }

  type VisualItem = { type: 'link'; index: number } | { type: 'lag'; lag: LagGroup };
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
          sourcePosition, targetPosition, offset
        );

        if (item.type === 'link') {
          const isSelectedMemberLink = isSelected && selectedMemberLinkIndices.includes(item.index);
          const memberTestId =
            canBuildTestIds && edgeNodeA && edgeNodeB
              ? topologyMemberLinkTestId(edgeNodeA, edgeNodeB, item.index)
              : undefined;

          return (
            <g
              key={`link-${item.index}`}
              onDoubleClick={handleDoubleClick}
              style={{ cursor: 'pointer' }}
            >
              <path
                className="react-flow__edge-interaction"
                data-testid={memberTestId}
                d={curvePath}
                fill="none"
                stroke="transparent"
                strokeWidth={EDGE_INTERACTION_WIDTH}
                onClick={(e) => onMemberLinkClick(e, item.index)}
                onContextMenu={(e) => onMemberLinkContextMenu(e, item.index)}
              />
              <path
                d={curvePath}
                fill="none"
                stroke={isSelectedMemberLink ? 'var(--color-link-stroke-selected)' : 'var(--color-link-stroke)'}
                strokeWidth={1}
                strokeDasharray={isSimNodeEdge ? '5 5' : undefined}
                pointerEvents="none"
              />
            </g>
          );
        } else {
          const isLagSelected = isSelected && selectedLagId === item.lag.id;
          const lagTestId =
            canBuildTestIds && edgeNodeA && edgeNodeB
              ? topologyLagTestId(edgeNodeA, edgeNodeB, item.lag.name)
              : undefined;

          return (
            <g key={`lag-${item.lag.id}`}>
              <g
                onDoubleClick={handleDoubleClick}
                style={{ cursor: 'pointer' }}
              >
                <path
                  className="react-flow__edge-interaction"
                  data-testid={lagTestId}
                  d={curvePath}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={EDGE_INTERACTION_WIDTH}
                  onClick={(e) => onLagClick(e, item.lag.id)}
                  onContextMenu={() => onLagContextMenu(item.lag.id)}
                />
                <path
                  d={curvePath}
                  fill="none"
                  stroke={isLagSelected ? 'var(--color-link-stroke-selected)' : 'var(--color-link-stroke)'}
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
                    title={`Local LAG: ${item.lag.name} (${item.lag.memberLinkIndices.length} endpoints)`}
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
      })}
    </g>
  );
}
