import { useState, useEffect, useRef, type RefObject } from 'react';
import {
  Box,
  Typography,
  TextField,
  Select,
  MenuItem,
  Paper,
  FormControl,
  InputLabel,
  Chip,
} from '@mui/material';
import { useTopologyStore } from '../../lib/store/index';
import { formatName } from '../../lib/utils';
import { getInheritedNodeLabels } from '../../lib/labels';
import { PanelHeader, PanelSection, EditableLabelsSection } from './shared';
import type { Node, Edge } from '@xyflow/react';
import type { NodeTemplate } from '../../types/schema';
import type { UINodeData, UIEdgeData } from '../../types/ui';

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

      {allConnectedEdges.length > 0 && (
        <PanelSection
          title="Connected Links"
          count={allConnectedEdges.reduce((sum, e) => sum + (e.data?.memberLinks?.length || 0), 0)}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {allConnectedEdges.map(edge => {
              const edgeData = edge.data;
              if (!edgeData) return null;
              const memberLinks = edgeData.memberLinks || [];
              const lagGroups = edgeData.lagGroups || [];
              const isEsiLag = edgeData.edgeType === 'esilag';
              const otherNode = edgeData.sourceNode === nodeData.name
                ? edgeData.targetNode
                : edgeData.sourceNode;

              if (isEsiLag && edgeData.esiLeaves) {
                const esiName = memberLinks[0]?.name || `${edgeData.sourceNode}-esi-lag`;
                return (
                  <Paper
                    key={edge.id}
                    variant="outlined"
                    sx={{ p: '0.5rem', cursor: 'pointer', bgcolor: 'var(--mui-palette-card-bg)', borderColor: 'var(--mui-palette-card-border)' }}
                    onClick={() => { useTopologyStore.getState().selectEdge(edge.id); }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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

              const lagElements = lagGroups.map(lag => (
                <Paper
                  key={lag.id}
                  variant="outlined"
                  sx={{ p: '0.5rem', cursor: 'pointer', bgcolor: 'var(--mui-palette-card-bg)', borderColor: 'var(--mui-palette-card-border)' }}
                  onClick={() => {
                    useTopologyStore.getState().selectEdge(edge.id);
                    useTopologyStore.getState().selectLag(edge.id, lag.id);
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" fontWeight={500}>
                      {lag.name || `${nodeData.name} ↔ ${otherNode}`}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Chip label="LAG" size="small" sx={{ height: 16, fontSize: 10 }} color="primary" />
                      <Typography variant="caption" color="text.secondary">
                        → {otherNode}
                      </Typography>
                    </Box>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {lag.memberLinkIndices.length} member links
                  </Typography>
                </Paper>
              ));

              const isSource = edgeData.sourceNode === nodeData.name;
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
                      sx={{ p: '0.5rem', cursor: 'pointer', bgcolor: 'var(--mui-palette-card-bg)', borderColor: 'var(--mui-palette-card-border)' }}
                      onClick={() => {
                        useTopologyStore.getState().selectEdge(edge.id);
                        useTopologyStore.getState().selectMemberLink(edge.id, idx, false);
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="body2" fontWeight={500}>
                          {link.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          → {otherNode}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="caption" color="text.secondary">
                          {localInterface}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {remoteInterface}
                        </Typography>
                      </Box>
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
