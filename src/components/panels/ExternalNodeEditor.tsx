import { useEffect, useRef, useState } from 'react';
import { Box, Button, Paper, TextField, Typography } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import type { Edge, Node } from '@xyflow/react';

import { LinkDiagram } from '../edges/cards';
import { CARD_BG, CARD_BORDER } from '../../lib/constants';
import { useTopologyStore } from '../../lib/store';
import { formatName } from '../../lib/utils';
import type { UINodeData, UIEdgeData } from '../../types/ui';

import { PanelHeader, PanelSection } from './shared';

interface ExternalNodeEditorProps {
  node: Node<UINodeData>;
  edges: Edge<UIEdgeData>[];
}

/** Properties for a UI-only external node: rename, review its edge links, delete. */
export function ExternalNodeEditor({ node, edges }: ExternalNodeEditorProps) {
  const updateExternalNode = useTopologyStore(state => state.updateExternalNode);
  const deleteNode = useTopologyStore(state => state.deleteNode);

  const name = node.data.name;
  const [localName, setLocalName] = useState(name);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalName(name);
  }, [name, node.id]);

  const handleNameBlur = () => {
    if (localName && localName !== name) {
      updateExternalNode(node.id, { name: localName });
    }
  };

  const connectedEdges = edges.filter(e => e.source === node.id || e.target === node.id);
  const cableCount = connectedEdges.reduce((sum, e) => sum + (e.data?.memberLinks?.length || 0), 0);

  return (
    <Box>
      <PanelHeader title={name} />

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <Typography variant="body2" color="text.secondary">
          External node — a stand-in for a device outside the topology. It is not written to the
          YAML; its cables export as edge links on the connected nodes.
        </Typography>

        <TextField
          label="Name"
          size="small"
          value={localName}
          onChange={e => { setLocalName(formatName(e.target.value)); }}
          onBlur={handleNameBlur}
          inputRef={nameInputRef}
          fullWidth
        />
      </Box>

      {connectedEdges.length > 0 && (
        <PanelSection title="Edge Links" count={cableCount}>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            {connectedEdges.map(edge => {
              const edgeData = edge.data;
              if (!edgeData) return null;
              const isSource = edge.source === node.id;
              const otherNode = isSource ? edgeData.targetNode : edgeData.sourceNode;
              return (edgeData.memberLinks || []).map((link, idx) => (
                <Paper
                  key={`${edge.id}-${idx}`}
                  variant="outlined"
                  sx={{ p: '0.5rem', cursor: 'pointer', bgcolor: CARD_BG, borderColor: CARD_BORDER }}
                  onClick={() => { useTopologyStore.getState().selectMemberLink(edge.id, idx, false); }}
                >
                  <Typography variant="body2" sx={{ mb: '0.25rem', fontWeight: 500 }}>
                    {link.name}
                  </Typography>
                  <LinkDiagram
                    localNode={name}
                    remoteNode={otherNode}
                    localInterface={isSource ? link.sourceInterface : link.targetInterface}
                    remoteInterface={isSource ? link.targetInterface : link.sourceInterface}
                  />
                </Paper>
              ));
            })}
          </Box>
        </PanelSection>
      )}

      <Box sx={{ mt: '1.5rem' }}>
        <Button
          size="small"
          color="error"
          variant="outlined"
          startIcon={<DeleteIcon />}
          onClick={() => { deleteNode(node.id); }}
        >
          Delete External Node
        </Button>
      </Box>
    </Box>
  );
}
