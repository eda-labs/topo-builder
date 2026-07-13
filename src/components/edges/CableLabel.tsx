import { EdgeLabelRenderer } from '@xyflow/react';

/**
 * Interface label anchored on a cable — cable-map's end-label pill (dark blue plate, border in
 * the cable's kind colour). Selection and hover render the same label so hovering a link
 * reveals exactly what clicking it would.
 */
export default function CableLabel({ x, y, label, title, color }: {
  x: number;
  y: number;
  label: string;
  title: string;
  /** border colour — the cable's kind colour, like cable-map */
  color?: string;
}) {
  return (
    <EdgeLabelRenderer>
      <div
        title={title}
        style={{
          position: 'absolute',
          transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`,
          fontSize: 10,
          fontWeight: 600,
          lineHeight: 1.3,
          padding: '1px 6px',
          borderRadius: 4,
          background: '#001135',
          color: '#fff',
          border: `1px solid ${color ?? 'var(--color-link-stroke)'}`,
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          zIndex: 10,
        }}
      >
        {label}
      </div>
    </EdgeLabelRenderer>
  );
}
