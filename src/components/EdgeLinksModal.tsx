import { useState, useEffect } from 'react';
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
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';

import type { UIEdgeLink } from '../types/ui';
import type { LinkTemplate } from '../types/schema';
import { getNextEdgeLinkInterface, getDefaultEdgeTemplate } from '../lib/utils';
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

  const [newInterface, setNewInterface] = useState('');
  const [newTemplate, setNewTemplate] = useState('');

  useEffect(() => {
    if (open) {
      setNewInterface(getNextEdgeLinkInterface(edgeLinks, edges, nodeId));
      setNewTemplate(getDefaultEdgeTemplate(edgeLinks, linkTemplates));
    }
  }, [open, edgeLinks, linkTemplates, edges, nodeId]);

  const handleAdd = () => {
    const iface = newInterface.trim();
    if (!iface) return;

    const newEdgeLink: UIEdgeLink = {
      name: `${nodeName}-${iface}`,
      interface: iface,
      template: newTemplate || undefined,
    };

    const updatedLinks = [...edgeLinks, newEdgeLink];
    onUpdate(updatedLinks);
    setNewInterface(getNextEdgeLinkInterface(updatedLinks, edges, nodeId));
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
      <DialogTitle>Edge Links - {nodeName}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Edge links are interfaces that connect to external devices outside the topology.
        </Typography>

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 2 }}>
          <TextField
            label="New interface"
            placeholder="ethernet-1-1"
            size="small"
            value={newInterface}
            onChange={e => { setNewInterface(e.target.value); }}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
            sx={{ flex: 1 }}
          />
          <FormControl size="small" sx={{ minWidth: 120 }}>
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
          <IconButton size="small" color="primary" onClick={handleAdd} disabled={!newInterface.trim()}>
            <AddIcon fontSize="small" />
          </IconButton>
        </Box>

        {edgeLinks.length > 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
            {edgeLinks.map((link, index) => (
              <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <TextField
                  size="small"
                  value={link.interface}
                  onChange={e => { handleUpdateInterface(index, e.target.value); }}
                  sx={{ flex: 1 }}
                />
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <Select
                    value={link.template || ''}
                    onChange={e => { handleUpdateTemplate(index, e.target.value); }}
                    displayEmpty
                  >
                    <MenuItem value=""><em>None</em></MenuItem>
                    {edgeTemplates.map(t => <MenuItem key={t.name} value={t.name}>{t.name}</MenuItem>)}
                  </Select>
                </FormControl>
                <IconButton size="small" color="error" onClick={() => { handleDelete(index); }}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>
            ))}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
