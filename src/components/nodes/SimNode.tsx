import { type NodeProps } from '@xyflow/react';
import { Speed as SpeedIcon, ViewInAr as ContainerIcon } from '@mui/icons-material';

import type { UINodeData } from '../../types/ui';
import type { SimNodeType } from '../../types/schema';
import { useTopologyStore } from '../../lib/store';
import { topologySimNodeTestId } from '../../lib/testIds';

import BaseNode from './BaseNode';

function SimNode({ id, data, selected }: NodeProps) {
  const nodeData = data as UINodeData;
  const simulation = useTopologyStore(state => state.simulation);

  const name = nodeData.name || 'Unknown';
  const templateName = nodeData.template;

  const template = simulation.simNodeTemplates.find(t => t.name === templateName);
  const simNodeType: SimNodeType = nodeData.simNodeType || template?.type || 'Linux';

  let icon;
  if (template) {
    icon = simNodeType === 'TestMan'
      ? <SpeedIcon sx={{ fontSize: 28, color: '#888' }} />
      : <ContainerIcon sx={{ fontSize: 28, color: '#888' }} />;
  }

  return (
    <BaseNode
      nodeId={id}
      selected={selected ?? false}
      name={name}
      icon={icon}
      className="border-dashed"
      testId={topologySimNodeTestId(name)}
    />
  );
}

export default SimNode;
