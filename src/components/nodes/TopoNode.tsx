import { useCallback, useMemo, useState } from 'react';
import { type NodeProps } from '@xyflow/react';

import type { UINodeData, UIEdgeLink } from '../../types/ui';
import { useTopologyStore } from '../../lib/store';
import { resolveNodePanel } from '../../lib/frontpanel';
import { isSrosNode } from '../../lib/interfaces';
import { topologyNodeTestId } from '../../lib/testIds';
import EdgeLinksModal from '../EdgeLinksModal';
import PlatformDetailsPopover from '../PlatformDetailsPopover';

import BaseNode from './BaseNode';
import FrontPanelNode from './FrontPanelNode';
import { RoleIcons } from './roleIcons';

function EdgeLinksButton({ count, onClick }: { count: number; onClick: () => void }) {
  const active = count > 0;
  return (
    <span
      className="cursor-pointer hover:opacity-80"
      data-testid="edge-links-button"
      onClick={e => { e.stopPropagation(); onClick(); }}
      title={active ? `Edit edge links (${count})` : 'Add edge links (connections to devices outside the topology)'}
      style={{
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        fontSize: 8.5,
        fontWeight: 700,
        lineHeight: 1,
        padding: '2px 5px',
        borderRadius: 999,
        background: active ? '#23abb62e' : '#39445580',
        color: active ? 'var(--color-link-edge)' : 'var(--color-node-text)',
        boxShadow: active ? 'inset 0 0 0 1px #23abb680' : undefined,
      }}
    >
      {/* miniature of the edge-link glyph: a port with an arrow leaving the topology */}
      <svg width="9" height="9" viewBox="0 0 12 12" fill="none" aria-hidden>
        <circle cx="4" cy="6" r="2.6" fill="currentColor" />
        <path d="M7.2 6h3.6M9.2 4.2 11 6 9.2 7.8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {active ? count : '+'}
    </span>
  );
}

export default function TopoNode({ id, data, selected }: NodeProps) {
  const [edgeLinksModalOpen, setEdgeLinksModalOpen] = useState(false);
  const [detailsAnchor, setDetailsAnchor] = useState<HTMLElement | null>(null);
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
  // Leaves get the button by default; any other node keeps it once edge links exist (e.g. from
  // an imported YAML) so they stay editable.
  const showEdgeLinkIcon = role === 'leaf' || edgeLinks.length > 0;

  const panel = useMemo(() => resolveNodePanel(nodeData, nodeTemplates), [nodeData, nodeTemplates]);
  // isSrosNode only reads data/template, so the node's own data suffices — subscribing to the
  // whole nodes array would re-render every faceplate on every drag frame.
  const sros = useMemo(
    () => isSrosNode({ id, data: nodeData, position: { x: 0, y: 0 } }, nodeTemplates),
    [id, nodeData, nodeTemplates],
  );

  const handleEdgeLinkUpdate = (newEdgeLinks: UIEdgeLink[]) => {
    updateNode(id, { edgeLinks: newEdgeLinks });
    triggerYamlRefresh();
  };

  const handleShowDetails = useCallback((anchor: HTMLElement) => {
    setDetailsAnchor(anchor);
  }, []);

  const detail = useMemo(() => {
    if (!panel) return null;
    return {
      title: nodeData.name,
      platform: panel.platform,
      os: sros ? ('sros' as const) : ('srl' as const),
      stencil: panel.stencil,
      components: panel.components,
    };
  }, [panel, nodeData.name, sros]);

  const icon = iconSvg
    ? <span style={{ lineHeight: 0, flexShrink: 0 }} dangerouslySetInnerHTML={{ __html: iconSvg }} />
    : undefined;

  // The raw role icons are 28px — scaled down to sit inside the 26px faceplate header strip.
  const headerIcon = iconSvg
    ? (
      <span
        style={{ lineHeight: 0, flexShrink: 0 }}
        dangerouslySetInnerHTML={{
          __html: iconSvg.replace(/width="\d+"/, 'width="14"').replace(/height="\d+"/, 'height="14"'),
        }}
      />
    )
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
          icon={headerIcon}
          testId={topologyNodeTestId(nodeData.name)}
          headerExtra={showEdgeLinkIcon
            ? <EdgeLinksButton count={edgeLinks.length} onClick={() => { setEdgeLinksModalOpen(true); }} />
            : undefined}
          onShowDetails={handleShowDetails}
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
          edgeLinkCount={edgeLinks.length}
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
      {detailsAnchor && (
        <PlatformDetailsPopover
          anchorEl={detailsAnchor}
          detail={detail}
          onClose={() => { setDetailsAnchor(null); }}
        />
      )}
    </>
  );
}
