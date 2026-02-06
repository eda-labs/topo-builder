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
  const strokeColor = isSelected ? 'var(--color-link-stroke-selected)' : isConnectedToSelectedNode ? 'var(--color-link-stroke-highlight)' : 'var(--color-link-stroke)';

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
  let sourceX: number;
  let sourceY: number;

  switch (sourcePosition) {
    case Position.Top:
      sourceX = sourceNode.position.x + sourceWidth / 2;
      sourceY = sourceNode.position.y;
      break;
    case Position.Bottom:
      sourceX = sourceNode.position.x + sourceWidth / 2;
      sourceY = sourceNode.position.y + sourceHeight;
      break;
    case Position.Left:
      sourceX = sourceNode.position.x;
      sourceY = sourceNode.position.y + sourceHeight / 2;
      break;
    case Position.Right:
      sourceX = sourceNode.position.x + sourceWidth;
      sourceY = sourceNode.position.y + sourceHeight / 2;
      break;
  }

  let stemX = sourceX;
  let stemY = sourceY;

  switch (sourcePosition) {
    case Position.Top:
      stemY = sourceY - ESI_LAG_STEM_LENGTH;
      break;
    case Position.Bottom:
      stemY = sourceY + ESI_LAG_STEM_LENGTH;
      break;
    case Position.Left:
      stemX = sourceX - ESI_LAG_STEM_LENGTH;
      break;
    case Position.Right:
      stemX = sourceX + ESI_LAG_STEM_LENGTH;
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
