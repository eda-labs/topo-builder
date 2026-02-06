import {
  Paper,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  ClickAwayListener,
  Popper,
  Fade,
  Box,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  DeleteSweep as ClearAllIcon,
  ViewInAr as SimNodeIcon,
  ChevronRight as ChevronRightIcon,
  SwapHoriz as SwapIcon,
  CallMerge as MergeIcon,
  ContentCopy as CopyIcon,
  ContentPaste as PasteIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
} from '@mui/icons-material';
import { useRef, useEffect, useState, type ReactNode } from 'react';

import type { NodeTemplate, SimNodeTemplate, LinkTemplate } from '../types/schema';

const SUBMENU_CHEVRON_SX = { ml: 1, color: 'text.secondary' } as const;

type TemplateLike = { name: string };

function TemplateSubmenu({
  templates,
  currentTemplate,
  onChoose,
  onClose,
}: {
  templates: TemplateLike[];
  currentTemplate?: string;
  onChoose: (templateName: string) => void;
  onClose: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Box
      onMouseEnter={() => { setOpen(true); }}
      onMouseLeave={() => { setOpen(false); }}
      sx={{ position: 'relative' }}
    >
      <MenuItem>
        <ListItemIcon><SwapIcon fontSize="small" /></ListItemIcon>
        <ListItemText>Template</ListItemText>
        <ChevronRightIcon fontSize="small" sx={SUBMENU_CHEVRON_SX} />
      </MenuItem>

      {open && (
        <Paper elevation={8} sx={{ position: 'absolute', left: '100%', top: 0, py: 0.5, minWidth: 140 }}>
          {templates.map(template => (
            <MenuItem
              key={template.name}
              disabled={template.name === currentTemplate}
              onClick={() => { onChoose(template.name); onClose(); }}
              sx={{ opacity: template.name === currentTemplate ? 0.5 : 1 }}
            >
              <ListItemText>{template.name}</ListItemText>
            </MenuItem>
          ))}
        </Paper>
      )}
    </Box>
  );
}

function ContextMenuNoSelectionItems({
  onClose,
  onAddNode,
  onAddSimNode,
}: {
  onClose: () => void;
  onAddNode: (templateName?: string) => void;
  onAddSimNode?: () => void;
}) {
  return (
    <>
      <MenuItem onClick={() => { onAddNode(); onClose(); }}>
        <ListItemIcon><AddIcon fontSize="small" /></ListItemIcon>
        <ListItemText>Add Node</ListItemText>
      </MenuItem>

      {onAddSimNode && (
        <MenuItem onClick={() => { onAddSimNode(); onClose(); }}>
          <ListItemIcon><SimNodeIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Add SimNode</ListItemText>
        </MenuItem>
      )}
    </>
  );
}

function ContextMenuNodeSelectionItems({
  onClose,
  onChangeNodeTemplate,
  nodeTemplates,
  currentNodeTemplate,
  onDeleteNode,
}: {
  onClose: () => void;
  onChangeNodeTemplate?: (templateName: string) => void;
  nodeTemplates: NodeTemplate[];
  currentNodeTemplate?: string;
  onDeleteNode?: () => void;
}) {
  return (
    <>
      {nodeTemplates.length > 0 && onChangeNodeTemplate && (
        <TemplateSubmenu
          templates={nodeTemplates}
          currentTemplate={currentNodeTemplate}
          onChoose={onChangeNodeTemplate}
          onClose={onClose}
        />
      )}

      {onDeleteNode && (
        <MenuItem onClick={() => { onDeleteNode(); onClose(); }}>
          <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
          <ListItemText>Delete Node</ListItemText>
        </MenuItem>
      )}
    </>
  );
}

function ContextMenuSimNodeSelectionItems({
  onClose,
  onChangeSimNodeTemplate,
  simNodeTemplates,
  currentSimNodeTemplate,
  onDeleteSimNode,
}: {
  onClose: () => void;
  onChangeSimNodeTemplate?: (templateName: string) => void;
  simNodeTemplates: SimNodeTemplate[];
  currentSimNodeTemplate?: string;
  onDeleteSimNode?: () => void;
}) {
  return (
    <>
      {simNodeTemplates.length > 0 && onChangeSimNodeTemplate && (
        <TemplateSubmenu
          templates={simNodeTemplates}
          currentTemplate={currentSimNodeTemplate}
          onChoose={onChangeSimNodeTemplate}
          onClose={onClose}
        />
      )}

      {onDeleteSimNode && (
        <MenuItem onClick={() => { onDeleteSimNode(); onClose(); }}>
          <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
          <ListItemText>Delete Node</ListItemText>
        </MenuItem>
      )}
    </>
  );
}

function ContextMenuEdgeSelectionItems({
  onClose,
  onChangeLinkTemplate,
  linkTemplates,
  currentLinkTemplate,
  selectedMemberLinkCount,
  onCreateLag,
  onDeleteEdge,
}: {
  onClose: () => void;
  onChangeLinkTemplate?: (templateName: string) => void;
  linkTemplates: LinkTemplate[];
  currentLinkTemplate?: string;
  selectedMemberLinkCount: number;
  onCreateLag?: () => void;
  onDeleteEdge?: () => void;
}) {
  return (
    <>
      {linkTemplates.length > 0 && onChangeLinkTemplate && (
        <TemplateSubmenu
          templates={linkTemplates}
          currentTemplate={currentLinkTemplate}
          onChoose={onChangeLinkTemplate}
          onClose={onClose}
        />
      )}

      {selectedMemberLinkCount >= 2 && onCreateLag && (
        <>
          <MenuItem onClick={() => { onCreateLag(); onClose(); }}>
            <ListItemIcon><MergeIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Create Local LAG</ListItemText>
          </MenuItem>
          <Divider />
        </>
      )}

      {onDeleteEdge && (
        <MenuItem onClick={() => { onDeleteEdge(); onClose(); }}>
          <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
          <ListItemText>Delete Link</ListItemText>
        </MenuItem>
      )}
    </>
  );
}

function ContextMenuMultiEdgeSelectionItems({
  onClose,
  canCreateEsiLag,
  isMergeIntoEsiLag,
  onCreateEsiLag,
  onDeleteEdge,
}: {
  onClose: () => void;
  canCreateEsiLag: boolean;
  isMergeIntoEsiLag: boolean;
  onCreateEsiLag?: () => void;
  onDeleteEdge?: () => void;
}) {
  return (
    <>
      {canCreateEsiLag && onCreateEsiLag && (
        <>
          <MenuItem onClick={() => { onCreateEsiLag(); onClose(); }}>
            <ListItemIcon><MergeIcon fontSize="small" /></ListItemIcon>
            <ListItemText>{isMergeIntoEsiLag ? 'Merge into ESI-LAG' : 'Create ESI-LAG'}</ListItemText>
          </MenuItem>
          <Divider />
        </>
      )}

      {onDeleteEdge && (
        <MenuItem onClick={() => { onDeleteEdge(); onClose(); }}>
          <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
          <ListItemText>Delete Links</ListItemText>
        </MenuItem>
      )}
    </>
  );
}

function ContextMenuSelectionSection({
  hasSelection,
  onClose,
  onAddNode,
  onAddSimNode,
  onDeleteNode,
  onDeleteSimNode,
  onDeleteEdge,
  onChangeNodeTemplate,
  onChangeSimNodeTemplate,
  onChangeLinkTemplate,
  onCreateLag,
  onCreateEsiLag,
  nodeTemplates,
  currentNodeTemplate,
  simNodeTemplates,
  currentSimNodeTemplate,
  linkTemplates,
  currentLinkTemplate,
  selectedMemberLinkCount,
  canCreateEsiLag,
  isMergeIntoEsiLag,
}: {
  hasSelection: 'node' | 'edge' | 'simNode' | 'multiEdge' | null;
  onClose: () => void;
  onAddNode: (templateName?: string) => void;
  onAddSimNode?: () => void;
  onDeleteNode?: () => void;
  onDeleteSimNode?: () => void;
  onDeleteEdge?: () => void;
  onChangeNodeTemplate?: (templateName: string) => void;
  onChangeSimNodeTemplate?: (templateName: string) => void;
  onChangeLinkTemplate?: (templateName: string) => void;
  onCreateLag?: () => void;
  onCreateEsiLag?: () => void;
  nodeTemplates: NodeTemplate[];
  currentNodeTemplate?: string;
  simNodeTemplates: SimNodeTemplate[];
  currentSimNodeTemplate?: string;
  linkTemplates: LinkTemplate[];
  currentLinkTemplate?: string;
  selectedMemberLinkCount: number;
  canCreateEsiLag: boolean;
  isMergeIntoEsiLag: boolean;
}) {
  switch (hasSelection) {
    case null:
      return (
        <ContextMenuNoSelectionItems
          onClose={onClose}
          onAddNode={onAddNode}
          onAddSimNode={onAddSimNode}
        />
      );
    case 'node':
      return (
        <ContextMenuNodeSelectionItems
          onClose={onClose}
          onChangeNodeTemplate={onChangeNodeTemplate}
          nodeTemplates={nodeTemplates}
          currentNodeTemplate={currentNodeTemplate}
          onDeleteNode={onDeleteNode}
        />
      );
    case 'simNode':
      return (
        <ContextMenuSimNodeSelectionItems
          onClose={onClose}
          onChangeSimNodeTemplate={onChangeSimNodeTemplate}
          simNodeTemplates={simNodeTemplates}
          currentSimNodeTemplate={currentSimNodeTemplate}
          onDeleteSimNode={onDeleteSimNode}
        />
      );
    case 'edge':
      return (
        <ContextMenuEdgeSelectionItems
          onClose={onClose}
          onChangeLinkTemplate={onChangeLinkTemplate}
          linkTemplates={linkTemplates}
          currentLinkTemplate={currentLinkTemplate}
          selectedMemberLinkCount={selectedMemberLinkCount}
          onCreateLag={onCreateLag}
          onDeleteEdge={onDeleteEdge}
        />
      );
    case 'multiEdge':
      return (
        <ContextMenuMultiEdgeSelectionItems
          onClose={onClose}
          canCreateEsiLag={canCreateEsiLag}
          isMergeIntoEsiLag={isMergeIntoEsiLag}
          onCreateEsiLag={onCreateEsiLag}
          onDeleteEdge={onDeleteEdge}
        />
      );
  }
}

function ContextMenuClipboardSection({
  onClose,
  canCopy,
  canPaste,
  onCopy,
  onPaste,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: {
  onClose: () => void;
  canCopy: boolean;
  canPaste: boolean;
  onCopy?: () => void;
  onPaste?: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
}) {
  const items: ReactNode[] = [];

  if (canCopy || canPaste) {
    items.push(<Divider key="divider-clipboard" />);
  }

  if (canCopy && onCopy) {
    items.push(
      <MenuItem key="copy" onClick={() => { onCopy(); onClose(); }}>
        <ListItemIcon><CopyIcon fontSize="small" /></ListItemIcon>
        <ListItemText>Copy</ListItemText>
      </MenuItem>,
    );
  }

  if (canPaste && onPaste) {
    items.push(
      <MenuItem key="paste" onClick={() => { onPaste(); onClose(); }}>
        <ListItemIcon><PasteIcon fontSize="small" /></ListItemIcon>
        <ListItemText>Paste</ListItemText>
      </MenuItem>,
    );
  }

  if (onUndo || onRedo) {
    items.push(<Divider key="divider-undo-redo" />);
  }

  if (onUndo) {
    items.push(
      <MenuItem key="undo" disabled={!canUndo} onClick={() => { onUndo(); onClose(); }}>
        <ListItemIcon><UndoIcon fontSize="small" /></ListItemIcon>
        <ListItemText>Undo</ListItemText>
      </MenuItem>,
    );
  }

  if (onRedo) {
    items.push(
      <MenuItem key="redo" disabled={!canRedo} onClick={() => { onRedo(); onClose(); }}>
        <ListItemIcon><RedoIcon fontSize="small" /></ListItemIcon>
        <ListItemText>Redo</ListItemText>
      </MenuItem>,
    );
  }

  return <>{items}</>;
}

function ContextMenuClearAllSection({
  hasContent,
  onClearAll,
  onClose,
}: {
  hasContent: boolean;
  onClearAll: () => void;
  onClose: () => void;
}) {
  if (!hasContent) return null;

  return (
    <>
      <Divider />
      <MenuItem onClick={() => { onClearAll(); onClose(); }}>
        <ListItemIcon><ClearAllIcon fontSize="small" color="error" /></ListItemIcon>
        <ListItemText>Clear All</ListItemText>
      </MenuItem>
    </>
  );
}

interface ContextMenuProps {
  open: boolean;
  position: { x: number; y: number };
  onClose: () => void;
  onAddNode: (templateName?: string) => void;
  onAddSimNode?: () => void;
  onDeleteNode?: () => void;
  onDeleteEdge?: () => void;
  onDeleteSimNode?: () => void;
  onChangeNodeTemplate?: (templateName: string) => void;
  onChangeSimNodeTemplate?: (templateName: string) => void;
  onChangeLinkTemplate?: (templateName: string) => void;
  onCreateLag?: () => void;
  onCreateEsiLag?: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onClearAll: () => void;
  hasSelection: 'node' | 'edge' | 'simNode' | 'multiEdge' | null;
  hasContent: boolean;
  canCopy?: boolean;
  canPaste?: boolean;
  nodeTemplates?: NodeTemplate[];
  currentNodeTemplate?: string;
  simNodeTemplates?: SimNodeTemplate[];
  currentSimNodeTemplate?: string;
  linkTemplates?: LinkTemplate[];
  currentLinkTemplate?: string;
  selectedMemberLinkCount?: number;
  canCreateEsiLag?: boolean;
  isMergeIntoEsiLag?: boolean;
}

export default function ContextMenu({
  open,
  position,
  onClose,
  onAddNode,
  onAddSimNode,
  onDeleteNode,
  onDeleteEdge,
  onDeleteSimNode,
  onChangeNodeTemplate,
  onChangeSimNodeTemplate,
  onChangeLinkTemplate,
  onCreateLag,
  onCreateEsiLag,
  onCopy,
  onPaste,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  onClearAll,
  hasSelection,
  hasContent,
  canCopy = false,
  canPaste = false,
  nodeTemplates = [],
  currentNodeTemplate,
  simNodeTemplates = [],
  currentSimNodeTemplate,
  linkTemplates = [],
  currentLinkTemplate,
  selectedMemberLinkCount = 0,
  canCreateEsiLag = false,
  isMergeIntoEsiLag = false,
}: ContextMenuProps) {
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const paperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (paperRef.current && !paperRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleOutsideContextMenu = (event: MouseEvent) => {
      if (paperRef.current && !paperRef.current.contains(event.target as Node)) {
        event.stopPropagation();
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener('mousedown', handleOutsideClick, true);
    document.addEventListener('contextmenu', handleOutsideContextMenu, true);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick, true);
      document.removeEventListener('contextmenu', handleOutsideContextMenu, true);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!anchorRef.current) {
      anchorRef.current = document.createElement('div');
      Object.assign(anchorRef.current.style, {
        position: 'fixed',
        width: '1px',
        height: '1px',
        pointerEvents: 'none',
      });
      document.body.appendChild(anchorRef.current);
    }
    anchorRef.current.style.left = `${position.x}px`;
    anchorRef.current.style.top = `${position.y}px`;
  }, [position]);

  if (!open) return null;

  return (
    <ClickAwayListener onClickAway={onClose} mouseEvent="onMouseDown">
      <Popper open={open} anchorEl={anchorRef.current} placement="bottom-start" className="z-1300" transition>
        {({ TransitionProps }) => (
          <Fade {...TransitionProps} timeout={200}>
            <Paper ref={paperRef} elevation={8} onContextMenu={e => { e.preventDefault(); }} sx={{ py: 0.5, minWidth: 180 }}>
              <ContextMenuSelectionSection
                hasSelection={hasSelection}
                onClose={onClose}
                onAddNode={onAddNode}
                onAddSimNode={onAddSimNode}
                onDeleteNode={onDeleteNode}
                onDeleteSimNode={onDeleteSimNode}
                onDeleteEdge={onDeleteEdge}
                onChangeNodeTemplate={onChangeNodeTemplate}
                onChangeSimNodeTemplate={onChangeSimNodeTemplate}
                onChangeLinkTemplate={onChangeLinkTemplate}
                onCreateLag={onCreateLag}
                onCreateEsiLag={onCreateEsiLag}
                nodeTemplates={nodeTemplates}
                currentNodeTemplate={currentNodeTemplate}
                simNodeTemplates={simNodeTemplates}
                currentSimNodeTemplate={currentSimNodeTemplate}
                linkTemplates={linkTemplates}
                currentLinkTemplate={currentLinkTemplate}
                selectedMemberLinkCount={selectedMemberLinkCount}
                canCreateEsiLag={canCreateEsiLag}
                isMergeIntoEsiLag={isMergeIntoEsiLag}
              />

              <ContextMenuClipboardSection
                onClose={onClose}
                canCopy={canCopy}
                canPaste={canPaste}
                onCopy={onCopy}
                onPaste={onPaste}
                canUndo={canUndo}
                canRedo={canRedo}
                onUndo={onUndo}
                onRedo={onRedo}
              />

              <ContextMenuClearAllSection
                hasContent={hasContent}
                onClearAll={onClearAll}
                onClose={onClose}
              />
            </Paper>
          </Fade>
        )}
      </Popper>
    </ClickAwayListener>
  );
}
