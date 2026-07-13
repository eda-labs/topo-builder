import type { Position } from '@xyflow/react';
import { getBezierPath, getSmoothStepPath, EdgeLabelRenderer } from '@xyflow/react';
import { Bezier } from 'bezier-js';
import { Chip } from '@mui/material';

import { getControlPoint } from '../../lib/edgeUtils';
import { EDGE_INTERACTION_WIDTH } from '../../lib/constants';
import type { EdgeRouting } from '../../lib/store/createStore';
import { useHoverMode, useHoverTrace, type HoverHudInfo } from '../../lib/store/hoverTrace';

interface StandardEdgeProps {
  testId?: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: Position;
  targetPosition: Position;
  routing?: EdgeRouting;
  isSelected: boolean;
  isSimNodeEdge: boolean;
  isConnectedToSelectedNode?: boolean;
  linkCount: number;
  onDoubleClick?: () => void;
  /** hover-trace identity + HUD payload (edges without one stay inert but still dim) */
  hoverKey?: string;
  hoverHud?: HoverHudInfo;
}

export default function StandardEdge({
  testId,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  routing = 'curved',
  isSelected,
  isSimNodeEdge,
  isConnectedToSelectedNode,
  linkCount,
  onDoubleClick,
  hoverKey,
  hoverHud,
}: StandardEdgeProps) {
  const hoverMode = useHoverMode(hoverKey ?? null);
  const setHover = useHoverTrace(state => state.setHover);
  const clearHover = useHoverTrace(state => state.clearHover);
  let edgePath: string;
  let edgeMidpoint: { x: number; y: number };

  if (routing === 'elbow') {
    const [path, labelX, labelY] = getSmoothStepPath({
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition,
      targetPosition,
      borderRadius: 6,
    });
    edgePath = path;
    edgeMidpoint = { x: labelX, y: labelY };
  } else if (sourcePosition === targetPosition) {
    const distance = Math.sqrt((targetX - sourceX) ** 2 + (targetY - sourceY) ** 2);
    const curvature = Math.max(50, distance * 0.5);
    const c1 = getControlPoint(sourceX, sourceY, sourcePosition, curvature);
    const c2 = getControlPoint(targetX, targetY, targetPosition, curvature);

    const bezier = new Bezier(
      sourceX, sourceY,
      c1.x, c1.y,
      c2.x, c2.y,
      targetX, targetY,
    );
    edgePath = bezier.toSVG();
    const mid = bezier.get(0.5);
    edgeMidpoint = { x: mid.x, y: mid.y };
  } else {
    const [path, labelX, labelY] = getBezierPath({
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition,
      targetPosition,
    });
    edgePath = path;
    edgeMidpoint = { x: labelX, y: labelY };
  }

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onDoubleClick?.();
  };

  const hovered = hoverMode === 'on';
  let strokeColor = 'var(--color-link-stroke)';
  if (isConnectedToSelectedNode || hovered) {
    strokeColor = 'var(--color-link-stroke-highlight)';
  }
  if (isSelected) {
    strokeColor = 'var(--color-link-stroke-selected)';
  }

  return (
    <>
      <g
        onDoubleClick={handleDoubleClick}
        style={{ cursor: linkCount > 1 ? 'pointer' : 'default' }}
      >
        <path
          className="react-flow__edge-interaction"
          data-testid={testId}
          d={edgePath}
          fill="none"
          stroke="transparent"
          strokeWidth={EDGE_INTERACTION_WIDTH}
          onMouseEnter={hoverKey ? () => { setHover(hoverKey, hoverHud ?? null); } : undefined}
          onMouseLeave={hoverKey ? () => { clearHover(hoverKey); } : undefined}
        />
        <path
          d={edgePath}
          fill="none"
          stroke={strokeColor}
          strokeWidth={hovered ? 2 : 1}
          strokeDasharray={isSimNodeEdge ? '5 5' : undefined}
          opacity={hoverMode === 'dim' ? 0.15 : 1}
          style={{ transition: 'opacity 120ms, stroke-width 120ms' }}
        />
      </g>
      {linkCount > 1 && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${edgeMidpoint.x}px, ${edgeMidpoint.y}px)`,
              pointerEvents: 'all',
            }}
            onClick={e => { e.stopPropagation(); onDoubleClick?.(); }}
          >
            <Chip
              label={linkCount}
              size="small"
              title={`${linkCount} links - click to expand`}
              sx={{
                height: '14px',
                minWidth: '14px',
                fontSize: '8px',
                fontWeight: 400,
                bgcolor: 'var(--color-node-bg)',
                color: 'var(--color-node-text)',
                border: '1px solid var(--color-link-stroke)',
                cursor: 'pointer',
                '& .MuiChip-label': { px: '3px' },
              }}
            />
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
