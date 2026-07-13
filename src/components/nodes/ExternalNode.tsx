import { type NodeProps } from '@xyflow/react';
import { CloudQueue as CloudIcon } from '@mui/icons-material';

import type { UINodeData } from '../../types/ui';
import { topologyExternalNodeTestId } from '../../lib/testIds';

import BaseNode from './BaseNode';

/** UI-only stand-in for a device outside the topology; cables to it become YAML edge links. */
function ExternalNode({ id, data, selected }: NodeProps) {
  const nodeData = data as UINodeData;
  const name = nodeData.name || 'external';

  return (
    <BaseNode
      nodeId={id}
      selected={selected ?? false}
      name={name}
      icon={<CloudIcon sx={{ fontSize: 28, color: 'var(--color-link-edge)' }} />}
      className="border-dashed"
      testId={topologyExternalNodeTestId(name)}
    />
  );
}

export default ExternalNode;
