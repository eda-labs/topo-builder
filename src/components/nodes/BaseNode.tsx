import { type ReactNode, useMemo } from 'react';
import { Handle, Position, useStore } from '@xyflow/react';

import { useTopologyStore } from '../../lib/store';
import { getNodeCenter } from '../../lib/edgeUtils';

export interface BaseNodeProps {
  nodeId: string;
  selected: boolean;
  name: string;
  icon?: ReactNode;
  className?: string;
  testId?: string;
}

type NodeLike = { id: string; position: { x: number; y: number }; measured?: { width?: number; height?: number } };
type EdgeLike = { source: string; target: string; data?: { esiLeaves?: Array<{ nodeId: string }> } };

function getConnectedPosition(
  thisNode: NodeLike,
  otherNode: NodeLike,
): Position {
  const thisCenter = getNodeCenter(thisNode);
  const otherCenter = getNodeCenter(otherNode);

  const horizontalDiff = Math.abs(thisCenter.x - otherCenter.x);
  const verticalDiff = Math.abs(thisCenter.y - otherCenter.y);

  if (horizontalDiff > verticalDiff) {
    return thisCenter.x > otherCenter.x ? Position.Left : Position.Right;
  } else {
    return thisCenter.y > otherCenter.y ? Position.Top : Position.Bottom;
  }
}

function addEsiLagConnectedPositions(
  positions: Set<Position>,
  nodeId: string,
  thisNode: NodeLike,
  edge: EdgeLike,
  nodesById: Map<string, NodeLike>,
  esiLeaves: Array<{ nodeId: string }>,
) {
  // ESI-LAG edges connect the source node to many leaf nodes.
  if (edge.source === nodeId) {
    for (const leaf of esiLeaves) {
      const leafNode = nodesById.get(leaf.nodeId);
      if (leafNode) positions.add(getConnectedPosition(thisNode, leafNode));
    }
    return;
  }

  const leafIds = new Set(esiLeaves.map(l => l.nodeId));
  if (!leafIds.has(nodeId)) return;

  const sourceNode = nodesById.get(edge.source);
  if (sourceNode) positions.add(getConnectedPosition(thisNode, sourceNode));
}

function addStandardConnectedPositions(
  positions: Set<Position>,
  nodeId: string,
  thisNode: NodeLike,
  edge: EdgeLike,
  nodesById: Map<string, NodeLike>,
) {
  let otherNodeId: string | null = null;
  if (edge.source === nodeId) otherNodeId = edge.target;
  else if (edge.target === nodeId) otherNodeId = edge.source;
  if (!otherNodeId) return;

  const otherNode = nodesById.get(otherNodeId);
  if (otherNode) positions.add(getConnectedPosition(thisNode, otherNode));
}

function computeConnectedPositions(nodeId: string, edges: EdgeLike[], nodes: NodeLike[]): Set<Position> {
  const positions = new Set<Position>();

  const nodesById = new Map(nodes.map(n => [n.id, n]));
  const thisNode = nodesById.get(nodeId);
  if (!thisNode) return positions;

  for (const edge of edges) {
    const esiLeaves = edge.data?.esiLeaves;
    if (esiLeaves?.length) {
      addEsiLagConnectedPositions(positions, nodeId, thisNode, edge, nodesById, esiLeaves);
    } else {
      addStandardConnectedPositions(positions, nodeId, thisNode, edge, nodesById);
    }
  }

  return positions;
}

export default function BaseNode({
  nodeId,
  selected,
  name,
  icon,
  className = '',
  testId,
}: BaseNodeProps) {
  const darkMode = useTopologyStore(state => state.darkMode);
  const edges = useTopologyStore(state => state.edges);
  const nodes = useTopologyStore(state => state.nodes);

  const isConnecting = useStore(state => state.connection.inProgress);

  const connectedPositions = useMemo(() => {
    return computeConnectedPositions(nodeId, edges, nodes);
  }, [edges, nodes, nodeId]);

  const alwaysShowAll = selected || isConnecting;

  const getHandleClassName = (position: Position) => {
    const isConnected = connectedPositions.has(position);
    const baseClass = '!w-2.5 !h-2.5 !bg-(--color-handle-bg) !border !border-solid !border-(--color-node-border) transition-opacity duration-150';

    if (alwaysShowAll || isConnected) {
      return `${baseClass} !opacity-100`;
    }
    return `${baseClass} !opacity-0 group-hover:!opacity-100`;
  };

  return (
    <div
      onDoubleClick={() => window.dispatchEvent(new CustomEvent('focusNodeName'))}
      data-testid={testId}
      className={`group relative w-20 h-20 bg-(--color-node-bg) border rounded-lg flex flex-col items-center justify-center gap-0.5 ${
        selected ? 'border-(--color-node-border-selected)' : 'border-(--color-node-border)'
      } ${darkMode ? 'dark' : ''} ${className || 'border-solid'}`}
    >
      <Handle type="source" position={Position.Top} id="top" className={getHandleClassName(Position.Top)} />
      <Handle type="target" position={Position.Top} id="top-target" className="!opacity-0 !w-2.5 !h-2.5" />
      <Handle type="source" position={Position.Bottom} id="bottom" className={getHandleClassName(Position.Bottom)} />
      <Handle type="target" position={Position.Bottom} id="bottom-target" className="!opacity-0 !w-2.5 !h-2.5" />
      <Handle type="source" position={Position.Left} id="left" className={getHandleClassName(Position.Left)} />
      <Handle type="target" position={Position.Left} id="left-target" className="!opacity-0 !w-2.5 !h-2.5" />
      <Handle type="source" position={Position.Right} id="right" className={getHandleClassName(Position.Right)} />
      <Handle type="target" position={Position.Right} id="right-target" className="!opacity-0 !w-2.5 !h-2.5" />

      <div
        onDoubleClick={() => window.dispatchEvent(new CustomEvent('focusNodeName'))}
        className="flex flex-col items-center justify-center gap-0.5"
      >
        <span className="pointer-events-none">{icon}</span>
        <div className="w-17.5 text-xs font-bold text-(--color-node-text) text-center overflow-hidden text-ellipsis whitespace-nowrap pointer-events-none">
          {name}
        </div>
      </div>
    </div>
  );
}
