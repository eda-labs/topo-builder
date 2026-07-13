import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Handle, Position, useStore, useUpdateNodeInternals } from '@xyflow/react';
import { Divider, ListSubheader, Menu, MenuItem } from '@mui/material';
import { useShallow } from 'zustand/react/shallow';

import { useTopologyStore } from '../../lib/store';
import { esiLagHoverKey, lagHoverKey, memberHoverKey, useHoverHot, useHoverTrace, type HoverHudInfo } from '../../lib/store/hoverTrace';
import { breakoutOptionsFor, cageNativeSpeed, defaultChannelGbps, type BreakoutOption } from '../../lib/connectors';
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

// Cage fill per cable kind — cable-map's palette: InterSwitch blue, Edge teal (sim-node links
// and edge-links alike), Local LAG yellow, Multihome LAG purple. Literal hexes because the
// zoomed-out faceplate paints these onto a canvas, where CSS variables don't resolve.
const PORT_FILL = { link: '#4092ff', sim: '#23abb6', edge: '#23abb6', lag: '#f7b737', mlag: '#9765fe' } as const;
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
  linkName?: string;
  lagName?: string;
  /** LAG members share the group's hover key so the whole LAG traces as one */
  lagKey?: string;
}

function collectOccupants(nodeId: string, data: UINodeData, edges: UIEdge[]): Map<string, Occupant> {
  const byIface = new Map<string, Occupant>();
  for (const edge of edges) {
    // ESI-LAG edges land one leg per leaf (memberLinks[i] pairs with esiLeaves[i]); React Flow
    // only knows leaves[0] as the target, so occupancy comes from the leaf list instead.
    if (edge.data?.edgeType === 'esilag' && edge.data.esiLeaves?.length) {
      edge.data.esiLeaves.forEach((leaf, leafIndex) => {
        if (leaf.nodeId !== nodeId) return;
        const ml = edge.data?.memberLinks?.[leafIndex];
        const iface = ml?.targetInterface;
        if (!iface || byIface.has(iface)) return;
        byIface.set(iface, {
          iface,
          kind: 'mlag',
          edgeId: edge.id,
          memberIndex: leafIndex,
          edgeSelected: edge.selected,
          remote: edge.data?.sourceNode,
          remoteIface: ml.sourceInterface,
          linkName: ml.name,
          lagName: edge.data?.esiLagName,
          lagKey: esiLagHoverKey(edge.id),
        });
      });
      continue;
    }
    const isSource = edge.source === nodeId;
    const isTarget = edge.target === nodeId;
    if (!isSource && !isTarget) continue;
    const isSim = edge.source.startsWith('sim-') || edge.target.startsWith('sim-');
    const remote = isSource ? edge.data?.targetNode : edge.data?.sourceNode;
    const lagByIndex = new Map<number, { id: string; name: string }>();
    for (const lag of edge.data?.lagGroups ?? []) {
      for (const index of lag.memberLinkIndices) lagByIndex.set(index, lag);
    }
    const plainKind = isSim ? 'sim' : 'link';
    edge.data?.memberLinks?.forEach((ml, memberIndex) => {
      const iface = isSource ? ml.sourceInterface : ml.targetInterface;
      if (!iface || byIface.has(iface)) return;
      const lag = lagByIndex.get(memberIndex);
      byIface.set(iface, {
        iface,
        kind: lag ? 'lag' : plainKind,
        edgeId: edge.id,
        memberIndex,
        edgeSelected: edge.selected,
        remote,
        remoteIface: isSource ? ml.targetInterface : ml.sourceInterface,
        linkName: ml.name,
        lagName: lag?.name,
        lagKey: lag ? lagHoverKey(edge.id, lag.id) : undefined,
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

function FreePort({ nodeId, nodeName, handleId, label, iface, speedGbps, box, onCageContextMenu }: {
  nodeId: string;
  nodeName: string;
  handleId: string;
  label: string;
  iface: string | null;
  speedGbps: number | null;
  box: PortBox;
  onCageContextMenu?: (e: React.MouseEvent) => void;
}) {
  const setHover = useHoverTrace(state => state.setHover);
  const clearHover = useHoverTrace(state => state.clearHover);
  const hoverKey = `free:${nodeId}:${handleId}`;
  const speed = speedGbps ? ` · ${speedGbps}G` : '';
  return (
    <div
      className="fp-port fp-port-free"
      onContextMenu={onCageContextMenu}
      onMouseEnter={iface
        ? () => {
          const hud: HoverHudInfo = { nodeA: nodeName, ifaceA: iface, nodeB: '', kind: 'free', speedGbps: speedGbps ?? undefined };
          setHover(hoverKey, hud, false);
        }
        : undefined}
      onMouseLeave={() => { clearHover(hoverKey); }}
      title={iface ? `${iface}${speed} · free — drag or click to cable` : `port ${label} · free`}
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
      {/* Loose connection mode lets one transparent handle both start and receive a cable. This
          halves the React Flow subscriptions on port-dense faceplates without changing visuals. */}
      <Handle
        type="source"
        id={handleId}
        position={Position.Bottom}
        style={{ ...portHandleStyle, cursor: 'crosshair' }}
      />
    </div>
  );
}

/** Unconnected edge links hang a short stub off the port, mirroring cable-map's stub mode
    (1.25×44 idle, grown while hover-traced). */
function EdgeLinkStub({ fill, hot }: { fill: string; hot: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        position: 'absolute',
        left: '50%',
        top: '100%',
        width: hot ? 2 : 1.25,
        height: hot ? 52 : 44,
        transform: 'translateX(-50%)',
        background: fill,
        borderRadius: 999,
        opacity: hot ? 1 : 0.72,
        boxShadow: hot ? `0 0 0 1px ${fill}66` : undefined,
        pointerEvents: 'none',
      }}
    />
  );
}

function UsedPort({ nodeId, nodeName, occupant, label, hot, speedGbps, box, onCageContextMenu }: {
  nodeId: string;
  nodeName: string;
  occupant: Occupant;
  label: string;
  hot: boolean;
  speedGbps: number | null;
  box: PortBox;
  onCageContextMenu?: (e: React.MouseEvent) => void;
}) {
  const selectMemberLink = useTopologyStore(state => state.selectMemberLink);
  const setHover = useHoverTrace(state => state.setHover);
  const clearHover = useHoverTrace(state => state.clearHover);
  // Both ports of a member link share the cable's hover key — hovering either end (or the
  // cable itself) rings this port, the remote port and the cable together. LAG member ports
  // share the whole group's key instead, so any of them traces the complete LAG.
  const hoverKey = occupant.lagKey
    ?? (occupant.edgeId !== undefined && occupant.memberIndex !== undefined
      ? memberHoverKey(occupant.edgeId, occupant.memberIndex)
      : `edge:${nodeId}:${occupant.iface}`);
  const hoverHot = useHoverHot(hoverKey);

  const fill = PORT_FILL[occupant.kind];
  const speed = speedGbps ? ` · ${speedGbps}G` : '';
  const remoteEnd = [occupant.remote, occupant.remoteIface].filter(Boolean).join(' ');
  const remote = remoteEnd ? ` → ${remoteEnd}` : '';

  const handleMouseEnter = () => {
    const hud: HoverHudInfo = {
      nodeA: nodeName,
      ifaceA: occupant.iface,
      nodeB: occupant.remote ?? '',
      ifaceB: occupant.remoteIface,
      kind: occupant.kind,
      linkName: occupant.linkName,
      lagName: occupant.lagName,
      speedGbps: speedGbps ?? undefined,
    };
    setHover(hoverKey, hud, occupant.kind !== 'edge');
  };

  let outline = `1px solid ${fill}`;
  if (hot) outline = `1.5px solid ${HOT_RING}`;
  if (hoverHot) outline = '1.5px solid #FFFFFF';
  let zIndex = 1;
  if (hot) zIndex = 2;
  if (hoverHot) zIndex = 3;

  return (
    <div
      className="fp-port"
      onContextMenu={onCageContextMenu}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => { clearHover(hoverKey); }}
      title={`${occupant.iface}${speed}${remote}`}
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
        outline,
        outlineOffset: -1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: portFontSize(box.width, box.height, label),
        lineHeight: 1,
        fontWeight: 700,
        color: '#0b0f14',
        cursor: occupant.edgeId ? 'pointer' : 'default',
        zIndex,
        transition: 'outline-color 120ms',
      }}
    >
      {label}
      {occupant.kind === 'edge' && <EdgeLinkStub fill={fill} hot={hoverHot} />}
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
  /** opens the platform-details card (click is reserved for selection, so this gets its own button) */
  onShowDetails?: (anchor: HTMLElement) => void;
}

function FrontPanelNode({ nodeId, data, selected, panel, sros = false, icon, headerExtra, testId, onShowDetails }: FrontPanelNodeProps) {
  // Only the edges touching this node drive its occupancy — a whole-array subscription would
  // repaint every faceplate whenever any edge anywhere changes. ESI-LAG edges list only their
  // first leaf as the React Flow target, so the other leaves match via esiLeaves.
  const edges = useTopologyStore(useShallow(
    state => state.edges.filter(e => e.source === nodeId || e.target === nodeId
      || e.data?.esiLeaves?.some(leaf => leaf.nodeId === nodeId)),
  ));
  const selectedEdgeId = useTopologyStore(state => state.selectedEdgeId);
  const selectedMemberLinkIndices = useTopologyStore(state => state.selectedMemberLinkIndices);
  const updateNode = useTopologyStore(state => state.updateNode);
  const triggerYamlRefresh = useTopologyStore(state => state.triggerYamlRefresh);
  const detailed = useStore(s => s.transform[2] >= DETAIL_ZOOM);

  const [cageMenu, setCageMenu] = useState<{ x: number; y: number; cage: string } | null>(null);

  const { w: panelW, h: panelH } = panelDims(panel.meta);
  const breakouts = useMemo(() => data.breakouts ?? {}, [data.breakouts]);

  // Native Gb/s per cage, resolved once per panel — feeds port tooltips and the hover HUD.
  const speedByCage = useMemo(() => {
    const speeds = new Map<string, number | null>();
    for (const pos of panel.meta.layout) speeds.set(pos.p, cageNativeSpeed(panel, pos.p));
    return speeds;
  }, [panel]);

  const channelSpeed = (cage: string): number | null => {
    const override = data.breakoutSpeeds?.[cage];
    if (override) return override;
    const native = speedByCage.get(cage);
    const channels = breakouts[cage];
    return native != null && channels ? defaultChannelGbps(native, channels) : null;
  };

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

  const setBreakout = (cage: string, option: BreakoutOption) => {
    const native = cageNativeSpeed(panel, cage);
    const isDefaultSpeed = option.gbps == null
      || (native != null && defaultChannelGbps(native, option.channels) === option.gbps);
    const speeds = Object.fromEntries(
      Object.entries(data.breakoutSpeeds ?? {}).filter(([key]) => key !== cage),
    );
    if (!isDefaultSpeed && option.gbps != null) speeds[cage] = option.gbps;
    updateNode(nodeId, {
      breakouts: { ...breakouts, [cage]: option.channels },
      breakoutSpeeds: Object.keys(speeds).length ? speeds : undefined,
    });
    triggerYamlRefresh();
  };
  const removeBreakout = (cage: string) => {
    const next = Object.fromEntries(Object.entries(breakouts).filter(([key]) => key !== cage));
    const speeds = Object.fromEntries(
      Object.entries(data.breakoutSpeeds ?? {}).filter(([key]) => key !== cage),
    );
    updateNode(nodeId, {
      breakouts: Object.keys(next).length ? next : undefined,
      breakoutSpeeds: Object.keys(speeds).length ? speeds : undefined,
    });
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

  // Panel nodes cable at their ports only. The whole-node handles stay in the DOM invisible and
  // non-connectable purely so edges from older topologies that anchored to a node side ("top",
  // "right", …) still resolve their handle and render.
  const legacyHandleClass = '!opacity-0 !w-1 !h-1 !pointer-events-none';

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
      <Handle type="source" position={Position.Top} id="top" isConnectable={false} className={legacyHandleClass} />
      <Handle type="target" position={Position.Top} id="top-target" isConnectable={false} className={legacyHandleClass} />
      <Handle type="source" position={Position.Right} id="right" isConnectable={false} className={legacyHandleClass} />
      <Handle type="target" position={Position.Right} id="right-target" isConnectable={false} className={legacyHandleClass} />
      <Handle type="source" position={Position.Bottom} id="bottom" isConnectable={false} className={legacyHandleClass} />
      <Handle type="target" position={Position.Bottom} id="bottom-target" isConnectable={false} className={legacyHandleClass} />
      <Handle type="source" position={Position.Left} id="left" isConnectable={false} className={legacyHandleClass} />
      <Handle type="target" position={Position.Left} id="left-target" isConnectable={false} className={legacyHandleClass} />

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
        {onShowDetails && (
          <span
            className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 cursor-pointer hover:!opacity-100"
            data-testid="node-details-button"
            title="Platform details"
            onClick={e => {
              e.stopPropagation();
              onShowDetails(e.currentTarget);
            }}
            style={{
              flexShrink: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 14,
              height: 14,
              borderRadius: '50%',
              fontSize: 9,
              fontWeight: 700,
              fontStyle: 'italic',
              fontFamily: 'Georgia, serif',
              background: '#39445580',
              color: NODE_TEXT,
            }}
          >
            i
          </span>
        )}
      </div>

      <div style={{ position: 'relative', width: panelW, height: panelH, margin: `0 ${FP_PAD}px` }}>
        {detailed ? (
          panel.meta.layout.map(pos => {
            const box = portBox(panel.meta, pos);
            const label = frontPanelPortLabel(panel.stencil, pos.p);
            const channels = breakouts[pos.p];

            if (channels) {
              const sliverSpeed = channelSpeed(pos.p);
              return Array.from({ length: channels }, (_, i) => {
                const channel = i + 1;
                const key = `${pos.p}#${channel}`;
                const sliver = breakoutChannelBox(box, channel, channels);
                const occupant = occupants.get(key);
                if (!occupant) {
                  const iface = interfaceForCage(pos.p, { sros, components: panel.components, usedInterfaces: [], channel });
                  return <FreePort key={key} nodeId={nodeId} nodeName={data.name} handleId={portHandleId(pos.p, channel)} label={String(channel)} iface={iface} speedGbps={sliverSpeed} box={sliver} onCageContextMenu={openCageMenu(pos.p)} />;
                }
                const hot = isOccupantHot(occupant, selectedEdgeId, selectedMemberLinkIndices);
                return <UsedPort key={key} nodeId={nodeId} nodeName={data.name} occupant={occupant} label={String(channel)} hot={hot} speedGbps={sliverSpeed} box={sliver} onCageContextMenu={openCageMenu(pos.p)} />;
              });
            }

            const cageSpeed = speedByCage.get(pos.p) ?? null;
            const occupant = occupants.get(pos.p);
            if (!occupant) {
              const iface = interfaceForCage(pos.p, { sros, components: panel.components, usedInterfaces: [] });
              return <FreePort key={pos.p} nodeId={nodeId} nodeName={data.name} handleId={portHandleId(pos.p)} label={label} iface={iface} speedGbps={cageSpeed} box={box} onCageContextMenu={openCageMenu(pos.p)} />;
            }
            const hot = isOccupantHot(occupant, selectedEdgeId, selectedMemberLinkIndices);
            return <UsedPort key={pos.p} nodeId={nodeId} nodeName={data.name} occupant={occupant} label={label} hot={hot} speedGbps={cageSpeed} box={box} onCageContextMenu={openCageMenu(pos.p)} />;
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
            const native = cageNativeSpeed(panel, cage);
            const gbps = data.breakoutSpeeds?.[cage]
              ?? (native == null ? null : defaultChannelGbps(native, breakouts[cage]));
            const boLabel = gbps ? `${breakouts[cage]} × ${gbps}G breakout` : `${breakouts[cage]}× breakout`;
            return [
              <ListSubheader key="h" sx={{ lineHeight: '28px', bgcolor: 'transparent' }}>{`Port ${cageLabel} · ${boLabel}`}</ListSubheader>,
              <Divider key="d" />,
              <MenuItem key="rm" disabled={cabled} onClick={() => { removeBreakout(cage); close(); }}>
                {cabled ? 'Remove breakout (un-cable channels first)' : 'Remove breakout'}
              </MenuItem>,
            ];
          }
          const options = breakoutOptionsFor(panel, cage, sros);
          return [
            <ListSubheader key="h" sx={{ lineHeight: '28px', bgcolor: 'transparent' }}>{`Port ${cageLabel}`}</ListSubheader>,
            <Divider key="d" />,
            ...(options.length === 0
              ? [<MenuItem key="none" disabled>No breakout available</MenuItem>]
              : options.map(option => (
                <MenuItem key={option.label} disabled={cabled} onClick={() => { setBreakout(cage, option); close(); }}>
                  {cabled ? `Break out into ${option.label} (un-cable first)` : `Break out into ${option.label}`}
                </MenuItem>
              ))),
          ];
        })()}
      </Menu>
    </div>
  );
}

export default memo(FrontPanelNode);
