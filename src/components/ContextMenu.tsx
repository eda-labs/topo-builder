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
import { useRef, useEffect, useState } from 'react';

import type { NodeTemplate, SimNodeTemplate, LinkTemplate } from '../types/topology';

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

function AddNodeItems({
  hasSelection,
  onAddNode,
  onAddSimNode,
  onClose,
}: Readonly<{
  hasSelection: ContextMenuProps["hasSelection"];
  onAddNode: ContextMenuProps["onAddNode"];
  onAddSimNode?: ContextMenuProps["onAddSimNode"];
  onClose: ContextMenuProps["onClose"];
}>) {
  if (hasSelection) return null;
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

function TemplateSubmenu({
  templates,
  currentTemplate,
  onChangeTemplate,
  showSubmenu,
  setShowSubmenu,
  onClose,
}: Readonly<{
  templates: NodeTemplate[] | SimNodeTemplate[] | LinkTemplate[];
  currentTemplate?: string;
  onChangeTemplate: (templateName: string) => void;
  showSubmenu: boolean;
  setShowSubmenu: (show: boolean) => void;
  onClose: ContextMenuProps["onClose"];
}>) {
  if (templates.length === 0) return null;
  return (
    <Box
      onMouseEnter={() => setShowSubmenu(true)}
      onMouseLeave={() => setShowSubmenu(false)}
      sx={{ position: 'relative' }}
    >
      <MenuItem>
        <ListItemIcon><SwapIcon fontSize="small" /></ListItemIcon>
        <ListItemText>Template</ListItemText>
        <ChevronRightIcon fontSize="small" sx={{ ml: 1, color: 'text.secondary' }} />
      </MenuItem>

      {showSubmenu && (
        <Paper elevation={8} sx={{ position: 'absolute', left: '100%', top: 0, py: 0.5, minWidth: 140 }}>
          {templates.map(template => (
            <MenuItem
              key={template.name}
              disabled={template.name === currentTemplate}
              onClick={() => { onChangeTemplate(template.name); onClose(); }}
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

function TemplateMenu({
  hasSelection,
  templates,
  currentTemplate,
  onChangeTemplate,
  showSubmenu,
  setShowSubmenu,
  onClose,
}: Readonly<{
  hasSelection: ContextMenuProps["hasSelection"];
  templates: NodeTemplate[] | SimNodeTemplate[] | LinkTemplate[];
  currentTemplate?: string;
  onChangeTemplate?: (templateName: string) => void;
  showSubmenu: boolean;
  setShowSubmenu: (show: boolean) => void;
  onClose: ContextMenuProps["onClose"];
}>) {
  if (!hasSelection || !onChangeTemplate) return null;
  return (
    <TemplateSubmenu
      templates={templates}
      currentTemplate={currentTemplate}
      onChangeTemplate={onChangeTemplate}
      showSubmenu={showSubmenu}
      setShowSubmenu={setShowSubmenu}
      onClose={onClose}
    />
  );
}

function DeleteNodeItem({
  hasSelection,
  onDeleteNode,
  onDeleteSimNode,
  onClose,
}: Readonly<{
  hasSelection: ContextMenuProps["hasSelection"];
  onDeleteNode?: ContextMenuProps["onDeleteNode"];
  onDeleteSimNode?: ContextMenuProps["onDeleteSimNode"];
  onClose: ContextMenuProps["onClose"];
}>) {
  if (!(hasSelection === 'node' || hasSelection === 'simNode')) return null;
  if (!onDeleteNode && !onDeleteSimNode) return null;
  return (
    <MenuItem onClick={() => {
      if (hasSelection === 'node') onDeleteNode?.();
      else onDeleteSimNode?.();
      onClose();
    }}>
      <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
      <ListItemText>Delete Node</ListItemText>
    </MenuItem>
  );
}

function LagItems({
  hasSelection,
  selectedMemberLinkCount,
  onCreateLag,
  onClose,
}: Readonly<{
  hasSelection: ContextMenuProps["hasSelection"];
  selectedMemberLinkCount: number;
  onCreateLag?: ContextMenuProps["onCreateLag"];
  onClose: ContextMenuProps["onClose"];
}>) {
  if (hasSelection !== 'edge') return null;
  if (!onCreateLag || selectedMemberLinkCount < 2) return null;
  return (
    <>
      <MenuItem onClick={() => { onCreateLag(); onClose(); }}>
        <ListItemIcon><MergeIcon fontSize="small" /></ListItemIcon>
        <ListItemText>Create Local LAG</ListItemText>
      </MenuItem>
      <Divider />
    </>
  );
}

function EsiLagItems({
  hasSelection,
  canCreateEsiLag,
  isMergeIntoEsiLag,
  onCreateEsiLag,
  onClose,
}: Readonly<{
  hasSelection: ContextMenuProps["hasSelection"];
  canCreateEsiLag: boolean;
  isMergeIntoEsiLag: boolean;
  onCreateEsiLag?: ContextMenuProps["onCreateEsiLag"];
  onClose: ContextMenuProps["onClose"];
}>) {
  if (hasSelection !== 'multiEdge') return null;
  if (!canCreateEsiLag || !onCreateEsiLag) return null;
  return (
    <>
      <MenuItem onClick={() => { onCreateEsiLag(); onClose(); }}>
        <ListItemIcon><MergeIcon fontSize="small" /></ListItemIcon>
        <ListItemText>{isMergeIntoEsiLag ? 'Merge into ESI-LAG' : 'Create ESI-LAG'}</ListItemText>
      </MenuItem>
      <Divider />
    </>
  );
}

function DeleteEdgeItem({
  hasSelection,
  onDeleteEdge,
  onClose,
}: Readonly<{
  hasSelection: ContextMenuProps["hasSelection"];
  onDeleteEdge?: ContextMenuProps["onDeleteEdge"];
  onClose: ContextMenuProps["onClose"];
}>) {
  if (!(hasSelection === 'edge' || hasSelection === 'multiEdge')) return null;
  if (!onDeleteEdge) return null;
  return (
    <MenuItem onClick={() => { onDeleteEdge(); onClose(); }}>
      <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
      <ListItemText>Delete Link{hasSelection === 'multiEdge' ? 's' : ''}</ListItemText>
    </MenuItem>
  );
}

function CopyPasteItems({
  canCopy,
  canPaste,
  onCopy,
  onPaste,
  onClose,
}: Readonly<{
  canCopy: boolean;
  canPaste: boolean;
  onCopy?: ContextMenuProps["onCopy"];
  onPaste?: ContextMenuProps["onPaste"];
  onClose: ContextMenuProps["onClose"];
}>) {
  if (!canCopy && !canPaste) return null;
  return (
    <>
      <Divider />
      {canCopy && onCopy && (
        <MenuItem onClick={() => { onCopy(); onClose(); }}>
          <ListItemIcon><CopyIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Copy</ListItemText>
        </MenuItem>
      )}
      {canPaste && onPaste && (
        <MenuItem onClick={() => { onPaste(); onClose(); }}>
          <ListItemIcon><PasteIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Paste</ListItemText>
        </MenuItem>
      )}
    </>
  );
}

function UndoRedoItems({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onClose,
}: Readonly<{
  canUndo: boolean;
  canRedo: boolean;
  onUndo?: ContextMenuProps["onUndo"];
  onRedo?: ContextMenuProps["onRedo"];
  onClose: ContextMenuProps["onClose"];
}>) {
  if (!canUndo && !canRedo) return null;
  return (
    <>
      <Divider />
      {onUndo && (
        <MenuItem disabled={!canUndo} onClick={() => { onUndo(); onClose(); }}>
          <ListItemIcon><UndoIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Undo</ListItemText>
        </MenuItem>
      )}
      {onRedo && (
        <MenuItem disabled={!canRedo} onClick={() => { onRedo(); onClose(); }}>
          <ListItemIcon><RedoIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Redo</ListItemText>
        </MenuItem>
      )}
    </>
  );
}

function ClearAllItem({
  hasContent,
  onClearAll,
  onClose,
}: Readonly<{
  hasContent: boolean;
  onClearAll: ContextMenuProps["onClearAll"];
  onClose: ContextMenuProps["onClose"];
}>) {
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

function ContextMenuBody({
  hasSelection,
  hasContent,
  canCopy,
  canPaste,
  canUndo,
  canRedo,
  nodeTemplates,
  simNodeTemplates,
  linkTemplates,
  currentNodeTemplate,
  currentSimNodeTemplate,
  currentLinkTemplate,
  selectedMemberLinkCount,
  canCreateEsiLag,
  isMergeIntoEsiLag,
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
  onCopy,
  onPaste,
  onUndo,
  onRedo,
  onClearAll,
  onClose,
  showSubmenu,
  setShowSubmenu,
}: Readonly<{
  hasSelection: ContextMenuProps["hasSelection"];
  hasContent: boolean;
  canCopy: boolean;
  canPaste: boolean;
  canUndo: boolean;
  canRedo: boolean;
  nodeTemplates: NodeTemplate[];
  simNodeTemplates: SimNodeTemplate[];
  linkTemplates: LinkTemplate[];
  currentNodeTemplate?: string;
  currentSimNodeTemplate?: string;
  currentLinkTemplate?: string;
  selectedMemberLinkCount: number;
  canCreateEsiLag: boolean;
  isMergeIntoEsiLag: boolean;
  onAddNode: ContextMenuProps["onAddNode"];
  onAddSimNode?: ContextMenuProps["onAddSimNode"];
  onDeleteNode?: ContextMenuProps["onDeleteNode"];
  onDeleteSimNode?: ContextMenuProps["onDeleteSimNode"];
  onDeleteEdge?: ContextMenuProps["onDeleteEdge"];
  onChangeNodeTemplate?: ContextMenuProps["onChangeNodeTemplate"];
  onChangeSimNodeTemplate?: ContextMenuProps["onChangeSimNodeTemplate"];
  onChangeLinkTemplate?: ContextMenuProps["onChangeLinkTemplate"];
  onCreateLag?: ContextMenuProps["onCreateLag"];
  onCreateEsiLag?: ContextMenuProps["onCreateEsiLag"];
  onCopy?: ContextMenuProps["onCopy"];
  onPaste?: ContextMenuProps["onPaste"];
  onUndo?: ContextMenuProps["onUndo"];
  onRedo?: ContextMenuProps["onRedo"];
  onClearAll: ContextMenuProps["onClearAll"];
  onClose: ContextMenuProps["onClose"];
  showSubmenu: boolean;
  setShowSubmenu: (show: boolean) => void;
}>) {
  return (
    <>
      <AddNodeItems
        hasSelection={hasSelection}
        onAddNode={onAddNode}
        onAddSimNode={onAddSimNode}
        onClose={onClose}
      />
      {hasSelection === 'node' && (
        <TemplateMenu
          hasSelection={hasSelection}
          templates={nodeTemplates}
          currentTemplate={currentNodeTemplate}
          onChangeTemplate={onChangeNodeTemplate}
          showSubmenu={showSubmenu}
          setShowSubmenu={setShowSubmenu}
          onClose={onClose}
        />
      )}
      {hasSelection === 'simNode' && (
        <TemplateMenu
          hasSelection={hasSelection}
          templates={simNodeTemplates}
          currentTemplate={currentSimNodeTemplate}
          onChangeTemplate={onChangeSimNodeTemplate}
          showSubmenu={showSubmenu}
          setShowSubmenu={setShowSubmenu}
          onClose={onClose}
        />
      )}
      <DeleteNodeItem
        hasSelection={hasSelection}
        onDeleteNode={onDeleteNode}
        onDeleteSimNode={onDeleteSimNode}
        onClose={onClose}
      />
      {hasSelection === 'edge' && (
        <TemplateMenu
          hasSelection={hasSelection}
          templates={linkTemplates}
          currentTemplate={currentLinkTemplate}
          onChangeTemplate={onChangeLinkTemplate}
          showSubmenu={showSubmenu}
          setShowSubmenu={setShowSubmenu}
          onClose={onClose}
        />
      )}
      <LagItems
        hasSelection={hasSelection}
        selectedMemberLinkCount={selectedMemberLinkCount}
        onCreateLag={onCreateLag}
        onClose={onClose}
      />
      <EsiLagItems
        hasSelection={hasSelection}
        canCreateEsiLag={canCreateEsiLag}
        isMergeIntoEsiLag={isMergeIntoEsiLag}
        onCreateEsiLag={onCreateEsiLag}
        onClose={onClose}
      />
      <DeleteEdgeItem
        hasSelection={hasSelection}
        onDeleteEdge={onDeleteEdge}
        onClose={onClose}
      />
      <CopyPasteItems
        canCopy={canCopy}
        canPaste={canPaste}
        onCopy={onCopy}
        onPaste={onPaste}
        onClose={onClose}
      />
      <UndoRedoItems
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={onUndo}
        onRedo={onRedo}
        onClose={onClose}
      />
      <ClearAllItem
        hasContent={hasContent}
        onClearAll={onClearAll}
        onClose={onClose}
      />
    </>
  );
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
}: Readonly<ContextMenuProps>) {
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const paperRef = useRef<HTMLDivElement | null>(null);
  const [showSubmenu, setShowSubmenu] = useState(false);

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

  useEffect(() => {
    if (!open) setShowSubmenu(false);
  }, [open]);

  if (!open) return null;

  return (
    <ClickAwayListener onClickAway={onClose} mouseEvent="onMouseDown">
      <Popper open={open} anchorEl={anchorRef.current} placement="bottom-start" className="z-1300" transition>
        {({ TransitionProps }) => (
          <Fade {...TransitionProps} timeout={200}>
            <Paper ref={paperRef} elevation={8} onContextMenu={e => e.preventDefault()} sx={{ py: 0.5, minWidth: 180 }}>
              <ContextMenuBody
                hasSelection={hasSelection}
                hasContent={hasContent}
                canCopy={canCopy}
                canPaste={canPaste}
                canUndo={canUndo}
                canRedo={canRedo}
                nodeTemplates={nodeTemplates}
                simNodeTemplates={simNodeTemplates}
                linkTemplates={linkTemplates}
                currentNodeTemplate={currentNodeTemplate}
                currentSimNodeTemplate={currentSimNodeTemplate}
                currentLinkTemplate={currentLinkTemplate}
                selectedMemberLinkCount={selectedMemberLinkCount}
                canCreateEsiLag={canCreateEsiLag}
                isMergeIntoEsiLag={isMergeIntoEsiLag}
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
                onCopy={onCopy}
                onPaste={onPaste}
                onUndo={onUndo}
                onRedo={onRedo}
                onClearAll={onClearAll}
                onClose={onClose}
                showSubmenu={showSubmenu}
                setShowSubmenu={setShowSubmenu}
              />
            </Paper>
          </Fade>
        )}
      </Popper>
    </ClickAwayListener>
  );
}
