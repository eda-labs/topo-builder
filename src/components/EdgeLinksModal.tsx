import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Box,
  Tooltip,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';

import { getUsedInterfacesForNode, getDefaultEdgeTemplate } from '../lib/utils';
import { generateInterface } from '../lib/interfaces';
import { useTopologyStore } from '../lib/store';
import { collectEdgeLinkCables, type EdgeLinkCable } from '../lib/store/externals';

interface EdgeLinksModalProps {
  open: boolean;
  onClose: () => void;
  nodeName: string;
  nodeId: string;
}

const COLUMN_HEADER_SX = { color: 'text.secondary', fontWeight: 700, letterSpacing: 0.5 } as const;

/**
 * Editor for a node's edge links. Each edge link is a member link on a cable to an external
 * node; adding one cables the node to its external peer (created on first use).
 */
export default function EdgeLinksModal({
  open,
  onClose,
  nodeName,
  nodeId,
}: EdgeLinksModalProps) {
  const edges = useTopologyStore(state => state.edges);
  const nodes = useTopologyStore(state => state.nodes);
  const nodeTemplates = useTopologyStore(state => state.nodeTemplates);
  const linkTemplates = useTopologyStore(state => state.linkTemplates);
  const addEdgeLinkCable = useTopologyStore(state => state.addEdgeLinkCable);
  const updateMemberLink = useTopologyStore(state => state.updateMemberLink);
  const deleteMemberLink = useTopologyStore(state => state.deleteMemberLink);
  const triggerYamlRefresh = useTopologyStore(state => state.triggerYamlRefresh);

  const edgeTemplates = linkTemplates.filter(t => t.type === 'Edge');
  const cables = useMemo(() => collectEdgeLinkCables(edges, nodeId), [edges, nodeId]);

  const [newInterface, setNewInterface] = useState('');
  const [newTemplate, setNewTemplate] = useState('');

  // Every interface in use on this node — cabled ports and edge links alike.
  const interfaceUseCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const iface of getUsedInterfacesForNode([], edges, nodeId)) {
      counts.set(iface, (counts.get(iface) ?? 0) + 1);
    }
    return counts;
  }, [edges, nodeId]);

  const trimmedNew = newInterface.trim();
  const newInterfaceError = trimmedNew && interfaceUseCounts.has(trimmedNew)
    ? 'Interface already in use on this node'
    : null;

  const rowInterfaceError = (cable: EdgeLinkCable): string | null => {
    if (!cable.interface.trim()) return 'Interface is required';
    if ((interfaceUseCounts.get(cable.interface) ?? 0) > 1) return 'Interface already in use on this node';
    return null;
  };

  const getNextInterface = () => {
    const node = nodes.find(n => n.id === nodeId);
    return generateInterface(node, nodeTemplates, getUsedInterfacesForNode([], edges, nodeId));
  };

  useEffect(() => {
    if (open) {
      setNewInterface(getNextInterface());
      setNewTemplate(getDefaultEdgeTemplate(cables, linkTemplates));
    }
  }, [open, cables, linkTemplates, edges, nodeId, nodes, nodeTemplates]);

  const handleAdd = () => {
    if (!trimmedNew || newInterfaceError) return;
    addEdgeLinkCable(nodeId, trimmedNew, newTemplate || undefined);
  };

  const handleUpdateInterface = (cable: EdgeLinkCable, value: string) => {
    const edge = edges.find(e => e.id === cable.edgeId);
    if (!edge) return;
    const side = edge.source === nodeId ? 'sourceInterface' : 'targetInterface';
    updateMemberLink(cable.edgeId, cable.memberIndex, { [side]: value, name: `${nodeName}-${value}` });
    triggerYamlRefresh();
  };

  const handleUpdateTemplate = (cable: EdgeLinkCable, value: string) => {
    updateMemberLink(cable.edgeId, cable.memberIndex, { template: value });
    triggerYamlRefresh();
  };

  const handleDelete = (cable: EdgeLinkCable) => {
    deleteMemberLink(cable.edgeId, cable.memberIndex);
    triggerYamlRefresh();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Edge Links — {nodeName}
        {cables.length > 0 && (
          <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
            ({cables.length})
          </Typography>
        )}
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Edge links are interfaces that connect to devices outside the topology. They cable to
          an external node on the canvas but only the interface on {nodeName} is written to YAML.
        </Typography>

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mb: 2 }}>
          <TextField
            label="New interface"
            placeholder="ethernet-1-1"
            size="small"
            autoFocus
            value={newInterface}
            error={newInterfaceError !== null}
            helperText={newInterfaceError}
            onChange={e => { setNewInterface(e.target.value); }}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
            sx={{ flex: 1 }}
          />
          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel>Template</InputLabel>
            <Select
              value={newTemplate}
              onChange={e => { setNewTemplate(e.target.value); }}
              label="Template"
            >
              <MenuItem value=""><em>None</em></MenuItem>
              {edgeTemplates.map(t => <MenuItem key={t.name} value={t.name}>{t.name}</MenuItem>)}
            </Select>
          </FormControl>
          <Button
            size="small"
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={handleAdd}
            disabled={!trimmedNew || newInterfaceError !== null}
            sx={{ flexShrink: 0, height: 40 }}
          >
            Add
          </Button>
        </Box>

        {cables.length === 0 ? (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
            No edge links yet — add an interface above, or cable a port to an external node.
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Typography variant="caption" sx={{ ...COLUMN_HEADER_SX, flex: 1 }}>INTERFACE</Typography>
              <Typography variant="caption" sx={{ ...COLUMN_HEADER_SX, minWidth: 130 }}>TEMPLATE</Typography>
              <Box sx={{ width: 28, flexShrink: 0 }} />
            </Box>
            {cables.map(cable => {
              const error = rowInterfaceError(cable);
              return (
                <Box key={`${cable.edgeId}-${cable.memberIndex}`} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                  <TextField
                    size="small"
                    value={cable.interface}
                    error={error !== null}
                    helperText={error}
                    title={`${cable.name} → ${cable.externalName}`}
                    onChange={e => { handleUpdateInterface(cable, e.target.value); }}
                    sx={{ flex: 1 }}
                  />
                  <FormControl size="small" sx={{ minWidth: 130 }}>
                    <Select
                      value={cable.template ?? ''}
                      onChange={e => { handleUpdateTemplate(cable, e.target.value); }}
                      displayEmpty
                    >
                      <MenuItem value=""><em>None</em></MenuItem>
                      {edgeTemplates.map(t => <MenuItem key={t.name} value={t.name}>{t.name}</MenuItem>)}
                    </Select>
                  </FormControl>
                  <Tooltip title="Remove edge link">
                    <IconButton size="small" color="error" onClick={() => { handleDelete(cable); }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              );
            })}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
