import { type ReactNode, useMemo, useRef } from 'react';
import { Handle, Position, useStore } from '@xyflow/react';

import { useTopologyStore } from '../../lib/store';
import { getNodeCenter, parseHandlePosition } from '../../lib/edgeUtils';

function middleEllipsis(text: string, max: number): string {
  if (text.length <= max) return text;
  const left = Math.ceil((max - 1) / 2);
  const right = Math.floor((max - 1) / 2);
  return `${text.slice(0, left)}\u2026${text.slice(-right)}`;
}

export interface BaseNodeProps {
  nodeId: string;
  selected: boolean;
  name: string;
  icon?: ReactNode;
  className?: string;
  testId?: string;
  hasEdgeLinks?: boolean;
  onEdgeLinkClick?: () => void;
}

type NodeLike = { id: string; position: { x: number; y: number }; measured?: { width?: number; height?: number } };
type EdgeLike = { source: string; target: string; sourceHandle?: string | null; targetHandle?: string | null; data?: { esiLeaves?: Array<{ nodeId: string }> } };

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
  const isSource = edge.source === nodeId;
  const isTarget = edge.target === nodeId;
  if (!isSource && !isTarget) return;

  const storedHandle = isSource ? edge.sourceHandle : edge.targetHandle;
  if (storedHandle) {
    positions.add(parseHandlePosition(storedHandle));
    return;
  }

  const otherNodeId = isSource ? edge.target : edge.source;
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

function EdgeLinkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M0 4C0 1.79086 1.79086 0 4 0H16C18.2091 0 20 1.79086 20 4V16C20 18.2091 18.2091 20 16 20H4C1.79086 20 0 18.2091 0 16V4Z" fill="#919191" />
      <g transform="translate(4 4)">
        <path d="M1.23219 7.76802C0.255937 6.79165 0.255937 5.20865 1.23219 4.23228C2.20844 3.25591 3.79126 3.25591 4.76751 4.23228C5.74376 5.20865 5.74376 6.79166 4.76751 7.76803C3.79126 8.7444 2.20844 8.7444 1.23219 7.76802Z" fill="white" />
        <path fillRule="evenodd" clipRule="evenodd" d="M11.375 5.99982C11.375 6.10074 11.3343 6.19741 11.2622 6.26796L9.47216 8.01796C9.32407 8.16274 9.08665 8.16006 8.94187 8.01197C8.79708 7.86388 8.79977 7.62645 8.94786 7.48167L10.08 6.37482L6.875 6.37482C6.6679 6.37482 6.5 6.20692 6.5 5.99982C6.5 5.79271 6.6679 5.62482 6.875 5.62482H10.08L8.94786 4.51796C8.79977 4.37318 8.79708 4.13575 8.94187 3.98766C9.08665 3.83957 9.32407 3.83689 9.47216 3.98167L11.2622 5.73167C11.3343 5.80223 11.375 5.89889 11.375 5.99982Z" fill="white" />
      </g>
    </svg>
  );
}

export default function BaseNode({
  nodeId,
  selected,
  name,
  icon,
  className = '',
  testId,
  hasEdgeLinks = false,
  onEdgeLinkClick,
}: BaseNodeProps) {
  const edges = useTopologyStore(state => state.edges);
  const nodes = useTopologyStore(state => state.nodes);

  const isConnecting = useStore(state => state.connection.inProgress);

  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  const connectedPositions = useMemo(() => {
    return computeConnectedPositions(nodeId, edges, nodesRef.current);

  }, [edges, nodeId]);

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
      } ${className || 'border-solid'}`}
    >
      <Handle type="source" position={Position.Top} id="top" className={getHandleClassName(Position.Top)} />
      <Handle type="target" position={Position.Top} id="top-target" className="!opacity-0 !w-2.5 !h-2.5" />
      <Handle type="source" position={Position.Right} id="right" className={getHandleClassName(Position.Right)} />
      <Handle type="target" position={Position.Right} id="right-target" className="!opacity-0 !w-2.5 !h-2.5" />
      <Handle type="source" position={Position.Bottom} id="bottom" className={getHandleClassName(Position.Bottom)} />
      <Handle type="target" position={Position.Bottom} id="bottom-target" className="!opacity-0 !w-2.5 !h-2.5" />
      <Handle type="source" position={Position.Left} id="left" className={getHandleClassName(Position.Left)} />
      <Handle type="target" position={Position.Left} id="left-target" className="!opacity-0 !w-2.5 !h-2.5" />

      <div
        onDoubleClick={() => window.dispatchEvent(new CustomEvent('focusNodeName'))}
        className="flex flex-col items-center justify-center gap-0.5"
      >
        <span className="relative pointer-events-none">
          {icon}
          {hasEdgeLinks && (
            <span
              className="absolute left-full top-1/2 -translate-y-1/2 ml-0.5 pointer-events-auto cursor-pointer hover:opacity-80"
              onClick={e => {
                e.stopPropagation();
                onEdgeLinkClick?.();
              }}
              title="Edit edge links"
            >
              <EdgeLinkIcon />
            </span>
          )}
        </span>
        <div className="w-19 text-xs font-bold text-(--color-node-text) text-center pointer-events-none" title={name}>
          {middleEllipsis(name, 11)}
        </div>
      </div>
    </div>
  );
}
