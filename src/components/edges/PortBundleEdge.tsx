import { Position, EdgeLabelRenderer, getBezierPath, getSmoothStepPath } from '@xyflow/react';
import { Chip } from '@mui/material';

import type { EdgeRouting } from '../../lib/store/createStore';
import { portAddressForInterface, portCenterInNode, type NodePanel } from '../../lib/frontpanel';
import { getFloatingEdgeParams } from '../../lib/edgeUtils';
import { EDGE_INTERACTION_WIDTH } from '../../lib/constants';
import type { UILagGroup, UIMemberLink } from '../../types/ui';
import { topologyLagTestId, topologyMemberLinkTestId } from '../../lib/testIds';

interface NodeLike {
  position: { x: number; y: number };
  internals?: { positionAbsolute?: { x: number; y: number } };
  measured?: { width?: number; height?: number };
  data?: { breakouts?: Record<string, number> };
}

interface CableEnd { x: number; y: number; anchored: boolean; fallbackPosition: Position }

const nodeOrigin = (node: NodeLike) => node.internals?.positionAbsolute ?? node.position;

// Cable endpoint for one side of a member link: the exact port centre (or breakout-channel
// sliver) when the node renders a front panel and the interface maps onto it, otherwise the
// node-boundary point of the floating edge between the two nodes.
function cableEnd(
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
function endPosition(end: CableEnd, other: CableEnd): Position {
  if (!end.anchored) return end.fallbackPosition;
  return other.y >= end.y ? Position.Bottom : Position.Top;
}

function memberStroke(isMemberSelected: boolean, isConnectedToSelectedNode?: boolean): string {
  if (isMemberSelected) return 'var(--color-link-stroke-selected)';
  if (isConnectedToSelectedNode) return 'var(--color-link-stroke-highlight)';
  return 'var(--color-link-stroke)';
}

function CableLabel({ x, y, label, title }: { x: number; y: number; label: string; title: string }) {
  return (
    <EdgeLabelRenderer>
      <div
        style={{
          position: 'absolute',
          transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`,
          pointerEvents: 'none',
        }}
      >
        <Chip
          label={label}
          size="small"
          title={title}
          sx={{
            height: '14px',
            fontSize: '8px',
            fontWeight: 400,
            bgcolor: 'var(--color-node-bg)',
            color: 'var(--color-node-text)',
            border: '1px solid var(--color-link-stroke)',
            '& .MuiChip-label': { px: '3px' },
          }}
        />
      </div>
    </EdgeLabelRenderer>
  );
}

interface CableProps {
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
    member, index, lag, showLagChip, src, tgt, edgeNodeA, edgeNodeB, routing,
    isMemberSelected, isSimNodeEdge, isConnectedToSelectedNode,
    onMemberLinkClick, onMemberLinkContextMenu, onLagClick, onLagContextMenu,
  } = props;

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

  const showLabel = isMemberSelected && !lag;

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
      />
      <path
        d={path}
        fill="none"
        stroke={memberStroke(isMemberSelected, isConnectedToSelectedNode)}
        strokeWidth={isMemberSelected ? 1.5 : 1}
        strokeDasharray={isSimNodeEdge ? '5 5' : undefined}
        pointerEvents="none"
      />
      {showLagChip && lag && (
        <CableLabel x={labelX} y={labelY} label="LAG" title={`Local LAG: ${lag.name} (${lag.memberLinkIndices.length} endpoints)`} />
      )}
      {showLabel && (
        <CableLabel x={labelX} y={labelY} label={`${member.sourceInterface} ↔ ${member.targetInterface}`} title={member.name} />
      )}
    </g>
  );
}

export interface PortBundleEdgeProps {
  edgeNodeA?: string;
  edgeNodeB?: string;
  sourceNode: NodeLike;
  targetNode: NodeLike;
  sourcePanel: NodePanel | null;
  targetPanel: NodePanel | null;
  memberLinks: UIMemberLink[];
  lagGroups: UILagGroup[];
  routing: EdgeRouting;
  isSelected: boolean;
  isSimNodeEdge: boolean;
  isConnectedToSelectedNode?: boolean;
  selectedMemberLinkIndices: number[];
  selectedLagId: string | null;
  onMemberLinkClick: (e: React.MouseEvent, index: number) => void;
  onMemberLinkContextMenu: (e: React.MouseEvent, index: number) => void;
  onLagClick: (e: React.MouseEvent, lagId: string) => void;
  onLagContextMenu: (lagId: string) => void;
}

export default function PortBundleEdge({
  edgeNodeA,
  edgeNodeB,
  sourceNode,
  targetNode,
  sourcePanel,
  targetPanel,
  memberLinks,
  lagGroups,
  routing,
  isSelected,
  isSimNodeEdge,
  isConnectedToSelectedNode,
  selectedMemberLinkIndices,
  selectedLagId,
  onMemberLinkClick,
  onMemberLinkContextMenu,
  onLagClick,
  onLagContextMenu,
}: PortBundleEdgeProps) {
  const floating = getFloatingEdgeParams(sourceNode, targetNode);

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
            member={member}
            index={index}
            lag={lag}
            showLagChip={lag != null && lagChipIndex.get(lag.id) === index}
            src={cableEnd(sourceNode, sourcePanel, member.sourceInterface, { x: floating.sx, y: floating.sy, position: floating.sourcePos })}
            tgt={cableEnd(targetNode, targetPanel, member.targetInterface, { x: floating.tx, y: floating.ty, position: floating.targetPos })}
            edgeNodeA={edgeNodeA}
            edgeNodeB={edgeNodeB}
            routing={routing}
            isMemberSelected={isMemberSelected}
            isSimNodeEdge={isSimNodeEdge}
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
