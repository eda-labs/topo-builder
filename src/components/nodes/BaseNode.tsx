import { useEffect, useState, useRef, type ReactNode } from 'react';
import { Handle, Position, useStore } from '@xyflow/react';
import { TextField } from '@mui/material';
import { useTopologyStore } from '../../lib/store';

export interface BaseNodeProps {
  nodeId: string;
  selected: boolean;
  name: string;
  icon?: ReactNode;
  isNew?: boolean;
  onNameChange: (newName: string) => void;
  onNameBlur: () => void;
  className?: string;
}

export default function BaseNode({
  nodeId,
  selected,
  name,
  icon,
  isNew,
  onNameChange,
  onNameBlur,
  className = '',
}: BaseNodeProps) {
  const darkMode = useTopologyStore((state) => state.darkMode);
  const edges = useTopologyStore((state) => state.edges);
  const setError = useTopologyStore((state) => state.setError);
  const [isEditing, setIsEditing] = useState(false);
  const [localName, setLocalName] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);
  const originalName = useRef(name);
  const hasShownEmptyError = useRef(false);
  const hasAutoEdited = useRef(false);

  // Check if a connection is in progress
  const isConnecting = useStore((state) => state.connection.inProgress);

  // Find which handles have connections
  const connectedHandles = new Set<string>();
  edges.forEach((edge) => {
    if (edge.source === nodeId && edge.sourceHandle) {
      connectedHandles.add(edge.sourceHandle);
    }
    if (edge.target === nodeId && edge.targetHandle) {
      connectedHandles.add(edge.targetHandle);
    }
  });

  useEffect(() => {
    if (isNew && selected && !hasAutoEdited.current) {
      hasAutoEdited.current = true;
      setIsEditing(true);
      originalName.current = name;
      hasShownEmptyError.current = false;
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50); // 50ms debounce
    }
  }, [isNew, selected, name]);

  useEffect(() => {
    setLocalName(name);
  }, [name]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const alwaysShowAll = selected || isConnecting;

  const startEditing = () => {
    originalName.current = name;
    hasShownEmptyError.current = false;
    setIsEditing(true);
  };

  const finishEditing = () => {
    const trimmedName = localName.trim();
    if (trimmedName === '') {
      setLocalName(originalName.current);
      onNameChange(originalName.current);
    }
    setIsEditing(false);
    onNameBlur();
  };

  const getHandleClassName = (handleId: string) => {
    const isConnected = connectedHandles.has(handleId);
    const baseClass = '!w-2.5 !h-2.5 !bg-(--color-handle-bg) !border !border-solid !border-(--color-node-border) transition-opacity duration-150';

    if (alwaysShowAll || isConnected) {
      return `${baseClass} !opacity-100`;
    }
    return `${baseClass} !opacity-0 group-hover:!opacity-100`;
  };

  return (
    <div
      className={`group relative w-20 h-20 bg-(--color-node-bg) border rounded-lg flex flex-col items-center justify-center gap-0.5 ${
        selected ? 'border-(--color-node-border-selected)' : 'border-(--color-node-border)'
      } ${darkMode ? 'dark' : ''} ${className || 'border-solid'}`}
      onDoubleClick={startEditing}
    >
      <Handle type="source" position={Position.Top} id="top" className={getHandleClassName('top')} />
      <Handle type="target" position={Position.Top} id="top-target" className={getHandleClassName('top-target')} />
      <Handle type="source" position={Position.Bottom} id="bottom" className={getHandleClassName('bottom')} />
      <Handle type="target" position={Position.Bottom} id="bottom-target" className={getHandleClassName('bottom-target')} />
      <Handle type="source" position={Position.Left} id="left" className={getHandleClassName('left')} />
      <Handle type="target" position={Position.Left} id="left-target" className={getHandleClassName('left-target')} />
      <Handle type="source" position={Position.Right} id="right" className={getHandleClassName('right')} />
      <Handle type="target" position={Position.Right} id="right-target" className={getHandleClassName('right-target')} />

      {icon}

        {isEditing ? (
          <TextField
            inputRef={inputRef}
            size="small"
            variant="standard"
            value={localName}
            onChange={(e) => {
              const newValue = e.target.value;
              setLocalName(newValue);
              onNameChange(newValue);
              if (newValue.trim() === '') {
                if (!hasShownEmptyError.current) {
                  hasShownEmptyError.current = true;
                  setError("Node name can't be empty");
                }
              } else {
                hasShownEmptyError.current = false;
              }
            }}
            onBlur={finishEditing}
            onKeyDown={(e) => e.key === 'Enter' && finishEditing()}
            sx={{
              width: 70,
              '& .MuiInputBase-input': {
                padding: '2px 0',
                fontSize: '0.75rem',
                fontWeight: 'bold',
                color: 'var(--color-node-text)',
                textAlign: 'center',
              },
            }}
          />
        ) : (
          <div className="w-17.5 text-xs font-bold text-(--color-node-text) text-center cursor-text overflow-hidden text-ellipsis whitespace-nowrap">
            {localName}
          </div>
        )}
    </div>
  );
}
