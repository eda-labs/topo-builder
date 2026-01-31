import { type NodeProps } from '@xyflow/react';
import type { TopologyNodeData } from '../../types/topology';
import { useTopologyStore } from '../../lib/store';
import BaseNode from './BaseNode';
import spineIcon from '../../static/icons/spine.svg?raw';
import leafIcon from '../../static/icons/leaf.svg?raw';
import superspineIcon from '../../static/icons/superspine.svg?raw';
import { topologyNodeTestId } from '../../lib/testIds';

const RoleIcons: Record<string, string> = {
  spine: spineIcon,
  leaf: leafIcon,
  borderleaf: leafIcon,
  superspine: superspineIcon,
};

export default function DeviceNode({ id, data, selected }: NodeProps) {
  const nodeData = data as TopologyNodeData;
  const nodeTemplates = useTopologyStore((state) => state.nodeTemplates);

  const template = nodeData.template ? nodeTemplates.find(t => t.name === nodeData.template) : null;
  const role = nodeData.role
    || nodeData.labels?.['eda.nokia.com/role']
    || template?.labels?.['eda.nokia.com/role'];
  const iconSvg = role ? RoleIcons[role as string] : null;

  return (
    <BaseNode
      nodeId={id}
      selected={selected ?? false}
      name={nodeData.name}
      icon={iconSvg ? <span dangerouslySetInnerHTML={{ __html: iconSvg }} /> : undefined}
      testId={topologyNodeTestId(nodeData.name)}
    />
  );
}
