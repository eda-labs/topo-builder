import { useState } from 'react';
import { type NodeProps } from '@xyflow/react';

import type { UINodeData, UIEdgeLink } from '../../types/ui';
import { useTopologyStore } from '../../lib/store';
import spineIcon from '../../static/icons/spine.svg?raw';
import leafIcon from '../../static/icons/leaf.svg?raw';
import superspineIcon from '../../static/icons/superspine.svg?raw';
import { topologyNodeTestId } from '../../lib/testIds';
import EdgeLinksModal from '../EdgeLinksModal';

import BaseNode from './BaseNode';

const RoleIcons: Record<string, string> = {
  spine: spineIcon,
  leaf: leafIcon,
  borderleaf: leafIcon,
  superspine: superspineIcon,
};

export default function TopoNode({ id, data, selected }: NodeProps) {
  const [edgeLinksModalOpen, setEdgeLinksModalOpen] = useState(false);
  const nodeData = data as UINodeData;
  const nodeTemplates = useTopologyStore(state => state.nodeTemplates);
  const linkTemplates = useTopologyStore(state => state.linkTemplates);
  const updateNode = useTopologyStore(state => state.updateNode);
  const triggerYamlRefresh = useTopologyStore(state => state.triggerYamlRefresh);

  const template = nodeData.template ? nodeTemplates.find(t => t.name === nodeData.template) : null;
  const role = nodeData.role
    || nodeData.labels?.['eda.nokia.com/role']
    || template?.labels?.['eda.nokia.com/role'];
  const iconSvg = role ? RoleIcons[role] : null;
  const edgeLinks = nodeData.edgeLinks || [];
  const isLeafRole = role === 'leaf';
  const showEdgeLinkIcon = isLeafRole;

  const handleEdgeLinkUpdate = (newEdgeLinks: UIEdgeLink[]) => {
    updateNode(id, { edgeLinks: newEdgeLinks });
    triggerYamlRefresh();
  };

  return (
    <>
      <BaseNode
        nodeId={id}
        selected={selected ?? false}
        name={nodeData.name}
        icon={iconSvg ? <span dangerouslySetInnerHTML={{ __html: iconSvg }} /> : undefined}
        testId={topologyNodeTestId(nodeData.name)}
        hasEdgeLinks={showEdgeLinkIcon}
        onEdgeLinkClick={() => { setEdgeLinksModalOpen(true); }}
      />
      <EdgeLinksModal
        open={edgeLinksModalOpen}
        onClose={() => { setEdgeLinksModalOpen(false); }}
        nodeName={nodeData.name}
        nodeId={id}
        edgeLinks={edgeLinks}
        linkTemplates={linkTemplates}
        onUpdate={handleEdgeLinkUpdate}
      />
    </>
  );
}
