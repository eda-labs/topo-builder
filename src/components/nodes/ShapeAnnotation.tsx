import { NodeResizer, type NodeProps } from '@xyflow/react';

import { useTopologyStore } from '../../lib/store';
import type { AnnotationShapeType, AnnotationStrokeStyle } from '../../types/ui';
interface ShapeAnnotationData {
  [key: string]: unknown;
  annotationId: string;
  shapeType: AnnotationShapeType;
  width: number;
  height: number;
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  strokeStyle: AnnotationStrokeStyle;
}

function getStrokeDashArray(style: AnnotationStrokeStyle, strokeWidth: number): string | undefined {
  switch (style) {
    case 'dashed': return `${strokeWidth * 4} ${strokeWidth * 3}`;
    case 'dotted': return `${strokeWidth} ${strokeWidth * 2}`;
    default: return undefined;
  }
}

function ShapeSvg({ shapeType, width, height, strokeColor, fillColor, strokeWidth, strokeStyle }: {
  shapeType: AnnotationShapeType;
  width: number;
  height: number;
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  strokeStyle: AnnotationStrokeStyle;
}) {
  const sw = strokeWidth;
  const half = sw / 2;
  const dashArray = getStrokeDashArray(strokeStyle, sw);

  if (shapeType === 'circle') {
    return (
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="absolute inset-0">
        <ellipse cx={width / 2} cy={height / 2} rx={(width - sw) / 2} ry={(height - sw) / 2}
          fill={fillColor} stroke={strokeColor} strokeWidth={sw} strokeDasharray={dashArray} />
      </svg>
    );
  }

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="absolute inset-0">
      <rect x={half} y={half} width={width - sw} height={height - sw} rx={10}
        fill={fillColor} stroke={strokeColor} strokeWidth={sw} strokeDasharray={dashArray} />
    </svg>
  );
}

export default function ShapeAnnotation({ data, selected }: NodeProps) {
  const d = data as ShapeAnnotationData;
  const updateAnnotation = useTopologyStore(s => s.updateAnnotation);

  const { width, height, strokeColor, fillColor, strokeWidth, strokeStyle } = d;

  const handleResize = (_: unknown, params: { width: number; height: number }) => {
    updateAnnotation(d.annotationId, {
      width: Math.round(params.width),
      height: Math.round(params.height),
    });
  };

  return (
    <>
      <NodeResizer
        isVisible={selected ?? false}
        minWidth={60}
        minHeight={40}
        onResize={handleResize}
        lineStyle={{ stroke: 'var(--color-node-border-selected)', strokeWidth: 1 }}
        handleStyle={{ width: 8, height: 8, borderRadius: 2, backgroundColor: 'var(--color-node-border-selected)', border: 'none' }}
      />
      <div className="relative" style={{ width, height }}>
        <ShapeSvg
          shapeType={d.shapeType}
          width={width}
          height={height}
          strokeColor={strokeColor}
          fillColor={fillColor}
          strokeWidth={strokeWidth}
          strokeStyle={strokeStyle}
        />
      </div>
    </>
  );
}
