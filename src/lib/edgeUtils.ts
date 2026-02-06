import { Position } from '@xyflow/react';
import { Bezier } from 'bezier-js';

import { DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT, LINK_OFFSET_SPACING } from './constants';

// ============ Floating Edge Utilities ============

interface NodeBounds {
  position: { x: number; y: number };
  measured?: { width?: number; height?: number };
}

/**
 * Get center point of a node
 */
export function getNodeCenter(node: NodeBounds): { x: number; y: number } {
  const width = node.measured?.width || DEFAULT_NODE_WIDTH;
  const height = node.measured?.height || DEFAULT_NODE_HEIGHT;
  return {
    x: node.position.x + width / 2,
    y: node.position.y + height / 2,
  };
}

/**
 * Calculate optimal positions for floating edges based on node centers.
 * Returns the source and target coordinates and positions.
 */
export function getFloatingEdgeParams(
  sourceNode: NodeBounds,
  targetNode: NodeBounds,
): { sx: number; sy: number; tx: number; ty: number; sourcePos: Position; targetPos: Position } {
  const sourceCenter = getNodeCenter(sourceNode);
  const targetCenter = getNodeCenter(targetNode);

  const horizontalDiff = Math.abs(sourceCenter.x - targetCenter.x);
  const verticalDiff = Math.abs(sourceCenter.y - targetCenter.y);

  let sourcePos: Position;
  let targetPos: Position;

  if (horizontalDiff > verticalDiff) {
    // Use left/right
    sourcePos = sourceCenter.x > targetCenter.x ? Position.Left : Position.Right;
    targetPos = sourceCenter.x > targetCenter.x ? Position.Right : Position.Left;
  } else {
    // Use top/bottom
    sourcePos = sourceCenter.y > targetCenter.y ? Position.Top : Position.Bottom;
    targetPos = sourceCenter.y > targetCenter.y ? Position.Bottom : Position.Top;
  }

  const posToHandle = (pos: Position) => {
    if (pos === Position.Left) return 'left';
    if (pos === Position.Right) return 'right';
    if (pos === Position.Top) return 'top';
    return 'bottom';
  };
  const sourceHandle = posToHandle(sourcePos);
  const targetHandle = posToHandle(targetPos);

  const sourceCoords = getHandleCoordinatesFromPosition(sourceNode, sourceHandle);
  const targetCoords = getHandleCoordinatesFromPosition(targetNode, targetHandle);

  return {
    sx: sourceCoords.x,
    sy: sourceCoords.y,
    tx: targetCoords.x,
    ty: targetCoords.y,
    sourcePos,
    targetPos,
  };
}

/**
 * Get handle coordinates from a position string (used by floating edge calculation)
 */
function getHandleCoordinatesFromPosition(
  node: NodeBounds,
  handle: string,
): { x: number; y: number } {
  const width = node.measured?.width || DEFAULT_NODE_WIDTH;
  const height = node.measured?.height || DEFAULT_NODE_HEIGHT;
  const position = parseHandlePosition(handle);

  let x = node.position.x + width / 2;
  let y = node.position.y + height / 2;

  switch (position) {
    case Position.Top:
      x = node.position.x + width / 2;
      y = node.position.y;
      break;
    case Position.Bottom:
      x = node.position.x + width / 2;
      y = node.position.y + height;
      break;
    case Position.Left:
      x = node.position.x;
      y = node.position.y + height / 2;
      break;
    case Position.Right:
      x = node.position.x + width;
      y = node.position.y + height / 2;
      break;
  }

  return { x, y };
}

// ============ Control Point and Path Utilities ============

export function getControlPoint(x: number, y: number, position: Position, offset: number): { x: number; y: number } {
  switch (position) {
    case Position.Top:
      return { x, y: y - offset };
    case Position.Bottom:
      return { x, y: y + offset };
    case Position.Left:
      return { x: x - offset, y };
    case Position.Right:
      return { x: x + offset, y };
    default:
      return { x, y: y - offset };
  }
}

export function getPerpendicularOffset(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  offset: number,
): { x: number; y: number } {
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length === 0) return { x: 0, y: offset };
  const px = -dy / length;
  const py = dx / length;
  return { x: px * offset, y: py * offset };
}

export function calculateLinkOffsets(linkCount: number, spacing: number = LINK_OFFSET_SPACING): number[] {
  if (linkCount <= 1) return [0];
  const offsets: number[] = [];
  const totalWidth = (linkCount - 1) * spacing;
  const startOffset = -totalWidth / 2;
  for (let i = 0; i < linkCount; i++) {
    offsets.push(startOffset + i * spacing);
  }
  return offsets;
}

export function createFannedBezierPath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  sourcePosition: Position,
  targetPosition: Position,
  offset: number,
): { path: string; midpoint: { x: number; y: number } } {
  const perp = getPerpendicularOffset(sourceX, sourceY, targetX, targetY, offset);

  const distance = Math.sqrt((targetX - sourceX) ** 2 + (targetY - sourceY) ** 2);
  const curvature = sourcePosition === targetPosition
    ? Math.max(50, distance * 0.5)
    : Math.max(50, distance * 0.3);

  const c1Base = getControlPoint(sourceX, sourceY, sourcePosition, curvature);
  const c2Base = getControlPoint(targetX, targetY, targetPosition, curvature);

  const c1 = { x: c1Base.x + perp.x * 2, y: c1Base.y + perp.y * 2 };
  const c2 = { x: c2Base.x + perp.x * 2, y: c2Base.y + perp.y * 2 };

  const bezier = new Bezier(
    sourceX, sourceY,
    c1.x, c1.y,
    c2.x, c2.y,
    targetX, targetY,
  );

  const mid = bezier.get(0.5);
  return { path: bezier.toSVG(), midpoint: { x: mid.x, y: mid.y } };
}

export function parseHandlePosition(handle: string | null | undefined): Position {
  const handleStr = handle ?? '';
  if (handleStr.startsWith('top')) return Position.Top;
  if (handleStr.startsWith('bottom')) return Position.Bottom;
  if (handleStr.startsWith('left')) return Position.Left;
  if (handleStr.startsWith('right')) return Position.Right;
  return Position.Bottom;
}

export function getHandleCoordinates(
  node: { position: { x: number; y: number }; measured?: { width?: number; height?: number } },
  handle: string | null | undefined,
): { x: number; y: number; position: Position } {
  const width = node.measured?.width || 150;
  const height = node.measured?.height || 50;
  const position = parseHandlePosition(handle);

  let x = node.position.x + width / 2;
  let y = node.position.y + height / 2;

  switch (position) {
    case Position.Top:
      x = node.position.x + width / 2;
      y = node.position.y;
      break;
    case Position.Bottom:
      x = node.position.x + width / 2;
      y = node.position.y + height;
      break;
    case Position.Left:
      x = node.position.x;
      y = node.position.y + height / 2;
      break;
    case Position.Right:
      x = node.position.x + width;
      y = node.position.y + height / 2;
      break;
  }

  return { x, y, position };
}
