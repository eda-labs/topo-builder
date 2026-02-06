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

function getConnectedPosition(
  thisNode: { position: { x: number; y: number }; measured?: { width?: number; height?: number } },
  otherNode: { position: { x: number; y: number }; measured?: { width?: number; height?: number } },
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
    const positions = new Set<Position>();
    const thisNode = nodes.find(n => n.id === nodeId);
    if (!thisNode) return positions;

    for (const edge of edges) {
      let otherNodeId: string | null = null;

      if (edge.source === nodeId) {
        otherNodeId = edge.target;
      } else if (edge.target === nodeId) {
        otherNodeId = edge.source;
      }

      const esiLeaves = edge.data?.esiLeaves;
      if (esiLeaves) {
        for (const leaf of esiLeaves) {
          if (leaf.nodeId === nodeId) {
            otherNodeId = edge.source;
            break;
          }
        }
        if (edge.source === nodeId) {
          for (const leaf of esiLeaves) {
            const leafNode = nodes.find(n => n.id === leaf.nodeId);
            if (leafNode) {
              positions.add(getConnectedPosition(thisNode, leafNode));
            }
          }
        }
      }

      if (otherNodeId) {
        const otherNode = nodes.find(n => n.id === otherNodeId);
        if (otherNode) {
          positions.add(getConnectedPosition(thisNode, otherNode));
        }
      }
    }

    return positions;
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
