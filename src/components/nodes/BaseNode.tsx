import { type ReactNode } from 'react';
import { Handle, Position, useStore } from '@xyflow/react';
import { useTopologyStore } from '../../lib/store';

export interface BaseNodeProps {
  nodeId: string;
  selected: boolean;
  name: string;
  icon?: ReactNode;
  className?: string;
  testId?: string;
}

export default function BaseNode({
  nodeId,
  selected,
  name,
  icon,
  className = '',
  testId,
}: BaseNodeProps) {
  const darkMode = useTopologyStore((state) => state.darkMode);
  const edges = useTopologyStore((state) => state.edges);

  const isConnecting = useStore((state) => state.connection.inProgress);

  const connectedHandles = new Set<string>();
  edges.forEach((edge) => {
    if (edge.source === nodeId && edge.sourceHandle) {
      connectedHandles.add(edge.sourceHandle);
    }
    if (edge.target === nodeId && edge.targetHandle) {
      connectedHandles.add(edge.targetHandle);
    }
    const edgeData = edge.data as {
      esiLeaves?: Array<{ nodeId: string; leafHandle: string; sourceHandle: string }>;
    } | undefined;

    if (edgeData?.esiLeaves) {
      for (const leaf of edgeData.esiLeaves) {
        if (leaf.nodeId === nodeId && leaf.leafHandle) {
          connectedHandles.add(leaf.leafHandle);
        }
        if (edge.source === nodeId && leaf.sourceHandle) {
          connectedHandles.add(leaf.sourceHandle);
        }
      }
    }
  });

  const alwaysShowAll = selected || isConnecting;

  const getHandleClassName = (handleId: string) => {
    const isConnected = connectedHandles.has(handleId);
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
      <Handle type="source" position={Position.Top} id="top" className={getHandleClassName('top')} />
      <Handle type="target" position={Position.Top} id="top-target" className={getHandleClassName('top-target')} />
      <Handle type="source" position={Position.Bottom} id="bottom" className={getHandleClassName('bottom')} />
      <Handle type="target" position={Position.Bottom} id="bottom-target" className={getHandleClassName('bottom-target')} />
      <Handle type="source" position={Position.Left} id="left" className={getHandleClassName('left')} />
      <Handle type="target" position={Position.Left} id="left-target" className={getHandleClassName('left-target')} />
      <Handle type="source" position={Position.Right} id="right" className={getHandleClassName('right')} />
      <Handle type="target" position={Position.Right} id="right-target" className={getHandleClassName('right-target')} />

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
