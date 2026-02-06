import { useEffect, useRef, useState } from 'react';
import {
  Box,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import type { Edge } from '@xyflow/react';

import { LagCard, LinkDiagram } from '../edges/cards';
import { CARD_BG, CARD_BORDER } from '../../lib/constants';
import { useTopologyStore } from '../../lib/store';
import { formatName } from '../../lib/utils';
import type { SimNodeTemplate } from '../../types/schema';
import type { UIEdgeData } from '../../types/ui';

import { PanelHeader, PanelSection } from './shared';

const SPACE_BETWEEN = 'space-between';

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

      {connectedEdges.length > 0 && (
        <PanelSection
          title="Connected Links"
          count={connectedEdges.reduce((sum, e) => sum + (e.data?.memberLinks?.length || 0), 0)}
        >
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            {connectedEdges.map(edge => {
              const edgeData = edge.data;
              if (!edgeData) return null;
              const memberLinks = edgeData.memberLinks || [];
              const lagGroups = edgeData.lagGroups || [];
              const isEsiLag = edgeData.edgeType === 'esilag';
              const otherNode = edgeData.sourceNode === simNode.name
                ? edgeData.targetNode
                : edgeData.sourceNode;

              if (isEsiLag && edgeData.esiLeaves) {
                const esiName = memberLinks[0]?.name || `${edgeData.sourceNode}-esi-lag`;
                return (
                  <Paper
                    key={edge.id}
                    variant="outlined"
                    sx={{ p: '0.5rem', cursor: 'pointer', bgcolor: CARD_BG, borderColor: CARD_BORDER }}
                    onClick={() => { useTopologyStore.getState().selectEdge(edge.id); }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: SPACE_BETWEEN, alignItems: 'center' }}>
                      <Typography variant="body2" fontWeight={500}>
                        {esiName}
                      </Typography>
                      <Chip label="ESI-LAG" size="small" sx={{ height: 16, fontSize: 10 }} color="primary" />
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {edgeData.esiLeaves.length} member links
                    </Typography>
                  </Paper>
                );
              }

              const indicesInLags = new Set<number>();
              lagGroups.forEach(lag => { lag.memberLinkIndices.forEach(i => indicesInLags.add(i)); });

              const isSource = edgeData.sourceNode === simNode.name;

              const lagElements = lagGroups.map(lag => (
                <LagCard
                  key={lag.id}
                  lag={lag}
                  edgeId={edge.id}
                  localNode={simNode.name}
                  otherNode={otherNode}
                  selectEdgeOnClick
                />
              ));

              const standaloneLinks = memberLinks
                .map((link, idx) => ({ link, idx }))
                .filter(({ idx }) => !indicesInLags.has(idx))
                .map(({ link, idx }) => {
                  const localInterface = isSource ? link.sourceInterface : link.targetInterface;
                  const remoteInterface = isSource ? link.targetInterface : link.sourceInterface;
                  return (
                    <Paper
                      key={`${edge.id}-${idx}`}
                      variant="outlined"
                      sx={{ p: '0.5rem', cursor: 'pointer', bgcolor: CARD_BG, borderColor: CARD_BORDER }}
                      onClick={() => {
                        useTopologyStore.getState().selectEdge(edge.id);
                        useTopologyStore.getState().selectMemberLink(edge.id, idx, false);
                      }}
                    >
                      <Typography variant="body2" fontWeight={500} sx={{ mb: '0.25rem' }}>
                        {link.name}
                      </Typography>
                      <LinkDiagram
                        localNode={simNode.name}
                        remoteNode={otherNode}
                        localInterface={localInterface}
                        remoteInterface={remoteInterface}
                      />
                    </Paper>
                  );
                });

              return [...lagElements, ...standaloneLinks];
            })}
          </Box>
        </PanelSection>
      )}
    </Box>
  );
}
