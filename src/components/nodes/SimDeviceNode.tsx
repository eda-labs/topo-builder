import { type NodeProps } from '@xyflow/react';
import { Speed as SpeedIcon, ViewInAr as ContainerIcon } from '@mui/icons-material';
import type { SimNode, SimNodeType } from '../../types/topology';
import { useTopologyStore } from '../../lib/store';
import BaseNode from './BaseNode';
import { topologySimNodeTestId } from '../../lib/testIds';

export interface SimDeviceNodeData {
  [key: string]: unknown;
  simNode: SimNode;
}

function SimDeviceNode({ id, data, selected }: NodeProps) {
  const nodeData = data as SimDeviceNodeData;
  const simNode = nodeData.simNode;

  const simulation = useTopologyStore((state) => state.simulation);

  const template = simulation.simNodeTemplates.find(t => t.name === simNode.template);
  const nodeType: SimNodeType = simNode.type || template?.type || 'Linux';

  const icon = template ? (
    nodeType === 'TestMan' ? (
      <SpeedIcon sx={{ fontSize: 28, color: '#888' }} />
    ) : (
      <ContainerIcon sx={{ fontSize: 28, color: '#888' }} />
    )
  ) : undefined;

  return (
    <BaseNode
      nodeId={id}
      selected={selected ?? false}
      name={simNode.name}
      icon={icon}
      className="border-dashed"
      testId={topologySimNodeTestId(simNode.name)}
    />
  );
}

export default SimDeviceNode;
