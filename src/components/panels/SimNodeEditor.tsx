import { useEffect, useRef, useState } from 'react';
import {
  Box,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
} from '@mui/material';
import type { Edge } from '@xyflow/react';

import { useTopologyStore } from '../../lib/store';
import { formatName } from '../../lib/utils';
import type { SimNodeTemplate } from '../../types/schema';
import type { UIEdgeData } from '../../types/ui';

import { ConnectedLinksSection } from './ConnectedLinksSection';
import { PanelHeader } from './shared';

interface SimNodeEditorProps {
  simNode: { name: string; template?: string; id?: string };
  simNodeTemplates: SimNodeTemplate[];
  connectedEdges: Edge<UIEdgeData>[];
  onUpdate: (update: Partial<{ name: string; template?: string }>) => void;
}

export function SimNodeEditor({
  simNode,
  simNodeTemplates,
  connectedEdges,
  onUpdate,
}: SimNodeEditorProps) {
  const [localName, setLocalName] = useState(simNode.name);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalName(simNode.name);
  }, [simNode.name]);

  useEffect(() => {
    const handler = () => nameInputRef.current?.focus();
    window.addEventListener('focusNodeName', handler);
    return () => { window.removeEventListener('focusNodeName', handler); };
  }, []);

  const handleNameBlur = () => {
    if (localName !== simNode.name) {
      onUpdate({ name: localName });
      setTimeout(() => {
        const freshNodes = useTopologyStore.getState().nodes;
        const currentSimNode = freshNodes.find(n => n.id === simNode.id && n.data.nodeType === 'simnode');
        if (currentSimNode && currentSimNode.data.name !== localName) {
          setLocalName(currentSimNode.data.name);
        }
      }, 50);
    }
  };

  return (
    <Box>
      <PanelHeader title={simNode.name} />

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <TextField
          label="Name"
          size="small"
          value={localName}
          onChange={e => { setLocalName(formatName(e.target.value)); }}
          onBlur={handleNameBlur}
          inputRef={nameInputRef}
          fullWidth
        />

        <FormControl size="small" fullWidth>
          <InputLabel>Template</InputLabel>
          <Select
            label="Template"
            value={simNode.template || ''}
            onChange={e => { onUpdate({ template: e.target.value || undefined }); }}
          >
            <MenuItem value="">None</MenuItem>
            {simNodeTemplates.map(t => (
              <MenuItem key={t.name} value={t.name}>
                {t.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      <ConnectedLinksSection edges={connectedEdges} localNodeName={simNode.name} />
    </Box>
  );
}
