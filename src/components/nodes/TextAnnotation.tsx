import { useState, useRef, useEffect, useCallback } from 'react';
import type { NodeProps } from '@xyflow/react';

interface TextAnnotationData {
  [key: string]: unknown;
  annotationId: string;
  text: string;
  fontSize: number;
  fontColor: string;
  isEditing?: boolean;
  onEditComplete?: (id: string, newText: string) => void;
  onEditCancel?: () => void;
}

export default function TextAnnotation({ data, selected }: NodeProps) {
  const d = data as TextAnnotationData;
  const { fontSize, fontColor, isEditing, onEditComplete, onEditCancel } = d;

  const [draftText, setDraftText] = useState(d.text);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing) {
      setDraftText(d.text);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          textareaRef.current?.focus();
          textareaRef.current?.select();
        });
      });
    }
  }, [isEditing, d.text]);

  const handleSave = useCallback(() => {
    onEditComplete?.(d.annotationId, draftText);
  }, [onEditComplete, d.annotationId, draftText]);

  const handleCancel = useCallback(() => {
    setDraftText(d.text);
    onEditCancel?.();
  }, [onEditCancel, d.text]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      handleCancel();
      return;
    }
    e.stopPropagation();
  }, [handleCancel]);

  if (isEditing) {
    return (
      <div
        className={`px-2 py-1 rounded ${
          selected ? 'outline outline-2 outline-(--color-node-border-selected)' : ''
        }`}
        style={{ fontSize, color: fontColor, minWidth: 40, minHeight: 20 }}
      >
        <textarea
          ref={textareaRef}
          className="nodrag nowheel"
          value={draftText}
          onChange={e => setDraftText(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          style={{
            fontSize,
            color: fontColor,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            resize: 'both',
            fontFamily: 'inherit',
            lineHeight: 'inherit',
            padding: 0,
            margin: 0,
            minWidth: 40,
            minHeight: 20,
            whiteSpace: 'pre-wrap',
            overflow: 'hidden',
          }}
        />
      </div>
    );
  }

  return (
    <div
      className={`px-2 py-1 rounded cursor-move ${
        selected ? 'outline outline-2 outline-(--color-node-border-selected)' : ''
      }`}
      style={{ fontSize, color: fontColor, minWidth: 40, minHeight: 20 }}
    >
      <span style={{ whiteSpace: 'pre-wrap' }}>
        {d.text || 'Text'}
      </span>
    </div>
  );
}
