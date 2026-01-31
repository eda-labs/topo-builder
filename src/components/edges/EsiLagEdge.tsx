import { Position } from '@xyflow/react';
import { getHandleCoordinates, getControlPoint } from './edgeUtils';
import { EDGE_INTERACTION_WIDTH } from '../../lib/constants';
import type { EsiLeafConnection } from '../../types/topology';

interface NodeInfo {
  id: string;
  position: { x: number; y: number };
  measured?: { width?: number; height?: number };
}

interface EsiLagEdgeProps {
  id: string;
  testId?: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: Position;
  targetPosition: Position;
  isSelected: boolean;
  isSimNodeEdge: boolean;
  esiLeaves: EsiLeafConnection[];
  leafNodes: Map<string, NodeInfo>;
}

export default function EsiLagEdge({
  id,
  testId,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  isSelected,
  isSimNodeEdge,
  esiLeaves,
  leafNodes,
}: EsiLagEdgeProps) {
  const strokeColor = isSelected ? 'var(--color-link-stroke-selected)' : 'var(--color-link-stroke)';

  const stemLength = 25;
  let stemX = sourceX;
  let stemY = sourceY;

  switch (sourcePosition) {
    case Position.Top:
      stemY = sourceY - stemLength;
      break;
    case Position.Bottom:
      stemY = sourceY + stemLength;
      break;
    case Position.Left:
      stemX = sourceX - stemLength;
      break;
    case Position.Right:
      stemX = sourceX + stemLength;
      break;
  }

  const createPath = (tgtX: number, tgtY: number, tgtPosition: Position): string => {
    const distance = Math.sqrt((tgtX - stemX) ** 2 + (tgtY - stemY) ** 2);
    const curvature = Math.max(50, distance * 0.3);

    const c1 = getControlPoint(stemX, stemY, sourcePosition, curvature);
    const c2 = getControlPoint(tgtX, tgtY, tgtPosition, curvature);

    return `M ${sourceX} ${sourceY} L ${stemX} ${stemY} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${tgtX} ${tgtY}`;
  };

  const paths: string[] = [];

  paths.push(createPath(targetX, targetY, targetPosition));

  for (let i = 1; i < esiLeaves.length; i++) {
    const leaf = esiLeaves[i];
    const leafNode = leafNodes.get(leaf.nodeId);
    if (!leafNode) continue;

    const leafCoords = getHandleCoordinates(leafNode, leaf.leafHandle);
    paths.push(createPath(leafCoords.x, leafCoords.y, leafCoords.position));
  }

  return (
    <g>
      {paths.map((path, i) => (
        <g key={`${id}-path${i}`}>
          <path
            className="react-flow__edge-interaction"
            data-testid={i === 0 ? testId : undefined}
            d={path}
            fill="none"
            stroke="transparent"
            strokeWidth={EDGE_INTERACTION_WIDTH}
          />
          <path
            d={path}
            fill="none"
            stroke={strokeColor}
            strokeWidth={2}
            strokeDasharray={isSimNodeEdge ? '5 5' : undefined}
          />
        </g>
      ))}
    </g>
  );
}
