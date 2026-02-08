import { useEffect, useRef, useState, type RefObject } from 'react';
import {
  Box,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
} from '@mui/material';
import type { Edge, Node } from '@xyflow/react';

import { getInheritedNodeLabels } from '../../lib/labels';
import { useTopologyStore } from '../../lib/store';
import { formatName } from '../../lib/utils';
import type { NodeTemplate } from '../../types/schema';
import type { UINodeData, UIEdgeData } from '../../types/ui';

import { ConnectedLinksSection } from './ConnectedLinksSection';
import { EditableLabelsSection, PanelHeader } from './shared';

interface NodeEditorProps {
  node: Node<UINodeData>;
  edges: Edge<UIEdgeData>[];
  nodeTemplates: NodeTemplate[];
  nodeNameInputRef?: RefObject<HTMLInputElement | null>;
}

export function NodeEditor({
  node,
  edges,
  nodeTemplates,
  nodeNameInputRef: externalRef,
}: NodeEditorProps) {
  const nodeData = node.data;
  const updateNode = useTopologyStore(state => state.updateNode);
  const triggerYamlRefresh = useTopologyStore(state => state.triggerYamlRefresh);

  const internalRef = useRef<HTMLInputElement>(null);
  const nodeNameInputRef = externalRef || internalRef;

  const [localNodeName, setLocalNodeName] = useState(nodeData.name || '');

  useEffect(() => {
    setLocalNodeName(nodeData.name || '');
  }, [nodeData.name, node.id]);

  const handleUpdateNodeField = (update: Partial<UINodeData>) => {
    updateNode(node.id, update);
    triggerYamlRefresh();
  };

  const handleNodeNameBlur = () => {
    if (localNodeName !== nodeData.name) {
      updateNode(node.id, { name: localNodeName });
      triggerYamlRefresh();
      setTimeout(() => {
        const freshNodes = useTopologyStore.getState().nodes;
        const currentNode = freshNodes.find(n => n.id === node.id);
        if (currentNode && currentNode.data.name !== localNodeName) {
          setLocalNodeName(currentNode.data.name);
        }
      }, 50);
    }
  };

  const connectedEdges = edges.filter(
    e => e.source === node.id || e.target === node.id,
  );

  const simNodeEdges = edges.filter(e => {
    if (e.source === node.id || e.target === node.id) return false;
    return (
      e.data?.sourceNode === nodeData.name || e.data?.targetNode === nodeData.name
    );
  });

  const esiLagEdges = edges.filter(e => {
    if (connectedEdges.includes(e) || simNodeEdges.includes(e)) return false;
    return e.data?.esiLeaves?.some(leaf => leaf.nodeId === node.id || leaf.nodeName === nodeData.name);
  });

  const allConnectedEdges = [...connectedEdges, ...simNodeEdges, ...esiLagEdges];

  return (
    <Box>
      <PanelHeader title={nodeData.name} />

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <TextField
          label="Name"
          size="small"
          value={localNodeName}
          onChange={e => { setLocalNodeName(formatName(e.target.value)); }}
          onBlur={handleNodeNameBlur}
          fullWidth
          inputRef={nodeNameInputRef}
        />

        <FormControl size="small" fullWidth>
          <InputLabel>Template</InputLabel>
          <Select
            label="Template"
            value={nodeData.template || ''}
            onChange={e =>
            { handleUpdateNodeField({ template: e.target.value || undefined }); }
            }
          >
            <MenuItem value="">None</MenuItem>
            {nodeTemplates.map(t => (
              <MenuItem key={t.name} value={t.name}>
                {t.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          label="Serial Number"
          size="small"
          value={nodeData.serialNumber || ''}
          onChange={e => { handleUpdateNodeField({ serialNumber: e.target.value || undefined }); }}
          fullWidth
        />

        <EditableLabelsSection
          labels={nodeData.labels}
          inheritedLabels={getInheritedNodeLabels(node, nodeTemplates)}
          onUpdate={labels => { handleUpdateNodeField({ labels }); }}
        />
      </Box>

      <ConnectedLinksSection edges={allConnectedEdges} localNodeName={nodeData.name} />
    </Box>
  );
}
