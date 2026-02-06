import { Position } from '@xyflow/react';

import { getFloatingEdgeParams, getControlPoint, getNodeCenter } from '../../lib/edgeUtils';
import { EDGE_INTERACTION_WIDTH, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT, ESI_LAG_STEM_LENGTH } from '../../lib/constants';
import type { UIEsiLeaf } from '../../types/ui';

interface NodeInfo {
  id: string;
  position: { x: number; y: number };
  measured?: { width?: number; height?: number };
}

interface EsiLagEdgeProps {
  id: string;
  testId?: string;
  sourceNode: NodeInfo;
  isSelected: boolean;
  isSimNodeEdge: boolean;
  isConnectedToSelectedNode?: boolean;
  esiLeaves: UIEsiLeaf[];
  leafNodes: Map<string, NodeInfo>;
}

export default function EsiLagEdge({
  id,
  testId,
  sourceNode,
  isSelected,
  isSimNodeEdge,
  isConnectedToSelectedNode,
  esiLeaves,
  leafNodes,
}: EsiLagEdgeProps) {
  let strokeColor = 'var(--color-link-stroke)';
  if (isConnectedToSelectedNode) {
    strokeColor = 'var(--color-link-stroke-highlight)';
  }
  if (isSelected) {
    strokeColor = 'var(--color-link-stroke-selected)';
  }

  const sourceCenter = getNodeCenter(sourceNode);

  const leafNodeInfos = esiLeaves
    .map(leaf => leafNodes.get(leaf.nodeId))
    .filter((n): n is NodeInfo => n !== undefined);

  if (leafNodeInfos.length === 0) return null;

  const avgTargetCenter = {
    x: leafNodeInfos.reduce((sum, n) => sum + getNodeCenter(n).x, 0) / leafNodeInfos.length,
    y: leafNodeInfos.reduce((sum, n) => sum + getNodeCenter(n).y, 0) / leafNodeInfos.length,
  };

  const horizontalDiff = Math.abs(sourceCenter.x - avgTargetCenter.x);
  const verticalDiff = Math.abs(sourceCenter.y - avgTargetCenter.y);

  let sourcePosition: Position;
  if (horizontalDiff > verticalDiff) {
    sourcePosition = sourceCenter.x > avgTargetCenter.x ? Position.Left : Position.Right;
  } else {
    sourcePosition = sourceCenter.y > avgTargetCenter.y ? Position.Top : Position.Bottom;
  }

  const sourceWidth = sourceNode.measured?.width || DEFAULT_NODE_WIDTH;
  const sourceHeight = sourceNode.measured?.height || DEFAULT_NODE_HEIGHT;
  const sourceAnchorPoints: Record<Position, { x: number; y: number }> = {
    [Position.Top]: {
      x: sourceNode.position.x + sourceWidth / 2,
      y: sourceNode.position.y,
    },
    [Position.Bottom]: {
      x: sourceNode.position.x + sourceWidth / 2,
      y: sourceNode.position.y + sourceHeight,
    },
    [Position.Left]: {
      x: sourceNode.position.x,
      y: sourceNode.position.y + sourceHeight / 2,
    },
    [Position.Right]: {
      x: sourceNode.position.x + sourceWidth,
      y: sourceNode.position.y + sourceHeight / 2,
    },
  };

  const { x: sourceX, y: sourceY } = sourceAnchorPoints[sourcePosition];

  const stemDeltas: Record<Position, { dx: number; dy: number }> = {
    [Position.Top]: { dx: 0, dy: -ESI_LAG_STEM_LENGTH },
    [Position.Bottom]: { dx: 0, dy: ESI_LAG_STEM_LENGTH },
    [Position.Left]: { dx: -ESI_LAG_STEM_LENGTH, dy: 0 },
    [Position.Right]: { dx: ESI_LAG_STEM_LENGTH, dy: 0 },
  };

  const { dx, dy } = stemDeltas[sourcePosition];
  const stemX = sourceX + dx;
  const stemY = sourceY + dy;

  const createPath = (tgtX: number, tgtY: number, tgtPosition: Position): string => {
    const distance = Math.sqrt((tgtX - stemX) ** 2 + (tgtY - stemY) ** 2);
    const curvature = Math.max(50, distance * 0.3);

    const c1 = getControlPoint(stemX, stemY, sourcePosition, curvature);
    const c2 = getControlPoint(tgtX, tgtY, tgtPosition, curvature);

    return `M ${sourceX} ${sourceY} L ${stemX} ${stemY} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${tgtX} ${tgtY}`;
  };

  const paths: string[] = [];

  for (const leaf of esiLeaves) {
    const leafNode = leafNodes.get(leaf.nodeId);
    if (!leafNode) continue;

    const { tx, ty, targetPos } = getFloatingEdgeParams(sourceNode, leafNode);
    paths.push(createPath(tx, ty, targetPos));
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
