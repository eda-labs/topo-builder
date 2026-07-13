import { useEffect } from 'react';
import { Position, getBezierPath, getSmoothStepPath } from '@xyflow/react';

import { LINK_KIND_COLOR, cableOpacity, cableStrokeWidth } from '../../lib/linkColors';
import type { EdgeRouting } from '../../lib/store/createStore';
import { lagHoverKey, memberHoverKey, useHoverMode, useHoverTrace, type HoverHudInfo } from '../../lib/store/hoverTrace';
import { portAddressForInterface, portCenterInNode, type NodePanel } from '../../lib/frontpanel';
import { getFloatingEdgeParams, getHandleCoordinates } from '../../lib/edgeUtils';
import { EDGE_INTERACTION_WIDTH } from '../../lib/constants';
import type { UILagGroup, UIMemberLink } from '../../types/ui';
import { topologyLagTestId, topologyMemberLinkTestId } from '../../lib/testIds';

import CableLabel from './CableLabel';

export interface NodeLike {
  position: { x: number; y: number };
  internals?: { positionAbsolute?: { x: number; y: number } };
  measured?: { width?: number; height?: number };
  data?: { breakouts?: Record<string, number> };
}

export interface CableEnd { x: number; y: number; anchored: boolean; fallbackPosition: Position }

const nodeOrigin = (node: NodeLike) => node.internals?.positionAbsolute ?? node.position;

// Cable endpoint for one side of a member link: the exact port centre (or breakout-channel
// sliver) when the node renders a front panel and the interface maps onto it, otherwise the
// node-boundary point of the floating edge between the two nodes.
export function cableEnd(
  node: NodeLike,
  panel: NodePanel | null,
  iface: string | undefined,
  fallback: { x: number; y: number; position: Position },
): CableEnd {
  if (panel && iface) {
    const address = portAddressForInterface(iface, panel.meta);
    const channels = address ? node.data?.breakouts?.[address.cage] : undefined;
    const breakout = address?.channel && channels
      ? { channel: address.channel, channels: Math.max(channels, address.channel) }
      : undefined;
    const center = address ? portCenterInNode(panel.meta, address.cage, breakout) : null;
    if (center) {
      const origin = nodeOrigin(node);
      return { x: origin.x + center.x, y: origin.y + center.y, anchored: true, fallbackPosition: fallback.position };
    }
  }
  return { x: fallback.x, y: fallback.y, anchored: false, fallbackPosition: fallback.position };
}

// Anchored ends leave the faceplate vertically toward the far end; floating ends keep the
// node-boundary direction.
export function endPosition(end: CableEnd, other: CableEnd): Position {
  if (!end.anchored) return end.fallbackPosition;
  return other.y >= end.y ? Position.Bottom : Position.Top;
}

interface CableProps {
  edgeId: string;
  member: UIMemberLink;
  index: number;
  lag?: UILagGroup;
  showLagChip: boolean;
  src: CableEnd;
  tgt: CableEnd;
  edgeNodeA?: string;
  edgeNodeB?: string;
  routing: EdgeRouting;
  isMemberSelected: boolean;
  isSimNodeEdge: boolean;
  isExternalEdge?: boolean;
  isConnectedToSelectedNode?: boolean;
  onMemberLinkClick: (e: React.MouseEvent, index: number) => void;
  onMemberLinkContextMenu: (e: React.MouseEvent, index: number) => void;
  onLagClick: (e: React.MouseEvent, lagId: string) => void;
  onLagContextMenu: (lagId: string) => void;
}

function cableTestId({ lag, showLagChip, edgeNodeA, edgeNodeB, index }: Pick<CableProps, 'lag' | 'showLagChip' | 'edgeNodeA' | 'edgeNodeB' | 'index'>): string | undefined {
  if (!edgeNodeA || !edgeNodeB) return undefined;
  if (!lag) return topologyMemberLinkTestId(edgeNodeA, edgeNodeB, index);
  return showLagChip ? topologyLagTestId(edgeNodeA, edgeNodeB, lag.name) : undefined;
}

function Cable(props: CableProps) {
  const {
    edgeId, member, index, lag, src, tgt, edgeNodeA, edgeNodeB, routing,
    isMemberSelected, isSimNodeEdge, isExternalEdge, isConnectedToSelectedNode,
    onMemberLinkClick, onMemberLinkContextMenu, onLagClick, onLagContextMenu,
  } = props;

  // LAG members share the group's key so hovering any member traces the whole LAG.
  const hoverKey = lag ? lagHoverKey(edgeId, lag.id) : memberHoverKey(edgeId, index);
  const hoverMode = useHoverMode(hoverKey);
  const setHover = useHoverTrace(state => state.setHover);
  const clearHover = useHoverTrace(state => state.clearHover);

  // A cable deleted mid-hover never fires mouseleave — drop its trace on unmount.
  useEffect(() => () => { clearHover(hoverKey); }, [hoverKey, clearHover]);

  const ends = {
    sourceX: src.x,
    sourceY: src.y,
    targetX: tgt.x,
    targetY: tgt.y,
    sourcePosition: endPosition(src, tgt),
    targetPosition: endPosition(tgt, src),
  };
  const [path, labelX, labelY] = routing === 'elbow'
    ? getSmoothStepPath({ ...ends, borderRadius: 6, offset: 14 + (index % 8) * 5 })
    : getBezierPath({ ...ends, curvature: 0.3 });

  const handleClick = (e: React.MouseEvent) => {
    if (lag) onLagClick(e, lag.id);
    else onMemberLinkClick(e, index);
  };
  const handleContextMenu = (e: React.MouseEvent) => {
    if (lag) onLagContextMenu(lag.id);
    else onMemberLinkContextMenu(e, index);
  };
  let kind: HoverHudInfo['kind'] = isSimNodeEdge ? 'sim' : 'link';
  if (isExternalEdge) kind = 'edge';
  if (lag) kind = 'lag';

  const handleMouseEnter = () => {
    const hud: HoverHudInfo = {
      nodeA: edgeNodeA ?? '',
      ifaceA: member.sourceInterface,
      nodeB: edgeNodeB ?? '',
      ifaceB: member.targetInterface,
      kind,
      linkName: member.name,
      lagName: lag?.name,
    };
    setHover(hoverKey, hud);
  };

  const hovered = hoverMode === 'on';
  // Hover reveals the same interface label a click would — no selection required.
  const showLabel = (isMemberSelected || hovered) && !lag;

  // Cable-map look: always the kind colour — a thin muted thread at idle that pops when
  // hovered, selected or attached to the selected node.
  const stroke = LINK_KIND_COLOR[kind];
  const on = hovered || isMemberSelected || Boolean(isConnectedToSelectedNode);

  return (
    <g style={{ cursor: 'pointer' }}>
      <title>{`${member.name}: ${edgeNodeA ?? ''} ${member.sourceInterface} ↔ ${edgeNodeB ?? ''} ${member.targetInterface}`}</title>
      <path
        className="react-flow__edge-interaction"
        data-testid={cableTestId(props)}
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={EDGE_INTERACTION_WIDTH}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => { clearHover(hoverKey); }}
      />
      <path
        d={path}
        fill="none"
        stroke={stroke}
        strokeWidth={cableStrokeWidth(on)}
        opacity={cableOpacity(on, hoverMode === 'dim')}
        style={{ transition: 'opacity 120ms, stroke-width 120ms' }}
        pointerEvents="none"
      />
      {showLabel && (
        <CableLabel x={labelX} y={labelY} label={`${member.sourceInterface} ↔ ${member.targetInterface}`} title={member.name} color={stroke} />
      )}
    </g>
  );
}

export interface PortBundleEdgeProps {
  edgeId: string;
  edgeNodeA?: string;
  edgeNodeB?: string;
  sourceNode: NodeLike;
  targetNode: NodeLike;
  sourcePanel: NodePanel | null;
  targetPanel: NodePanel | null;
  /** stored edge handles — a non-port end (sim node) with a handle keeps that fixed anchor */
  sourceHandleId?: string | null;
  targetHandleId?: string | null;
  memberLinks: UIMemberLink[];
  lagGroups: UILagGroup[];
  routing: EdgeRouting;
  isSelected: boolean;
  isSimNodeEdge: boolean;
  isExternalEdge?: boolean;
  isConnectedToSelectedNode?: boolean;
  selectedMemberLinkIndices: number[];
  selectedLagId: string | null;
  onMemberLinkClick: (e: React.MouseEvent, index: number) => void;
  onMemberLinkContextMenu: (e: React.MouseEvent, index: number) => void;
  onLagClick: (e: React.MouseEvent, lagId: string) => void;
  onLagContextMenu: (lagId: string) => void;
}

export default function PortBundleEdge({
  edgeId,
  edgeNodeA,
  edgeNodeB,
  sourceNode,
  targetNode,
  sourcePanel,
  targetPanel,
  sourceHandleId,
  targetHandleId,
  memberLinks,
  lagGroups,
  routing,
  isSelected,
  isSimNodeEdge,
  isExternalEdge,
  isConnectedToSelectedNode,
  selectedMemberLinkIndices,
  selectedLagId,
  onMemberLinkClick,
  onMemberLinkContextMenu,
  onLagClick,
  onLagContextMenu,
}: PortBundleEdgeProps) {
  const floating = getFloatingEdgeParams(sourceNode, targetNode);

  // Non-panel ends with a stored handle (sim nodes) anchor there for good; ends without one
  // float with the relative node positions.
  const fallbackFor = (
    node: NodeLike,
    handleId: string | null | undefined,
    floatingEnd: { x: number; y: number; position: Position },
  ) => {
    if (!handleId || handleId.startsWith('port:')) return floatingEnd;
    const coords = getHandleCoordinates(node, handleId);
    return { x: coords.x, y: coords.y, position: coords.position };
  };
  const sourceFallback = fallbackFor(sourceNode, sourceHandleId, { x: floating.sx, y: floating.sy, position: floating.sourcePos });
  const targetFallback = fallbackFor(targetNode, targetHandleId, { x: floating.tx, y: floating.ty, position: floating.targetPos });

  const lagByIndex = new Map<number, UILagGroup>();
  const lagChipIndex = new Map<string, number>();
  for (const lag of lagGroups) {
    for (const index of lag.memberLinkIndices) lagByIndex.set(index, lag);
    if (lag.memberLinkIndices.length) lagChipIndex.set(lag.id, lag.memberLinkIndices[0]);
  }

  return (
    <g>
      {memberLinks.map((member, index) => {
        const lag = lagByIndex.get(index);
        const isMemberSelected = isSelected && (
          selectedMemberLinkIndices.includes(index) || (lag != null && selectedLagId === lag.id)
        );
        return (
          <Cable
            key={member.name || index}
            edgeId={edgeId}
            member={member}
            index={index}
            lag={lag}
            showLagChip={lag != null && lagChipIndex.get(lag.id) === index}
            src={cableEnd(sourceNode, sourcePanel, member.sourceInterface, sourceFallback)}
            tgt={cableEnd(targetNode, targetPanel, member.targetInterface, targetFallback)}
            edgeNodeA={edgeNodeA}
            edgeNodeB={edgeNodeB}
            routing={routing}
            isMemberSelected={isMemberSelected}
            isSimNodeEdge={isSimNodeEdge}
            isExternalEdge={isExternalEdge}
            isConnectedToSelectedNode={isConnectedToSelectedNode}
            onMemberLinkClick={onMemberLinkClick}
            onMemberLinkContextMenu={onMemberLinkContextMenu}
            onLagClick={onLagClick}
            onLagContextMenu={onLagContextMenu}
          />
        );
      })}
    </g>
  );
}
