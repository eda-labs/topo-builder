import { useEffect } from 'react';
import { Position, getSmoothStepPath } from '@xyflow/react';
import { Bezier } from 'bezier-js';

import { getFloatingEdgeParams, getControlPoint, getNodeCenter } from '../../lib/edgeUtils';
import { EDGE_INTERACTION_WIDTH, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT, ESI_LAG_STEM_LENGTH } from '../../lib/constants';
import { LINK_KIND_COLOR, cableOpacity, cableStrokeWidth } from '../../lib/linkColors';
import type { EdgeRouting } from '../../lib/store/createStore';
import { esiLagHoverKey, useHoverMode, useHoverTrace, type HoverHudInfo } from '../../lib/store/hoverTrace';
import type { NodePanel } from '../../lib/frontpanel';
import type { UIEsiLeaf, UIMemberLink } from '../../types/ui';

import CableLabel from './CableLabel';
import { cableEnd, endPosition, type CableEnd, type NodeLike } from './PortBundleEdge';

const MLAG_COLOR = LINK_KIND_COLOR.mlag;

interface NodeInfo extends NodeLike {
  id: string;
}

interface EsiLagEdgeProps {
  id: string;
  testId?: string;
  sourceNode: NodeInfo;
  /** display name of the common (multihomed) endpoint — the HUD's near side */
  sourceName?: string;
  isSelected: boolean;
  isSimNodeEdge: boolean;
  isConnectedToSelectedNode?: boolean;
  esiLeaves: UIEsiLeaf[];
  leafNodes: Map<string, NodeInfo>;
  /** memberLinks[i] pairs with esiLeaves[i] */
  memberLinks?: UIMemberLink[];
  esiLagName?: string;
  /** per-leaf front panels — legs anchor at the exact leaf port when resolvable */
  leafPanels?: Map<string, NodePanel | null>;
  routing?: EdgeRouting;
}

interface Leg {
  path: string;
  midpoint: { x: number; y: number };
  leafName: string;
  member?: UIMemberLink;
}

export default function EsiLagEdge({
  id,
  testId,
  sourceNode,
  sourceName,
  isSelected,
  isConnectedToSelectedNode,
  esiLeaves,
  leafNodes,
  memberLinks,
  esiLagName,
  leafPanels,
  routing = 'curved',
}: EsiLagEdgeProps) {
  const hoverKey = esiLagHoverKey(id);
  const hoverMode = useHoverMode(hoverKey);
  const setHover = useHoverTrace(state => state.setHover);
  const clearHover = useHoverTrace(state => state.clearHover);

  // An ESI-LAG deleted mid-hover never fires mouseleave — drop its trace on unmount.
  useEffect(() => () => { clearHover(hoverKey); }, [hoverKey, clearHover]);

  const sourceCenter = getNodeCenter(sourceNode);

  const leafNodeInfos = esiLeaves
    .map(leaf => leafNodes.get(leaf.nodeId))
    .filter((n): n is NodeInfo => n !== undefined);

  if (leafNodeInfos.length === 0) return null;

  const avgTargetCenter = {
    x: leafNodeInfos.reduce((sum, n) => sum + getNodeCenter(n).x, 0) / leafNodeInfos.length,
    y: leafNodeInfos.reduce((sum, n) => sum + getNodeCenter(n).y, 0) / leafNodeInfos.length,
  };

  const horizontalDiff = Math.abs(sourceCenter.x - avgTargetCenter.x);
  const verticalDiff = Math.abs(sourceCenter.y - avgTargetCenter.y);

  let sourcePosition: Position;
  if (horizontalDiff > verticalDiff) {
    sourcePosition = sourceCenter.x > avgTargetCenter.x ? Position.Left : Position.Right;
  } else {
    sourcePosition = sourceCenter.y > avgTargetCenter.y ? Position.Top : Position.Bottom;
  }

  const sourceWidth = sourceNode.measured?.width || DEFAULT_NODE_WIDTH;
  const sourceHeight = sourceNode.measured?.height || DEFAULT_NODE_HEIGHT;
  const sourceAnchorPoints: Record<Position, { x: number; y: number }> = {
    [Position.Top]: {
      x: sourceNode.position.x + sourceWidth / 2,
      y: sourceNode.position.y,
    },
    [Position.Bottom]: {
      x: sourceNode.position.x + sourceWidth / 2,
      y: sourceNode.position.y + sourceHeight,
    },
    [Position.Left]: {
      x: sourceNode.position.x,
      y: sourceNode.position.y + sourceHeight / 2,
    },
    [Position.Right]: {
      x: sourceNode.position.x + sourceWidth,
      y: sourceNode.position.y + sourceHeight / 2,
    },
  };

  const { x: sourceX, y: sourceY } = sourceAnchorPoints[sourcePosition];

  const stemDeltas: Record<Position, { dx: number; dy: number }> = {
    [Position.Top]: { dx: 0, dy: -ESI_LAG_STEM_LENGTH },
    [Position.Bottom]: { dx: 0, dy: ESI_LAG_STEM_LENGTH },
    [Position.Left]: { dx: -ESI_LAG_STEM_LENGTH, dy: 0 },
    [Position.Right]: { dx: ESI_LAG_STEM_LENGTH, dy: 0 },
  };

  const { dx, dy } = stemDeltas[sourcePosition];
  const stemX = sourceX + dx;
  const stemY = sourceY + dy;
  const stemEnd: CableEnd = { x: stemX, y: stemY, anchored: false, fallbackPosition: sourcePosition };

  // Legs follow the canvas routing toggle: smoothstep elbows like the per-port cables, or the
  // classic fanned beziers. Both start with the straight stem out of the common node.
  const createLeg = (tgt: CableEnd, tgtPosition: Position, legIndex: number): { path: string; midpoint: { x: number; y: number } } => {
    const stemPath = `M ${sourceX} ${sourceY} L ${stemX} ${stemY}`;

    if (routing === 'elbow') {
      const [path, labelX, labelY] = getSmoothStepPath({
        sourceX: stemX,
        sourceY: stemY,
        targetX: tgt.x,
        targetY: tgt.y,
        sourcePosition,
        targetPosition: tgtPosition,
        borderRadius: 6,
        offset: 14 + (legIndex % 8) * 5,
      });
      return { path: `${stemPath} ${path}`, midpoint: { x: labelX, y: labelY } };
    }

    const distance = Math.sqrt((tgt.x - stemX) ** 2 + (tgt.y - stemY) ** 2);
    const curvature = Math.max(50, distance * 0.3);

    const c1 = getControlPoint(stemX, stemY, sourcePosition, curvature);
    const c2 = getControlPoint(tgt.x, tgt.y, tgtPosition, curvature);
    const mid = new Bezier(stemX, stemY, c1.x, c1.y, c2.x, c2.y, tgt.x, tgt.y).get(0.5);

    return {
      path: `${stemPath} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${tgt.x} ${tgt.y}`,
      midpoint: { x: mid.x, y: mid.y },
    };
  };

  const legs: Leg[] = [];
  esiLeaves.forEach((leaf, leafIndex) => {
    const leafNode = leafNodes.get(leaf.nodeId);
    if (!leafNode) return;

    const member = memberLinks?.[leafIndex];
    const floating = getFloatingEdgeParams(sourceNode, leafNode);
    const tgt = cableEnd(leafNode, leafPanels?.get(leaf.nodeId) ?? null, member?.targetInterface, {
      x: floating.tx,
      y: floating.ty,
      position: floating.targetPos,
    });
    legs.push({
      ...createLeg(tgt, endPosition(tgt, stemEnd), leafIndex),
      leafName: leaf.nodeName,
      member,
    });
  });

  const handleMouseEnter = (leg: Leg) => () => {
    const hud: HoverHudInfo = {
      nodeA: sourceName ?? '',
      ifaceA: leg.member?.sourceInterface ?? '',
      nodeB: leg.leafName,
      ifaceB: leg.member?.targetInterface,
      kind: 'mlag',
      linkName: leg.member?.name,
      lagName: esiLagName,
    };
    setHover(hoverKey, hud);
  };

  const hovered = hoverMode === 'on';
  const showLabels = hovered || isSelected;

  // Cable-map look: the legs always wear the multihome-LAG purple — a thin muted thread at
  // idle that pops when hovered, selected or attached to the selected node.
  const on = hovered || isSelected || Boolean(isConnectedToSelectedNode);

  return (
    <g>
      {legs.map((leg, i) => (
        <g key={`${id}-leg${i}`}>
          <path
            className="react-flow__edge-interaction"
            data-testid={i === 0 ? testId : undefined}
            d={leg.path}
            fill="none"
            stroke="transparent"
            strokeWidth={EDGE_INTERACTION_WIDTH}
            onMouseEnter={handleMouseEnter(leg)}
            onMouseLeave={() => { clearHover(hoverKey); }}
          />
          <path
            d={leg.path}
            fill="none"
            stroke={MLAG_COLOR}
            strokeWidth={cableStrokeWidth(on)}
            opacity={cableOpacity(on, hoverMode === 'dim')}
            style={{ transition: 'opacity 120ms, stroke-width 120ms' }}
            pointerEvents="none"
          />
          {showLabels && leg.member && (
            <CableLabel
              x={leg.midpoint.x}
              y={leg.midpoint.y}
              label={`${leg.member.sourceInterface} ↔ ${leg.member.targetInterface}`}
              title={leg.member.name}
              color={MLAG_COLOR}
            />
          )}
        </g>
      ))}
    </g>
  );
}
