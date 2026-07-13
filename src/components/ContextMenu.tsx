import {
  Paper,
  MenuItem,
  MenuList,
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
  CloudQueue as ExternalNodeIcon,
  ChevronRight as ChevronRightIcon,
  SwapHoriz as SwapIcon,
  CallMerge as MergeIcon,
  CallSplit as UngroupIcon,
  ContentCopy as CopyIcon,
  ContentPaste as PasteIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
  TextFields as TextFieldsIcon,
  Category as ShapeIcon,
  InfoOutlined as InfoIcon,
  BookmarkAddOutlined as SaveTemplateIcon,
} from '@mui/icons-material';
import { useRef, useEffect, useState, type ReactNode } from 'react';

import type { NodeTemplate, SimNodeTemplate, LinkTemplate } from '../types/schema';
import type { UIAnnotationInput, AnnotationShapeType } from '../types/ui';
import { DEFAULT_ANNOTATION_COLOR, DEFAULT_ANNOTATION_FILL_COLOR, DEFAULT_TEXT_ANNOTATION_COLOR, DEFAULT_ANNOTATION_WIDTH, DEFAULT_ANNOTATION_HEIGHT } from '../lib/constants';

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
        <Paper elevation={8} sx={{ position: 'absolute', left: '100%', top: 0, minWidth: 140 }}>
          <MenuList dense disablePadding sx={{ py: 0.5 }}>
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
          </MenuList>
        </Paper>
      )}
    </Box>
  );
}

function ShapeSubmenu({
  onAddAnnotation,
  flowPosition,
  onClose,
}: {
  onAddAnnotation: (annotation: UIAnnotationInput) => void;
  flowPosition: { x: number; y: number };
  onClose: () => void;
}) {
  const [open, setOpen] = useState(false);

  const shapes: { label: string; shapeType: AnnotationShapeType }[] = [
    { label: 'Rectangle', shapeType: 'rectangle' },
    { label: 'Circle', shapeType: 'circle' },
  ];

  const handleAdd = (shapeType: AnnotationShapeType) => {
    onAddAnnotation({
      type: 'shape',
      shapeType,
      position: flowPosition,
      width: DEFAULT_ANNOTATION_WIDTH,
      height: DEFAULT_ANNOTATION_HEIGHT,
      strokeColor: DEFAULT_ANNOTATION_COLOR,
      fillColor: DEFAULT_ANNOTATION_FILL_COLOR,
      strokeWidth: 1,
      strokeStyle: 'solid',
    });
    onClose();
  };

  return (
    <Box
      onMouseEnter={() => { setOpen(true); }}
      onMouseLeave={() => { setOpen(false); }}
      sx={{ position: 'relative' }}
    >
      <MenuItem>
        <ListItemIcon><ShapeIcon fontSize="small" /></ListItemIcon>
        <ListItemText>Add Shape</ListItemText>
        <ChevronRightIcon fontSize="small" sx={SUBMENU_CHEVRON_SX} />
      </MenuItem>

      {open && (
        <Paper elevation={8} sx={{ position: 'absolute', left: '100%', top: 0, minWidth: 160 }}>
          <MenuList dense disablePadding sx={{ py: 0.5 }}>
            {shapes.map(s => (
              <MenuItem key={s.shapeType} onClick={() => { handleAdd(s.shapeType); }}>
                <ListItemText>{s.label}</ListItemText>
              </MenuItem>
            ))}
          </MenuList>
        </Paper>
      )}
    </Box>
  );
}

function ContextMenuNoSelectionItems({
  onClose,
  onAddNode,
  onAddSimNode,
  onAddExternalNode,
  onAddAnnotation,
  flowPosition,
}: {
  onClose: () => void;
  onAddNode: (templateName?: string) => void;
  onAddSimNode?: () => void;
  onAddExternalNode?: () => void;
  onAddAnnotation?: (annotation: UIAnnotationInput) => void;
  flowPosition: { x: number; y: number };
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

      {onAddExternalNode && (
        <MenuItem onClick={() => { onAddExternalNode(); onClose(); }}>
          <ListItemIcon><ExternalNodeIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Add External Node</ListItemText>
        </MenuItem>
      )}

      {onAddAnnotation && (
        <>
          <Divider />
          <MenuItem onClick={() => {
            onAddAnnotation({
              type: 'text',
              text: 'Label',
              fontSize: 14,
              fontColor: DEFAULT_TEXT_ANNOTATION_COLOR,
              position: flowPosition,
            });
            onClose();
          }}>
            <ListItemIcon><TextFieldsIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Add Text</ListItemText>
          </MenuItem>
          <ShapeSubmenu
            onAddAnnotation={onAddAnnotation}
            flowPosition={flowPosition}
            onClose={onClose}
          />
        </>
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
  onShowNodeDetails,
  onSaveNodeAsTemplate,
}: {
  onClose: () => void;
  onChangeNodeTemplate?: (templateName: string) => void;
  nodeTemplates: NodeTemplate[];
  currentNodeTemplate?: string;
  onDeleteNode?: () => void;
  onShowNodeDetails?: () => void;
  onSaveNodeAsTemplate?: () => void;
}) {
  return (
    <>
      {onShowNodeDetails && (
        <MenuItem data-testid="context-menu-node-details" onClick={() => { onShowNodeDetails(); onClose(); }}>
          <ListItemIcon><InfoIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Platform Details</ListItemText>
        </MenuItem>
      )}

      {onSaveNodeAsTemplate && (
        <MenuItem data-testid="context-menu-save-template" onClick={() => { onSaveNodeAsTemplate(); onClose(); }}>
          <ListItemIcon><SaveTemplateIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Save as Template</ListItemText>
        </MenuItem>
      )}

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
  memberLinkTotal = 0,
  ungroupedMemberCount = 0,
  isLagSelected = false,
  canCreateMultihomeLag = false,
  isMergeIntoMultihomeLag = false,
  isEsiLagSelected = false,
  onCreateLag,
  onGroupAllLinks,
  onUngroupLag,
  onCreateMultihomeLag,
  onUngroupEsiLag,
  onDeleteEdge,
  onDeleteAllLinks,
}: {
  onClose: () => void;
  onChangeLinkTemplate?: (templateName: string) => void;
  linkTemplates: LinkTemplate[];
  currentLinkTemplate?: string;
  selectedMemberLinkCount: number;
  memberLinkTotal?: number;
  ungroupedMemberCount?: number;
  isLagSelected?: boolean;
  canCreateMultihomeLag?: boolean;
  isMergeIntoMultihomeLag?: boolean;
  isEsiLagSelected?: boolean;
  onCreateLag?: () => void;
  onGroupAllLinks?: () => void;
  onUngroupLag?: () => void;
  onCreateMultihomeLag?: () => void;
  onUngroupEsiLag?: () => void;
  onDeleteEdge?: () => void;
  onDeleteAllLinks?: () => void;
}) {
  // A subset of a bundle is selected when fewer members are selected than the edge carries;
  // "Delete Link" then removes just those cables, with a separate item for the whole bundle.
  const partialSelection = selectedMemberLinkCount > 0 && memberLinkTotal > selectedMemberLinkCount;
  const showCreateFromSelection = selectedMemberLinkCount >= 2 && onCreateLag !== undefined;
  // One click groups every ungrouped link of the bundle — no shift-selecting members first.
  const showGroupAll = !showCreateFromSelection && !isLagSelected
    && ungroupedMemberCount >= 2 && onGroupAllLinks !== undefined;
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

      {showCreateFromSelection && (
        <>
          <MenuItem onClick={() => { onCreateLag(); onClose(); }}>
            <ListItemIcon><MergeIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Create Local LAG</ListItemText>
          </MenuItem>
          <Divider />
        </>
      )}
      {showGroupAll && (
        <>
          <MenuItem data-testid="context-menu-group-lag" onClick={() => { onGroupAllLinks(); onClose(); }}>
            <ListItemIcon><MergeIcon fontSize="small" /></ListItemIcon>
            <ListItemText>{`Group ${ungroupedMemberCount} Links into LAG`}</ListItemText>
          </MenuItem>
          <Divider />
        </>
      )}
      {isLagSelected && onUngroupLag && (
        <>
          <MenuItem data-testid="context-menu-ungroup-lag" onClick={() => { onUngroupLag(); onClose(); }}>
            <ListItemIcon><UngroupIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Ungroup LAG</ListItemText>
          </MenuItem>
          <Divider />
        </>
      )}
      {canCreateMultihomeLag && onCreateMultihomeLag && (
        <>
          <MenuItem data-testid="context-menu-multihome-lag" onClick={() => { onCreateMultihomeLag(); onClose(); }}>
            <ListItemIcon><MergeIcon fontSize="small" /></ListItemIcon>
            <ListItemText>{isMergeIntoMultihomeLag ? 'Merge into Multihome LAG' : 'Create Multihome LAG (ESI)'}</ListItemText>
          </MenuItem>
          <Divider />
        </>
      )}
      {isEsiLagSelected && onUngroupEsiLag && (
        <>
          <MenuItem data-testid="context-menu-ungroup-multihome-lag" onClick={() => { onUngroupEsiLag(); onClose(); }}>
            <ListItemIcon><UngroupIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Ungroup Multihome LAG</ListItemText>
          </MenuItem>
          <Divider />
        </>
      )}

      {onDeleteEdge && (
        <MenuItem onClick={() => { onDeleteEdge(); onClose(); }}>
          <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
          <ListItemText>{selectedMemberLinkCount > 1 ? `Delete Links (${selectedMemberLinkCount})` : 'Delete Link'}</ListItemText>
        </MenuItem>
      )}
      {partialSelection && onDeleteAllLinks && (
        <MenuItem onClick={() => { onDeleteAllLinks(); onClose(); }}>
          <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
          <ListItemText>{`Delete All Links (${memberLinkTotal})`}</ListItemText>
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
  onAddExternalNode,
  onDeleteNode,
  onShowNodeDetails,
  onSaveNodeAsTemplate,
  onDeleteSimNode,
  onDeleteEdge,
  onDeleteAnnotation,
  onChangeNodeTemplate,
  onChangeSimNodeTemplate,
  onChangeLinkTemplate,
  onCreateLag,
  onCreateEsiLag,
  onAddAnnotation,
  nodeTemplates,
  currentNodeTemplate,
  simNodeTemplates,
  currentSimNodeTemplate,
  linkTemplates,
  currentLinkTemplate,
  selectedMemberLinkCount,
  memberLinkTotal,
  ungroupedMemberCount,
  isLagSelected,
  onGroupAllLinks,
  onUngroupLag,
  canCreateMultihomeLag,
  isMergeIntoMultihomeLag,
  onCreateMultihomeLag,
  isEsiLagSelected,
  onUngroupEsiLag,
  onDeleteAllLinks,
  canCreateEsiLag,
  isMergeIntoEsiLag,
  contextMenuFlowPosition,
}: {
  hasSelection: 'node' | 'edge' | 'simNode' | 'external' | 'multiEdge' | 'annotation' | null;
  onClose: () => void;
  onAddNode: (templateName?: string) => void;
  onAddSimNode?: () => void;
  onAddExternalNode?: () => void;
  onDeleteNode?: () => void;
  onShowNodeDetails?: () => void;
  onSaveNodeAsTemplate?: () => void;
  onDeleteSimNode?: () => void;
  onDeleteEdge?: () => void;
  onDeleteAnnotation?: () => void;
  onChangeNodeTemplate?: (templateName: string) => void;
  onChangeSimNodeTemplate?: (templateName: string) => void;
  onChangeLinkTemplate?: (templateName: string) => void;
  onCreateLag?: () => void;
  onCreateEsiLag?: () => void;
  onAddAnnotation?: (annotation: UIAnnotationInput) => void;
  nodeTemplates: NodeTemplate[];
  currentNodeTemplate?: string;
  simNodeTemplates: SimNodeTemplate[];
  currentSimNodeTemplate?: string;
  linkTemplates: LinkTemplate[];
  currentLinkTemplate?: string;
  selectedMemberLinkCount: number;
  memberLinkTotal?: number;
  ungroupedMemberCount?: number;
  isLagSelected?: boolean;
  onGroupAllLinks?: () => void;
  onUngroupLag?: () => void;
  canCreateMultihomeLag?: boolean;
  isMergeIntoMultihomeLag?: boolean;
  onCreateMultihomeLag?: () => void;
  isEsiLagSelected?: boolean;
  onUngroupEsiLag?: () => void;
  onDeleteAllLinks?: () => void;
  canCreateEsiLag: boolean;
  isMergeIntoEsiLag: boolean;
  contextMenuFlowPosition: { x: number; y: number };
}) {
  switch (hasSelection) {
    case null:
      return (
        <ContextMenuNoSelectionItems
          onClose={onClose}
          onAddNode={onAddNode}
          onAddSimNode={onAddSimNode}
          onAddExternalNode={onAddExternalNode}
          onAddAnnotation={onAddAnnotation}
          flowPosition={contextMenuFlowPosition}
        />
      );
    case 'annotation':
      return (
        <>
          {onDeleteAnnotation && (
            <MenuItem onClick={() => { onDeleteAnnotation(); onClose(); }}>
              <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
              <ListItemText>Delete Annotation</ListItemText>
            </MenuItem>
          )}
        </>
      );
    case 'node':
      return (
        <ContextMenuNodeSelectionItems
          onClose={onClose}
          onChangeNodeTemplate={onChangeNodeTemplate}
          nodeTemplates={nodeTemplates}
          currentNodeTemplate={currentNodeTemplate}
          onDeleteNode={onDeleteNode}
          onShowNodeDetails={onShowNodeDetails}
          onSaveNodeAsTemplate={onSaveNodeAsTemplate}
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
    case 'external':
      return (
        <>
          {onDeleteNode && (
            <MenuItem onClick={() => { onDeleteNode(); onClose(); }}>
              <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
              <ListItemText>Delete External Node</ListItemText>
            </MenuItem>
          )}
        </>
      );
    case 'edge':
      return (
        <ContextMenuEdgeSelectionItems
          onClose={onClose}
          onChangeLinkTemplate={onChangeLinkTemplate}
          linkTemplates={linkTemplates}
          currentLinkTemplate={currentLinkTemplate}
          selectedMemberLinkCount={selectedMemberLinkCount}
          memberLinkTotal={memberLinkTotal}
          ungroupedMemberCount={ungroupedMemberCount}
          isLagSelected={isLagSelected}
          canCreateMultihomeLag={canCreateMultihomeLag}
          isMergeIntoMultihomeLag={isMergeIntoMultihomeLag}
          isEsiLagSelected={isEsiLagSelected}
          onCreateLag={onCreateLag}
          onGroupAllLinks={onGroupAllLinks}
          onUngroupLag={onUngroupLag}
          onCreateMultihomeLag={onCreateMultihomeLag}
          onUngroupEsiLag={onUngroupEsiLag}
          onDeleteEdge={onDeleteEdge}
          onDeleteAllLinks={onDeleteAllLinks}
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
  onAddExternalNode?: () => void;
  onDeleteNode?: () => void;
  onShowNodeDetails?: () => void;
  onSaveNodeAsTemplate?: () => void;
  onDeleteEdge?: () => void;
  onDeleteSimNode?: () => void;
  onDeleteAnnotation?: () => void;
  onChangeNodeTemplate?: (templateName: string) => void;
  onChangeSimNodeTemplate?: (templateName: string) => void;
  onChangeLinkTemplate?: (templateName: string) => void;
  onCreateLag?: () => void;
  onCreateEsiLag?: () => void;
  onAddAnnotation?: (annotation: UIAnnotationInput) => void;
  onCopy?: () => void;
  onPaste?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onClearAll: () => void;
  hasSelection: 'node' | 'edge' | 'simNode' | 'external' | 'multiEdge' | 'annotation' | null;
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
  memberLinkTotal?: number;
  ungroupedMemberCount?: number;
  isLagSelected?: boolean;
  onGroupAllLinks?: () => void;
  onUngroupLag?: () => void;
  canCreateMultihomeLag?: boolean;
  isMergeIntoMultihomeLag?: boolean;
  onCreateMultihomeLag?: () => void;
  isEsiLagSelected?: boolean;
  onUngroupEsiLag?: () => void;
  onDeleteAllLinks?: () => void;
  canCreateEsiLag?: boolean;
  isMergeIntoEsiLag?: boolean;
  contextMenuFlowPosition?: { x: number; y: number };
}

export default function ContextMenu({
  open,
  position,
  onClose,
  onAddNode,
  onAddSimNode,
  onAddExternalNode,
  onDeleteNode,
  onShowNodeDetails,
  onSaveNodeAsTemplate,
  onDeleteEdge,
  onDeleteSimNode,
  onDeleteAnnotation,
  onChangeNodeTemplate,
  onChangeSimNodeTemplate,
  onChangeLinkTemplate,
  onCreateLag,
  onCreateEsiLag,
  onAddAnnotation,
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
  memberLinkTotal = 0,
  ungroupedMemberCount = 0,
  isLagSelected = false,
  onGroupAllLinks,
  onUngroupLag,
  canCreateMultihomeLag = false,
  isMergeIntoMultihomeLag = false,
  onCreateMultihomeLag,
  isEsiLagSelected = false,
  onUngroupEsiLag,
  onDeleteAllLinks,
  canCreateEsiLag = false,
  isMergeIntoEsiLag = false,
  contextMenuFlowPosition = { x: 0, y: 0 },
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
            <Paper ref={paperRef} elevation={8} onContextMenu={e => { e.preventDefault(); }} sx={{ minWidth: 180 }}>
              <MenuList dense disablePadding sx={{ py: 0.5 }}>
                <ContextMenuSelectionSection
                  hasSelection={hasSelection}
                  onClose={onClose}
                  onAddNode={onAddNode}
                  onAddSimNode={onAddSimNode}
                  onAddExternalNode={onAddExternalNode}
                  onDeleteNode={onDeleteNode}
                  onShowNodeDetails={onShowNodeDetails}
                  onSaveNodeAsTemplate={onSaveNodeAsTemplate}
                  onDeleteSimNode={onDeleteSimNode}
                  onDeleteEdge={onDeleteEdge}
                  onDeleteAnnotation={onDeleteAnnotation}
                  onChangeNodeTemplate={onChangeNodeTemplate}
                  onChangeSimNodeTemplate={onChangeSimNodeTemplate}
                  onChangeLinkTemplate={onChangeLinkTemplate}
                  onCreateLag={onCreateLag}
                  onCreateEsiLag={onCreateEsiLag}
                  onAddAnnotation={onAddAnnotation}
                  nodeTemplates={nodeTemplates}
                  currentNodeTemplate={currentNodeTemplate}
                  simNodeTemplates={simNodeTemplates}
                  currentSimNodeTemplate={currentSimNodeTemplate}
                  linkTemplates={linkTemplates}
                  currentLinkTemplate={currentLinkTemplate}
                  selectedMemberLinkCount={selectedMemberLinkCount}
                  memberLinkTotal={memberLinkTotal}
                  ungroupedMemberCount={ungroupedMemberCount}
                  isLagSelected={isLagSelected}
                  onGroupAllLinks={onGroupAllLinks}
                  onUngroupLag={onUngroupLag}
                  canCreateMultihomeLag={canCreateMultihomeLag}
                  isMergeIntoMultihomeLag={isMergeIntoMultihomeLag}
                  onCreateMultihomeLag={onCreateMultihomeLag}
                  isEsiLagSelected={isEsiLagSelected}
                  onUngroupEsiLag={onUngroupEsiLag}
                  onDeleteAllLinks={onDeleteAllLinks}
                  canCreateEsiLag={canCreateEsiLag}
                  isMergeIntoEsiLag={isMergeIntoEsiLag}
                  contextMenuFlowPosition={contextMenuFlowPosition}
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
              </MenuList>
            </Paper>
          </Fade>
        )}
      </Popper>
    </ClickAwayListener>
  );
}
