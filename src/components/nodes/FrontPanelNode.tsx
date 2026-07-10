import { memo, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import { Handle, Position, useStore } from '@xyflow/react';

import { useTopologyStore } from '../../lib/store';
import {
  FP_HEADER_H,
  FP_PAD,
  cageForInterface,
  frontPanelPortLabel,
  interfaceForCage,
  paintPanel,
  panelDims,
  portBox,
  type NodePanel,
} from '../../lib/frontpanel';
import type { UIEdge, UINodeData } from '../../types/ui';

// Cage fill per cable kind (fabric link / sim-node edge / edge-link to an external endpoint).
const PORT_FILL = { link: '#00A87E', sim: '#8E77D6', edge: '#4A90D9' } as const;
const FREE_FILL = '#222B37';
const FREE_LINE = '#39445580';
const HOT_RING = '#6098FF';
const NODE_TEXT = 'var(--color-node-text)';

// Below this zoom the ports are painted on a single canvas instead of interactive cells.
const DETAIL_ZOOM = 0.45;

export const portHandleId = (cage: string) => `port:${cage}`;

interface Occupant {
  iface: string;
  kind: keyof typeof PORT_FILL;
  edgeId?: string;
  memberIndex?: number;
  edgeSelected?: boolean;
  remote?: string;
  remoteIface?: string;
}

function collectOccupants(nodeId: string, data: UINodeData, edges: UIEdge[]): Map<string, Occupant> {
  const byIface = new Map<string, Occupant>();
  for (const edge of edges) {
    const isSource = edge.source === nodeId;
    const isTarget = edge.target === nodeId;
    if (!isSource && !isTarget) continue;
    const isSim = edge.source.startsWith('sim-') || edge.target.startsWith('sim-');
    const remote = isSource ? edge.data?.targetNode : edge.data?.sourceNode;
    edge.data?.memberLinks?.forEach((ml, memberIndex) => {
      const iface = isSource ? ml.sourceInterface : ml.targetInterface;
      if (!iface || byIface.has(iface)) return;
      byIface.set(iface, {
        iface,
        kind: isSim ? 'sim' : 'link',
        edgeId: edge.id,
        memberIndex,
        edgeSelected: edge.selected,
        remote,
        remoteIface: isSource ? ml.targetInterface : ml.sourceInterface,
      });
    });
  }
  for (const edgeLink of data.edgeLinks ?? []) {
    if (!edgeLink.interface || byIface.has(edgeLink.interface)) continue;
    byIface.set(edgeLink.interface, { iface: edgeLink.interface, kind: 'edge', remote: edgeLink.name });
  }
  return byIface;
}

function portFontSize(width: number, height: number, label: string): number {
  const digits = Math.max(1, label.length);
  return Math.max(4, Math.min(11, height * 0.72, width / (digits * 0.62)));
}

function SummaryCanvas({ panel, occupied, width, height }: {
  panel: NodePanel;
  occupied: ReadonlyMap<string, string>;
  width: number;
  height: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    if (ref.current) {
      paintPanel(ref.current, panel.meta, { width, height, occupied, freeFill: FREE_FILL, freeLine: FREE_LINE });
    }
  }, [panel, occupied, width, height]);
  return <canvas ref={ref} aria-hidden style={{ display: 'block', pointerEvents: 'none' }} />;
}

const portHandleStyle = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  transform: 'none',
  minWidth: 0,
  minHeight: 0,
  border: 0,
  borderRadius: 2,
  background: 'transparent',
  opacity: 1,
} as const;

function FreePort({ cage, label, iface, box }: {
  cage: string;
  label: string;
  iface: string | null;
  box: { left: number; top: number; width: number; height: number };
}) {
  return (
    <div
      className="fp-port fp-port-free"
      title={iface ? `${iface} · free — drag or click to cable` : `port ${label} · free`}
      style={{
        position: 'absolute',
        ...box,
        borderRadius: 2,
        background: FREE_FILL,
        outline: `1px solid ${FREE_LINE}`,
        outlineOffset: -1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: portFontSize(box.width, box.height, label),
        lineHeight: 1,
        fontWeight: 700,
        color: NODE_TEXT,
        opacity: 0.9,
      }}
    >
      <span style={{ opacity: 0.55, pointerEvents: 'none' }}>{label}</span>
      <Handle
        type="target"
        id={`${portHandleId(cage)}-target`}
        position={Position.Bottom}
        isConnectableStart={false}
        style={portHandleStyle}
      />
      <Handle
        type="source"
        id={portHandleId(cage)}
        position={Position.Bottom}
        isConnectableEnd={false}
        style={{ ...portHandleStyle, cursor: 'crosshair' }}
      />
    </div>
  );
}

function UsedPort({ occupant, label, hot, box }: {
  occupant: Occupant;
  label: string;
  hot: boolean;
  box: { left: number; top: number; width: number; height: number };
}) {
  const selectMemberLink = useTopologyStore(state => state.selectMemberLink);
  const fill = PORT_FILL[occupant.kind];
  const remoteEnd = [occupant.remote, occupant.remoteIface].filter(Boolean).join(' ');
  const remote = remoteEnd ? ` → ${remoteEnd}` : '';
  return (
    <div
      className="fp-port"
      title={`${occupant.iface}${remote}`}
      onClick={e => {
        e.stopPropagation();
        if (occupant.edgeId !== undefined && occupant.memberIndex !== undefined) {
          selectMemberLink(occupant.edgeId, occupant.memberIndex, e.shiftKey);
        }
      }}
      style={{
        position: 'absolute',
        ...box,
        borderRadius: 2,
        background: fill,
        outline: hot ? `1.5px solid ${HOT_RING}` : `1px solid ${fill}`,
        outlineOffset: -1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: portFontSize(box.width, box.height, label),
        lineHeight: 1,
        fontWeight: 700,
        color: '#0b0f14',
        cursor: occupant.edgeId ? 'pointer' : 'default',
        zIndex: hot ? 2 : 1,
      }}
    >
      {label}
    </div>
  );
}

export interface FrontPanelNodeProps {
  nodeId: string;
  data: UINodeData;
  selected: boolean;
  panel: NodePanel;
  sros?: boolean;
  icon?: ReactNode;
  headerExtra?: ReactNode;
  testId?: string;
}

function FrontPanelNode({ nodeId, data, selected, panel, sros = false, icon, headerExtra, testId }: FrontPanelNodeProps) {
  const edges = useTopologyStore(state => state.edges);
  const selectedEdgeId = useTopologyStore(state => state.selectedEdgeId);
  const selectedMemberLinkIndices = useTopologyStore(state => state.selectedMemberLinkIndices);
  const detailed = useStore(s => s.transform[2] >= DETAIL_ZOOM);
  const isConnecting = useStore(s => s.connection.inProgress);

  const { w: panelW, h: panelH } = panelDims(panel.meta);

  const occupants = useMemo(() => {
    const byIface = collectOccupants(nodeId, data, edges);
    const byCage = new Map<string, Occupant>();
    for (const occupant of byIface.values()) {
      const cage = cageForInterface(occupant.iface, panel.meta);
      if (cage && !byCage.has(cage)) byCage.set(cage, occupant);
    }
    return byCage;
  }, [nodeId, data, edges, panel.meta]);

  const summaryFills = useMemo(() => {
    const fills = new Map<string, string>();
    for (const [cage, occupant] of occupants) fills.set(cage, PORT_FILL[occupant.kind]);
    return fills;
  }, [occupants]);

  const usedCount = occupants.size;

  const sideHandleClass = `!w-2.5 !h-2.5 !bg-(--color-handle-bg) !border !border-solid !border-(--color-node-border) transition-opacity duration-150 ${
    selected || isConnecting ? '!opacity-100' : '!opacity-0 group-hover:!opacity-100'
  }`;

  return (
    <div
      data-testid={testId}
      onDoubleClick={() => window.dispatchEvent(new CustomEvent('focusNodeName'))}
      className="group relative"
      style={{
        width: panelW + FP_PAD * 2,
        height: panelH + FP_HEADER_H + FP_PAD * 2,
        background: 'var(--color-node-bg)',
        border: `1.5px solid ${selected ? 'var(--color-node-border-selected)' : 'var(--color-node-border)'}`,
        borderRadius: 6,
        boxSizing: 'border-box',
      }}
    >
      {/* whole-node handles: drag from the chassis border to auto-pick the next free port */}
      <Handle type="source" position={Position.Top} id="top" className={sideHandleClass} />
      <Handle type="target" position={Position.Top} id="top-target" className="!opacity-0 !w-2.5 !h-2.5" />
      <Handle type="source" position={Position.Right} id="right" className={sideHandleClass} />
      <Handle type="target" position={Position.Right} id="right-target" className="!opacity-0 !w-2.5 !h-2.5" />
      <Handle type="source" position={Position.Bottom} id="bottom" className={sideHandleClass} />
      <Handle type="target" position={Position.Bottom} id="bottom-target" className="!opacity-0 !w-2.5 !h-2.5" />
      <Handle type="source" position={Position.Left} id="left" className={sideHandleClass} />
      <Handle type="target" position={Position.Left} id="left-target" className="!opacity-0 !w-2.5 !h-2.5" />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          height: FP_HEADER_H,
          padding: `0 ${FP_PAD}px`,
          boxSizing: 'border-box',
        }}
      >
        {icon}
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: NODE_TEXT,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            maxWidth: '55%',
          }}
          title={data.name}
        >
          {data.name}
        </span>
        {headerExtra}
        <span
          style={{
            fontSize: 9,
            color: NODE_TEXT,
            opacity: 0.55,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            minWidth: 0,
          }}
          title={panel.platform}
        >
          {panel.platform}
        </span>
        <span style={{ flex: 1, minWidth: 0 }} />
        <span style={{ fontSize: 9, color: NODE_TEXT, opacity: 0.55, flexShrink: 0 }}>
          {usedCount}/{panel.meta.ports}
        </span>
      </div>

      <div style={{ position: 'relative', width: panelW, height: panelH, margin: `0 ${FP_PAD}px` }}>
        {detailed ? (
          panel.meta.layout.map(pos => {
            const box = portBox(panel.meta, pos);
            const label = frontPanelPortLabel(panel.stencil, pos.p);
            const occupant = occupants.get(pos.p);
            if (!occupant) {
              const iface = interfaceForCage(pos.p, { sros, components: panel.components, usedInterfaces: [] });
              return <FreePort key={pos.p} cage={pos.p} label={label} iface={iface} box={box} />;
            }
            const hot = occupant.edgeSelected === true
              || (occupant.edgeId === selectedEdgeId
                && occupant.memberIndex !== undefined
                && selectedMemberLinkIndices.includes(occupant.memberIndex));
            return <UsedPort key={pos.p} occupant={occupant} label={label} hot={hot} box={box} />;
          })
        ) : (
          <SummaryCanvas panel={panel} occupied={summaryFills} width={panelW} height={panelH} />
        )}
      </div>
    </div>
  );
}

export default memo(FrontPanelNode);
