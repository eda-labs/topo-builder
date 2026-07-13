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

import type { UIEdgeLink } from '../types/ui';
import type { LinkTemplate } from '../types/schema';
import { getUsedInterfacesForNode, getDefaultEdgeTemplate } from '../lib/utils';
import { generateInterface } from '../lib/interfaces';
import { useTopologyStore } from '../lib/store';

interface EdgeLinksModalProps {
  open: boolean;
  onClose: () => void;
  nodeName: string;
  nodeId: string;
  edgeLinks: UIEdgeLink[];
  linkTemplates: LinkTemplate[];
  onUpdate: (edgeLinks: UIEdgeLink[]) => void;
}

const COLUMN_HEADER_SX = { color: 'text.secondary', fontWeight: 700, letterSpacing: 0.5 } as const;

export default function EdgeLinksModal({
  open,
  onClose,
  nodeName,
  nodeId,
  edgeLinks,
  linkTemplates,
  onUpdate,
}: EdgeLinksModalProps) {
  const edgeTemplates = linkTemplates.filter(t => t.type === 'Edge');
  const edges = useTopologyStore(state => state.edges);
  const nodes = useTopologyStore(state => state.nodes);
  const nodeTemplates = useTopologyStore(state => state.nodeTemplates);

  const [newInterface, setNewInterface] = useState('');
  const [newTemplate, setNewTemplate] = useState('');

  // Interfaces already carrying a cable on this node — an edge link must not collide with them.
  const cabledInterfaces = useMemo(
    () => new Set(getUsedInterfacesForNode([], edges, nodeId)),
    [edges, nodeId],
  );

  const edgeLinkInterfaceCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const link of edgeLinks) {
      counts.set(link.interface, (counts.get(link.interface) ?? 0) + 1);
    }
    return counts;
  }, [edgeLinks]);

  const trimmedNew = newInterface.trim();
  const newInterfaceError = (() => {
    if (!trimmedNew) return null;
    if (cabledInterfaces.has(trimmedNew)) return 'In use by a cable on this node';
    if (edgeLinkInterfaceCounts.has(trimmedNew)) return 'Edge link already exists';
    return null;
  })();

  const rowInterfaceError = (link: UIEdgeLink): string | null => {
    if (!link.interface.trim()) return 'Interface is required';
    if (cabledInterfaces.has(link.interface)) return 'In use by a cable on this node';
    if ((edgeLinkInterfaceCounts.get(link.interface) ?? 0) > 1) return 'Duplicate edge link';
    return null;
  };

  const getNextInterface = (currentEdgeLinks: UIEdgeLink[]) => {
    const node = nodes.find(n => n.id === nodeId);
    const usedInterfaces = getUsedInterfacesForNode(currentEdgeLinks, edges, nodeId);
    return generateInterface(node, nodeTemplates, usedInterfaces);
  };

  useEffect(() => {
    if (open) {
      setNewInterface(getNextInterface(edgeLinks));
      setNewTemplate(getDefaultEdgeTemplate(edgeLinks, linkTemplates));
    }
  }, [open, edgeLinks, linkTemplates, edges, nodeId, nodes, nodeTemplates]);

  const handleAdd = () => {
    const iface = trimmedNew;
    if (!iface || newInterfaceError) return;

    const newEdgeLink: UIEdgeLink = {
      name: `${nodeName}-${iface}`,
      interface: iface,
      template: newTemplate || undefined,
    };

    const updatedLinks = [...edgeLinks, newEdgeLink];
    onUpdate(updatedLinks);
    setNewInterface(getNextInterface(updatedLinks));
    setNewTemplate(getDefaultEdgeTemplate(updatedLinks, linkTemplates));
  };

  const handleDelete = (index: number) => {
    onUpdate(edgeLinks.filter((_, i) => i !== index));
  };

  const handleUpdateInterface = (index: number, value: string) => {
    onUpdate(edgeLinks.map((link, i) =>
      i === index ? { ...link, interface: value, name: `${nodeName}-${value}` } : link,
    ));
  };

  const handleUpdateTemplate = (index: number, value: string) => {
    onUpdate(edgeLinks.map((link, i) =>
      i === index ? { ...link, template: value || undefined } : link,
    ));
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Edge Links — {nodeName}
        {edgeLinks.length > 0 && (
          <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
            ({edgeLinks.length})
          </Typography>
        )}
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Edge links are interfaces that connect to external devices outside the topology.
          They show up as short teal stubs hanging off the node.
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

        {edgeLinks.length === 0 ? (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
            No edge links yet — add an interface above.
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Typography variant="caption" sx={{ ...COLUMN_HEADER_SX, flex: 1 }}>INTERFACE</Typography>
              <Typography variant="caption" sx={{ ...COLUMN_HEADER_SX, minWidth: 130 }}>TEMPLATE</Typography>
              <Box sx={{ width: 28, flexShrink: 0 }} />
            </Box>
            {edgeLinks.map((link, index) => {
              const error = rowInterfaceError(link);
              return (
                <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                  <TextField
                    size="small"
                    value={link.interface}
                    error={error !== null}
                    helperText={error}
                    onChange={e => { handleUpdateInterface(index, e.target.value); }}
                    sx={{ flex: 1 }}
                  />
                  <FormControl size="small" sx={{ minWidth: 130 }}>
                    <Select
                      value={link.template || ''}
                      onChange={e => { handleUpdateTemplate(index, e.target.value); }}
                      displayEmpty
                    >
                      <MenuItem value=""><em>None</em></MenuItem>
                      {edgeTemplates.map(t => <MenuItem key={t.name} value={t.name}>{t.name}</MenuItem>)}
                    </Select>
                  </FormControl>
                  <Tooltip title="Remove edge link">
                    <IconButton size="small" color="error" onClick={() => { handleDelete(index); }}>
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
