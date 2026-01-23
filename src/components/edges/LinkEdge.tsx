import { getBezierPath, BaseEdge, Position, EdgeLabelRenderer, type EdgeProps } from '@xyflow/react';
import { Bezier } from 'bezier-js';
import { Chip } from '@mui/material';
import { useTopologyStore } from '../../lib/store';
import type { TopologyEdgeData, MemberLink, LagGroup } from '../../types/topology';

function getControlPoint(x: number, y: number, position: Position, offset: number): { x: number; y: number } {
  switch (position) {
    case Position.Top:
      return { x, y: y - offset };
    case Position.Bottom:
      return { x, y: y + offset };
    case Position.Left:
      return { x: x - offset, y };
    case Position.Right:
      return { x: x + offset, y };
    default:
      return { x, y: y - offset };
  }
}

function getPerpendicularOffset(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  offset: number
): { x: number; y: number } {
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length === 0) return { x: 0, y: offset };
  const px = -dy / length;
  const py = dx / length;
  return { x: px * offset, y: py * offset };
}

function calculateLinkOffsets(linkCount: number, spacing: number = 8): number[] {
  if (linkCount <= 1) return [0];
  const offsets: number[] = [];
  const totalWidth = (linkCount - 1) * spacing;
  const startOffset = -totalWidth / 2;
  for (let i = 0; i < linkCount; i++) {
    offsets.push(startOffset + i * spacing);
  }
  return offsets;
}

function createFannedBezierPath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  sourcePosition: Position,
  targetPosition: Position,
  offset: number
): { path: string; midpoint: { x: number; y: number } } {
  const perp = getPerpendicularOffset(sourceX, sourceY, targetX, targetY, offset);

  let bezier: Bezier;

  if (sourcePosition === targetPosition) {
    const distance = Math.sqrt((targetX - sourceX) ** 2 + (targetY - sourceY) ** 2);
    const curvature = Math.max(50, distance * 0.5);
    const c1Base = getControlPoint(sourceX, sourceY, sourcePosition, curvature);
    const c2Base = getControlPoint(targetX, targetY, targetPosition, curvature);

    const c1 = { x: c1Base.x + perp.x * 2, y: c1Base.y + perp.y * 2 };
    const c2 = { x: c2Base.x + perp.x * 2, y: c2Base.y + perp.y * 2 };

    bezier = new Bezier(
      sourceX, sourceY,
      c1.x, c1.y,
      c2.x, c2.y,
      targetX, targetY
    );
  } else {
    const distance = Math.sqrt((targetX - sourceX) ** 2 + (targetY - sourceY) ** 2);
    const curvature = Math.max(50, distance * 0.3);

    const c1Base = getControlPoint(sourceX, sourceY, sourcePosition, curvature);
    const c2Base = getControlPoint(targetX, targetY, targetPosition, curvature);

    const c1 = { x: c1Base.x + perp.x * 2, y: c1Base.y + perp.y * 2 };
    const c2 = { x: c2Base.x + perp.x * 2, y: c2Base.y + perp.y * 2 };

    bezier = new Bezier(
      sourceX, sourceY,
      c1.x, c1.y,
      c2.x, c2.y,
      targetX, targetY
    );
  }

  const mid = bezier.get(0.5);
  return { path: bezier.toSVG(), midpoint: { x: mid.x, y: mid.y } };
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
  selected,
  data,
}: EdgeProps) {
  const edgeData = data as TopologyEdgeData | undefined;
  const isSimNodeEdge = source?.startsWith('sim-') || target?.startsWith('sim-');
  const expandedEdges = useTopologyStore((state) => state.expandedEdges);
  const selectedMemberLinkIndices = useTopologyStore((state) => state.selectedMemberLinkIndices);
  const selectedEdgeId = useTopologyStore((state) => state.selectedEdgeId);
  const toggleEdgeExpanded = useTopologyStore((state) => state.toggleEdgeExpanded);
  const selectMemberLink = useTopologyStore((state) => state.selectMemberLink);

  const memberLinks: MemberLink[] = edgeData?.memberLinks || [];
  const lagGroups: LagGroup[] = edgeData?.lagGroups || [];
  const linkCount = memberLinks.length;
  const isExpanded = expandedEdges.has(id);
  const isThisEdgeSelected = selectedEdgeId === id;

  const indicesInLags = new Set<number>();
  for (const lag of lagGroups) {
    for (const idx of lag.memberLinkIndices) {
      indicesInLags.add(idx);
    }
  }

  const midX = (sourceX + targetX) / 2;
  const midY = (sourceY + targetY) / 2;

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
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

  let edgePath: string;
  if (sourcePosition === targetPosition) {
    const distance = Math.sqrt((targetX - sourceX) ** 2 + (targetY - sourceY) ** 2);
    const curvature = Math.max(50, distance * 0.5);
    const c1 = getControlPoint(sourceX, sourceY, sourcePosition, curvature);
    const c2 = getControlPoint(targetX, targetY, targetPosition, curvature);

    const bezier = new Bezier(
      sourceX, sourceY,
      c1.x, c1.y,
      c2.x, c2.y,
      targetX, targetY
    );
    edgePath = bezier.toSVG();
  } else {
    [edgePath] = getBezierPath({
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition,
      targetPosition,
    });
  }

  if (isExpanded && linkCount > 0) {
    type VisualItem =
      | { type: 'link'; index: number }
      | { type: 'lag'; lag: LagGroup };

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

    return (
      <>
        <g onDoubleClick={handleDoubleClick}>
          {visualItems.map((item, visualIndex) => {
            const offset = offsets[visualIndex];
            const { path: curvePath, midpoint: curveMidpoint } = createFannedBezierPath(
              sourceX, sourceY, targetX, targetY,
              sourcePosition, targetPosition, offset
            );

            if (item.type === 'link') {
              const isSelectedMemberLink = isThisEdgeSelected && selectedMemberLinkIndices.includes(item.index);

              return (
                <g
                  key={`link-${item.index}`}
                  onClick={(e) => handleMemberLinkClick(e, item.index)}
                  onContextMenu={(e) => handleMemberLinkContextMenu(e, item.index)}
                  style={{ cursor: 'pointer' }}
                >
                  <path d={curvePath} fill="none" stroke="transparent" strokeWidth={12} />
                  <path
                    d={curvePath}
                    fill="none"
                    stroke={isSelectedMemberLink ? 'var(--color-link-stroke-selected)' : 'var(--color-link-stroke)'}
                    strokeWidth={1}
                    className={isSimNodeEdge ? 'sim-edge' : ''}
                    style={isSimNodeEdge ? { strokeDasharray: '5 5' } : undefined}
                  />
                </g>
              );
            } else {
              const lagIndices = item.lag.memberLinkIndices;
              const isLagSelected = isThisEdgeSelected && lagIndices.some(idx => selectedMemberLinkIndices.includes(idx));
              const lagMidpoint = curveMidpoint;

              return (
                <g key={`lag-${item.lag.id}`}>
                  <g
                    onClick={(e) => {
                      e.stopPropagation();
                      lagIndices.forEach((idx, i) => selectMemberLink(id, idx, i > 0 || e.shiftKey));
                    }}
                    onContextMenu={() => {
                      const allSelected = lagIndices.every(idx => selectedMemberLinkIndices.includes(idx));
                      if (!allSelected) {
                        lagIndices.forEach((idx) => selectMemberLink(id, idx, true));
                      }
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <path d={curvePath} fill="none" stroke="transparent" strokeWidth={12} />
                    <path
                      d={curvePath}
                      fill="none"
                      stroke={isLagSelected ? 'var(--color-link-stroke-selected)' : 'var(--color-link-stroke)'}
                      strokeWidth={1}
                      className={isSimNodeEdge ? 'sim-edge' : ''}
                      style={isSimNodeEdge ? { strokeDasharray: '5 5' } : undefined}
                    />
                  </g>
                  <EdgeLabelRenderer>
                    <div
                      style={{
                        position: 'absolute',
                        transform: `translate(-50%, -50%) translate(${lagMidpoint.x}px, ${lagMidpoint.y}px)`,
                        pointerEvents: 'none',
                      }}
                    >
                      <Chip
                        label="LAG"
                        size="small"
                        title={`Local LAG: ${item.lag.name} (${lagIndices.length} endpoints)`}
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
      </>
    );
  }

  return (
    <>
      <g onDoubleClick={handleDoubleClick}>
        <BaseEdge
          id={id}
          path={edgePath}
          className={isSimNodeEdge ? 'sim-edge' : ''}
          interactionWidth={20}
          style={{
            stroke: selected ? 'var(--color-link-stroke-selected)' : 'var(--color-link-stroke)',
            strokeWidth: 1,
            ...(isSimNodeEdge && { strokeDasharray: '5 5' }),
          }}
        />
      </g>
      {linkCount > 1 && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${midX}px, ${midY}px)`,
              pointerEvents: 'all',
            }}
            onDoubleClick={handleDoubleClick}
          >
            <Chip
              label={linkCount}
              size="small"
              title={`${linkCount} links - double-click to expand`}
              sx={{
                height: '14px',
                minWidth: '14px',
                fontSize: '8px',
                fontWeight: 400,
                bgcolor: 'var(--color-node-bg)',
                color: 'var(--color-node-text)',
                border: '1px solid var(--color-link-stroke)',
                cursor: 'pointer',
                '& .MuiChip-label': {
                  px: '3px',
                },
              }}
            />
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
