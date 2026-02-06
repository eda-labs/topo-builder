import { type NodeProps } from '@xyflow/react';

import type { UINodeData } from '../../types/ui';
import { useTopologyStore } from '../../lib/store';
import spineIcon from '../../static/icons/spine.svg?raw';
import leafIcon from '../../static/icons/leaf.svg?raw';
import superspineIcon from '../../static/icons/superspine.svg?raw';
import { topologyNodeTestId } from '../../lib/testIds';

import BaseNode from './BaseNode';

const RoleIcons: Record<string, string> = {
  spine: spineIcon,
  leaf: leafIcon,
  borderleaf: leafIcon,
  superspine: superspineIcon,
};

export default function TopoNode({ id, data, selected }: NodeProps) {
  const nodeData = data as UINodeData;
  const nodeTemplates = useTopologyStore(state => state.nodeTemplates);

  const template = nodeData.template ? nodeTemplates.find(t => t.name === nodeData.template) : null;
  const role = nodeData.role
    || nodeData.labels?.['eda.nokia.com/role']
    || template?.labels?.['eda.nokia.com/role'];
  const iconSvg = role ? RoleIcons[role] : null;

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
