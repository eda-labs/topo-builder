import { getBezierPath, BaseEdge, Position, type EdgeProps } from '@xyflow/react';
import { Bezier } from 'bezier-js';

function getControlPoint(x: number, y: number, position: Position, offset: number): { x: number; y: number } {
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

export default function LinkEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
}: EdgeProps) {
  const isSimNodeEdge = source?.startsWith('sim-') || target?.startsWith('sim-');

  let edgePath: string;

  if (sourcePosition === targetPosition) {
    const distance = Math.sqrt((targetX - sourceX) ** 2 + (targetY - sourceY) ** 2);
    const curvature = Math.max(50, distance * 0.5);
    const c1 = getControlPoint(sourceX, sourceY, sourcePosition, curvature);
    const c2 = getControlPoint(targetX, targetY, targetPosition, curvature);

    const bezier = new Bezier(
      sourceX, sourceY,
      c1.x, c1.y,
      c2.x, c2.y,
      targetX, targetY
    );
    edgePath = bezier.toSVG();
  } else {
    [edgePath] = getBezierPath({
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition,
      targetPosition,
    });
  }

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      className={isSimNodeEdge ? 'sim-edge' : ''}
      interactionWidth={20}
      style={{
        stroke: selected ? 'var(--color-link-stroke-selected)' : 'var(--color-link-stroke)',
        strokeWidth: 1,
      }}
    />
  );
}
