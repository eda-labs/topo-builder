import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Handle, Position, useStore, useUpdateNodeInternals } from '@xyflow/react';
import { Divider, ListSubheader, Menu, MenuItem } from '@mui/material';

import { useTopologyStore } from '../../lib/store';
import {
  FP_HEADER_H,
  FP_PAD,
  breakoutChannelBox,
  frontPanelPortLabel,
  interfaceForCage,
  paintPanel,
  panelDims,
  portAddressForInterface,
  portBox,
  type NodePanel,
  type PortBox,
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

// Breakout channels use "_" as the separator — cage ids only contain digits and "-", and React
// Flow rejects some punctuation (e.g. "#") in handle ids.
export const portHandleId = (cage: string, channel?: number) =>
  (channel ? `port:${cage}_${channel}` : `port:${cage}`);

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

function isOccupantHot(occupant: Occupant, selectedEdgeId: string | null, selectedMemberLinkIndices: number[]): boolean {
  return occupant.edgeSelected === true
    || (occupant.edgeId === selectedEdgeId
      && occupant.memberIndex !== undefined
      && selectedMemberLinkIndices.includes(occupant.memberIndex));
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

function FreePort({ handleId, label, iface, box, onCageContextMenu }: {
  handleId: string;
  label: string;
  iface: string | null;
  box: PortBox;
  onCageContextMenu?: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      className="fp-port fp-port-free"
      onContextMenu={onCageContextMenu}
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
        id={`${handleId}-target`}
        position={Position.Bottom}
        isConnectableStart={false}
        style={portHandleStyle}
      />
      <Handle
        type="source"
        id={handleId}
        position={Position.Bottom}
        isConnectableEnd={false}
        style={{ ...portHandleStyle, cursor: 'crosshair' }}
      />
    </div>
  );
}

function UsedPort({ occupant, label, hot, box, onCageContextMenu }: {
  occupant: Occupant;
  label: string;
  hot: boolean;
  box: PortBox;
  onCageContextMenu?: (e: React.MouseEvent) => void;
}) {
  const selectMemberLink = useTopologyStore(state => state.selectMemberLink);
  const fill = PORT_FILL[occupant.kind];
  const remoteEnd = [occupant.remote, occupant.remoteIface].filter(Boolean).join(' ');
  const remote = remoteEnd ? ` → ${remoteEnd}` : '';
  return (
    <div
      className="fp-port"
      onContextMenu={onCageContextMenu}
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
  const updateNode = useTopologyStore(state => state.updateNode);
  const triggerYamlRefresh = useTopologyStore(state => state.triggerYamlRefresh);
  const detailed = useStore(s => s.transform[2] >= DETAIL_ZOOM);
  const isConnecting = useStore(s => s.connection.inProgress);

  const [cageMenu, setCageMenu] = useState<{ x: number; y: number; cage: string } | null>(null);

  const { w: panelW, h: panelH } = panelDims(panel.meta);
  const breakouts = useMemo(() => data.breakouts ?? {}, [data.breakouts]);

  // Occupancy keyed by cage, or "<cage>#<channel>" for channels of broken-out cages. A channelised
  // interface on a cage with no breakout state still marks the whole cage as used.
  const occupants = useMemo(() => {
    const byIface = collectOccupants(nodeId, data, edges);
    const byCage = new Map<string, Occupant>();
    for (const occupant of byIface.values()) {
      const address = portAddressForInterface(occupant.iface, panel.meta);
      if (!address) continue;
      const key = address.channel && breakouts[address.cage] ? `${address.cage}#${address.channel}` : address.cage;
      if (!byCage.has(key)) byCage.set(key, occupant);
    }
    return byCage;
  }, [nodeId, data, edges, panel.meta, breakouts]);

  const cageHasCables = useMemo(() => {
    const cages = new Set<string>();
    for (const key of occupants.keys()) cages.add(key.split('#')[0]);
    return cages;
  }, [occupants]);

  const summaryFills = useMemo(() => {
    const fills = new Map<string, string>();
    for (const [key, occupant] of occupants) fills.set(key.split('#')[0], PORT_FILL[occupant.kind]);
    return fills;
  }, [occupants]);

  const usedCount = cageHasCables.size;

  const setBreakout = (cage: string, channels: number) => {
    updateNode(nodeId, { breakouts: { ...breakouts, [cage]: channels } });
    triggerYamlRefresh();
  };
  const removeBreakout = (cage: string) => {
    const next = Object.fromEntries(Object.entries(breakouts).filter(([key]) => key !== cage));
    updateNode(nodeId, { breakouts: Object.keys(next).length ? next : undefined });
    triggerYamlRefresh();
  };
  const openCageMenu = (cage: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCageMenu({ x: e.clientX, y: e.clientY, cage });
  };

  // Handles come and go after mount (breakouts split cages, cabling occupies ports, the zoom LOD
  // swaps ports in and out) — React Flow only knows about handles measured at mount unless told.
  const updateNodeInternals = useUpdateNodeInternals();
  useEffect(() => {
    updateNodeInternals(nodeId);
  }, [nodeId, breakouts, occupants, detailed, updateNodeInternals]);

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
            const channels = breakouts[pos.p];

            if (channels) {
              return Array.from({ length: channels }, (_, i) => {
                const channel = i + 1;
                const key = `${pos.p}#${channel}`;
                const sliver = breakoutChannelBox(box, channel, channels);
                const occupant = occupants.get(key);
                if (!occupant) {
                  const iface = interfaceForCage(pos.p, { sros, components: panel.components, usedInterfaces: [], channel });
                  return <FreePort key={key} handleId={portHandleId(pos.p, channel)} label={String(channel)} iface={iface} box={sliver} onCageContextMenu={openCageMenu(pos.p)} />;
                }
                const hot = isOccupantHot(occupant, selectedEdgeId, selectedMemberLinkIndices);
                return <UsedPort key={key} occupant={occupant} label={String(channel)} hot={hot} box={sliver} onCageContextMenu={openCageMenu(pos.p)} />;
              });
            }

            const occupant = occupants.get(pos.p);
            if (!occupant) {
              const iface = interfaceForCage(pos.p, { sros, components: panel.components, usedInterfaces: [] });
              return <FreePort key={pos.p} handleId={portHandleId(pos.p)} label={label} iface={iface} box={box} onCageContextMenu={openCageMenu(pos.p)} />;
            }
            const hot = isOccupantHot(occupant, selectedEdgeId, selectedMemberLinkIndices);
            return <UsedPort key={pos.p} occupant={occupant} label={label} hot={hot} box={box} onCageContextMenu={openCageMenu(pos.p)} />;
          })
        ) : (
          <SummaryCanvas panel={panel} occupied={summaryFills} width={panelW} height={panelH} />
        )}
      </div>

      <Menu
        open={cageMenu !== null}
        onClose={() => { setCageMenu(null); }}
        anchorReference="anchorPosition"
        anchorPosition={cageMenu ? { top: cageMenu.y, left: cageMenu.x } : undefined}
        slotProps={{ list: { dense: true } }}
      >
        {cageMenu && (() => {
          const cage = cageMenu.cage;
          const cageLabel = frontPanelPortLabel(panel.stencil, cage);
          const cabled = cageHasCables.has(cage);
          const close = () => { setCageMenu(null); };
          if (breakouts[cage]) {
            return [
              <ListSubheader key="h" sx={{ lineHeight: '28px', bgcolor: 'transparent' }}>{`Port ${cageLabel} · ${breakouts[cage]}× breakout`}</ListSubheader>,
              <Divider key="d" />,
              <MenuItem key="rm" disabled={cabled} onClick={() => { removeBreakout(cage); close(); }}>
                {cabled ? 'Remove breakout (un-cable channels first)' : 'Remove breakout'}
              </MenuItem>,
            ];
          }
          return [
            <ListSubheader key="h" sx={{ lineHeight: '28px', bgcolor: 'transparent' }}>{`Port ${cageLabel}`}</ListSubheader>,
            <Divider key="d" />,
            ...[2, 4, 8].map(n => (
              <MenuItem key={n} disabled={cabled} onClick={() => { setBreakout(cage, n); close(); }}>
                {cabled ? `Break out into ${n} channels (un-cable first)` : `Break out into ${n} channels`}
              </MenuItem>
            )),
          ];
        })()}
      </Menu>
    </div>
  );
}

export default memo(FrontPanelNode);
