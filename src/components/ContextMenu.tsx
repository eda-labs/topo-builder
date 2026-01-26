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
} from '@mui/icons-material';
import { useRef, useEffect, useState } from 'react';
import type { NodeTemplate, SimNodeTemplate } from '../types/topology';

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
  onCreateLag?: () => void;
  onCreateEsiLag?: () => void;
  onClearAll: () => void;
  hasSelection: 'node' | 'edge' | 'simNode' | 'multiEdge' | null;
  hasContent: boolean;
  nodeTemplates?: NodeTemplate[];
  currentNodeTemplate?: string;
  simNodeTemplates?: SimNodeTemplate[];
  currentSimNodeTemplate?: string;
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
  onCreateLag,
  onCreateEsiLag,
  onClearAll,
  hasSelection,
  hasContent,
  nodeTemplates = [],
  currentNodeTemplate,
  simNodeTemplates = [],
  currentSimNodeTemplate,
  selectedMemberLinkCount = 0,
  canCreateEsiLag = false,
  isMergeIntoEsiLag = false,
}: ContextMenuProps) {
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const [showSubmenu, setShowSubmenu] = useState(false);

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

  const hasTemplates = nodeTemplates.length > 0;
  const hasSimTemplates = simNodeTemplates.length > 0;

  return (
    <ClickAwayListener onClickAway={onClose} mouseEvent="onMouseDown">
      <Popper open={open} anchorEl={anchorRef.current} placement="bottom-start" className="z-1300" transition>
        {({ TransitionProps }) => (
          <Fade {...TransitionProps} timeout={200}>
            <Paper elevation={8} onContextMenu={e => e.preventDefault()} sx={{ py: 0.5, minWidth: 180 }}>
              {!hasSelection && (
                <MenuItem onClick={() => { onAddNode(); onClose(); }}>
                  <ListItemIcon><AddIcon fontSize="small" /></ListItemIcon>
                  <ListItemText>Add Node</ListItemText>
                </MenuItem>
              )}

              {!hasSelection && onAddSimNode && (
                <MenuItem onClick={() => { onAddSimNode(); onClose(); }}>
                  <ListItemIcon><SimNodeIcon fontSize="small" /></ListItemIcon>
                  <ListItemText>Add SimNode</ListItemText>
                </MenuItem>
              )}

              {hasSelection === 'node' && hasTemplates && onChangeNodeTemplate && (
                <Box
                  onMouseEnter={() => setShowSubmenu(true)}
                  onMouseLeave={() => setShowSubmenu(false)}
                  sx={{ position: 'relative' }}
                >
                  <MenuItem>
                    <ListItemIcon><SwapIcon fontSize="small" /></ListItemIcon>
                    <ListItemText>Change Template</ListItemText>
                    <ChevronRightIcon fontSize="small" sx={{ ml: 1, color: 'text.secondary' }} />
                  </MenuItem>

                  {showSubmenu && (
                    <Paper elevation={8} sx={{ position: 'absolute', left: '100%', top: 0, py: 0.5, minWidth: 140 }}>
                      {nodeTemplates.map(template => (
                        <MenuItem
                          key={template.name}
                          disabled={template.name === currentNodeTemplate}
                          onClick={() => { onChangeNodeTemplate(template.name); onClose(); }}
                          sx={{ opacity: template.name === currentNodeTemplate ? 0.5 : 1 }}
                        >
                          <ListItemText>{template.name}</ListItemText>
                        </MenuItem>
                      ))}
                    </Paper>
                  )}
                </Box>
              )}

              {hasSelection === 'simNode' && hasSimTemplates && onChangeSimNodeTemplate && (
                <Box
                  onMouseEnter={() => setShowSubmenu(true)}
                  onMouseLeave={() => setShowSubmenu(false)}
                  sx={{ position: 'relative' }}
                >
                  <MenuItem>
                    <ListItemIcon><SwapIcon fontSize="small" /></ListItemIcon>
                    <ListItemText>Change Template</ListItemText>
                    <ChevronRightIcon fontSize="small" sx={{ ml: 1, color: 'text.secondary' }} />
                  </MenuItem>

                  {showSubmenu && (
                    <Paper elevation={8} sx={{ position: 'absolute', left: '100%', top: 0, py: 0.5, minWidth: 140 }}>
                      {simNodeTemplates.map(template => (
                        <MenuItem
                          key={template.name}
                          disabled={template.name === currentSimNodeTemplate}
                          onClick={() => { onChangeSimNodeTemplate(template.name); onClose(); }}
                          sx={{ opacity: template.name === currentSimNodeTemplate ? 0.5 : 1 }}
                        >
                          <ListItemText>{template.name}</ListItemText>
                        </MenuItem>
                      ))}
                    </Paper>
                  )}
                </Box>
              )}

              {(hasSelection === 'node' || hasSelection === 'simNode') && (onDeleteNode || onDeleteSimNode) && (
                <MenuItem onClick={() => {
                  if (hasSelection === 'node') onDeleteNode?.();
                  else if (hasSelection === 'simNode') onDeleteSimNode?.();
                  onClose();
                }}>
                  <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
                  <ListItemText>Delete Node</ListItemText>
                </MenuItem>
              )}

              {hasSelection === 'edge' && selectedMemberLinkCount >= 2 && onCreateLag && (
                <>
                  <MenuItem onClick={() => { onCreateLag(); onClose(); }}>
                    <ListItemIcon><MergeIcon fontSize="small" /></ListItemIcon>
                    <ListItemText>Create Local LAG</ListItemText>
                  </MenuItem>
                  <Divider />
                </>
              )}

              {hasSelection === 'multiEdge' && canCreateEsiLag && onCreateEsiLag && (
                <>
                  <MenuItem onClick={() => { onCreateEsiLag(); onClose(); }}>
                    <ListItemIcon><MergeIcon fontSize="small" /></ListItemIcon>
                    <ListItemText>{isMergeIntoEsiLag ? 'Merge into ESI-LAG' : 'Create ESI-LAG'}</ListItemText>
                  </MenuItem>
                  <Divider />
                </>
              )}

              {(hasSelection === 'edge' || hasSelection === 'multiEdge') && onDeleteEdge && (
                <MenuItem onClick={() => { onDeleteEdge(); onClose(); }}>
                  <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
                  <ListItemText>Delete Link{hasSelection === 'multiEdge' ? 's' : ''}</ListItemText>
                </MenuItem>
              )}

              {hasContent && (
                <>
                  <Divider />
                  <MenuItem onClick={() => { onClearAll(); onClose(); }}>
                    <ListItemIcon><ClearAllIcon fontSize="small" color="error" /></ListItemIcon>
                    <ListItemText>Clear All</ListItemText>
                  </MenuItem>
                </>
              )}
            </Paper>
          </Fade>
        )}
      </Popper>
    </ClickAwayListener>
  );
}
