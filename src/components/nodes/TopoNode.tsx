import { useMemo, useState } from 'react';
import { type NodeProps } from '@xyflow/react';

import type { UINodeData, UIEdgeLink } from '../../types/ui';
import { useTopologyStore } from '../../lib/store';
import { resolveNodePanel } from '../../lib/frontpanel';
import { isSrosNode } from '../../lib/interfaces';
import { topologyNodeTestId } from '../../lib/testIds';
import EdgeLinksModal from '../EdgeLinksModal';

import BaseNode from './BaseNode';
import FrontPanelNode from './FrontPanelNode';
import { RoleIcons } from './roleIcons';

function EdgeLinksButton({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <span
      className="cursor-pointer hover:opacity-80"
      onClick={e => { e.stopPropagation(); onClick(); }}
      title={count > 0 ? `Edit edge links (${count})` : 'Edit edge links'}
      style={{
        flexShrink: 0,
        fontSize: 8.5,
        fontWeight: 700,
        lineHeight: 1,
        padding: '2px 4px',
        borderRadius: 3,
        background: count > 0 ? '#4A90D9' : '#39445580',
        color: count > 0 ? '#0b0f14' : 'var(--color-node-text)',
      }}
    >
      {count > 0 ? `${count}⇥` : '⇥'}
    </span>
  );
}

export default function TopoNode({ id, data, selected }: NodeProps) {
  const [edgeLinksModalOpen, setEdgeLinksModalOpen] = useState(false);
  const nodeData = data as UINodeData;
  const nodeTemplates = useTopologyStore(state => state.nodeTemplates);
  const linkTemplates = useTopologyStore(state => state.linkTemplates);
  const nodes = useTopologyStore(state => state.nodes);
  const updateNode = useTopologyStore(state => state.updateNode);
  const triggerYamlRefresh = useTopologyStore(state => state.triggerYamlRefresh);

  const template = nodeData.template ? nodeTemplates.find(t => t.name === nodeData.template) : null;
  const role = nodeData.role
    || nodeData.labels?.['eda.nokia.com/role']
    || template?.labels?.['eda.nokia.com/role'];
  const iconSvg = role ? RoleIcons[role] : null;
  const edgeLinks = nodeData.edgeLinks || [];
  const showEdgeLinkIcon = role === 'leaf';

  const panel = useMemo(() => resolveNodePanel(nodeData, nodeTemplates), [nodeData, nodeTemplates]);
  const sros = useMemo(
    () => isSrosNode(nodes.find(n => n.id === id), nodeTemplates),
    [nodes, id, nodeTemplates],
  );

  const handleEdgeLinkUpdate = (newEdgeLinks: UIEdgeLink[]) => {
    updateNode(id, { edgeLinks: newEdgeLinks });
    triggerYamlRefresh();
  };

  const icon = iconSvg
    ? <span style={{ lineHeight: 0, flexShrink: 0 }} dangerouslySetInnerHTML={{ __html: iconSvg }} />
    : undefined;

  return (
    <>
      {panel ? (
        <FrontPanelNode
          nodeId={id}
          data={nodeData}
          selected={selected ?? false}
          panel={panel}
          sros={sros}
          icon={icon}
          testId={topologyNodeTestId(nodeData.name)}
          headerExtra={showEdgeLinkIcon
            ? <EdgeLinksButton count={edgeLinks.length} onClick={() => { setEdgeLinksModalOpen(true); }} />
            : undefined}
        />
      ) : (
        <BaseNode
          nodeId={id}
          selected={selected ?? false}
          name={nodeData.name}
          icon={icon}
          testId={topologyNodeTestId(nodeData.name)}
          hasEdgeLinks={showEdgeLinkIcon}
          onEdgeLinkClick={() => { setEdgeLinksModalOpen(true); }}
        />
      )}
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
