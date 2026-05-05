import { useEffect, useRef, useState, type RefObject } from 'react';
import {
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import type { Edge, Node } from '@xyflow/react';
const IPV4_REGEX = /^(?:(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)$/;
const IPV6_REGEX = /^(?:(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,7}:|(?:[0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,5}(?::[0-9a-fA-F]{1,4}){1,2}|(?:[0-9a-fA-F]{1,4}:){1,4}(?::[0-9a-fA-F]{1,4}){1,3}|(?:[0-9a-fA-F]{1,4}:){1,3}(?::[0-9a-fA-F]{1,4}){1,4}|(?:[0-9a-fA-F]{1,4}:){1,2}(?::[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:(?::[0-9a-fA-F]{1,4}){1,6}|:(?::[0-9a-fA-F]{1,4}){1,7}|::(?:[fF]{2}:)?(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)){3}|(?:[0-9a-fA-F]{1,4}:){1,5}:(?:[fF]{2}:)?(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)){3}|(?:[0-9a-fA-F]{1,4}:){1,4}:(?:[fF]{2}:)?(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)){3})$/;

function isValidCidrIPv4(value: string, requirePrefix: boolean): boolean {
  const parts = value.split('/');
  if (parts.length === 1) return !requirePrefix && IPV4_REGEX.test(parts[0]);
  if (parts.length !== 2) return false;
  if (!IPV4_REGEX.test(parts[0])) return false;
  const prefix = Number(parts[1]);
  return Number.isInteger(prefix) && prefix >= 0 && prefix <= 32;
}

function isValidCidrIPv6(value: string, requirePrefix: boolean): boolean {
  const parts = value.split('/');
  if (parts.length === 1) return !requirePrefix && IPV6_REGEX.test(parts[0]);
  if (parts.length !== 2) return false;
  if (!IPV6_REGEX.test(parts[0])) return false;
  const prefix = Number(parts[1]);
  return Number.isInteger(prefix) && prefix >= 0 && prefix <= 128;
}

import { LagCard, LinkDiagram } from '../edges/cards';
import { CARD_BG, CARD_BORDER } from '../../lib/constants';
import { getInheritedNodeLabels } from '../../lib/labels';
import { useTopologyStore } from '../../lib/store';
import { formatName } from '../../lib/utils';
import type { NodeTemplate } from '../../types/schema';
import type { UINodeData, UIEdgeData, UIEdgeLink } from '../../types/ui';

import EdgeLinksModal from '../EdgeLinksModal';
import { EditableLabelsSection, PanelHeader, PanelSection } from './shared';

const SPACE_BETWEEN = 'space-between';

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
  const linkTemplates = useTopologyStore(state => state.linkTemplates);
  const schemaVersion = useTopologyStore(state => state.schemaVersion);
  const requirePrefix = schemaVersion >= 26;

  const internalRef = useRef<HTMLInputElement>(null);
  const nodeNameInputRef = externalRef || internalRef;

  const [localNodeName, setLocalNodeName] = useState(nodeData.name || '');
  const [edgeLinksModalOpen, setEdgeLinksModalOpen] = useState(false);

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

        <TextField
          label={requirePrefix ? 'Production Address (IPv4/CIDR)' : 'Production Address (IPv4)'}
          size="small"
          value={nodeData.productionAddress?.ipv4 || ''}
          error={!!nodeData.productionAddress?.ipv4 && !isValidCidrIPv4(nodeData.productionAddress.ipv4, requirePrefix)}
          helperText={nodeData.productionAddress?.ipv4 && !isValidCidrIPv4(nodeData.productionAddress.ipv4, requirePrefix) ? 'Invalid IPv4 address' : undefined}
          onChange={e => {
            const ipv4 = e.target.value || undefined;
            const ipv6 = nodeData.productionAddress?.ipv6;
            handleUpdateNodeField({ productionAddress: ipv4 || ipv6 ? { ipv4, ipv6 } : undefined });
          }}
          fullWidth
        />
        <TextField
          label={requirePrefix ? 'Production Address (IPv6/CIDR)' : 'Production Address (IPv6)'}
          size="small"
          value={nodeData.productionAddress?.ipv6 || ''}
          error={!!nodeData.productionAddress?.ipv6 && !isValidCidrIPv6(nodeData.productionAddress.ipv6, requirePrefix)}
          helperText={nodeData.productionAddress?.ipv6 && !isValidCidrIPv6(nodeData.productionAddress.ipv6, requirePrefix) ? 'Invalid IPv6 address' : undefined}
          onChange={e => {
            const ipv6 = e.target.value || undefined;
            const ipv4 = nodeData.productionAddress?.ipv4;
            handleUpdateNodeField({ productionAddress: ipv4 || ipv6 ? { ipv4, ipv6 } : undefined });
          }}
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
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
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

              const isSource = edgeData.sourceNode === nodeData.name;

              const lagElements = lagGroups.map(lag => (
                <LagCard
                  key={lag.id}
                  lag={lag}
                  edgeId={edge.id}
                  localNode={nodeData.name}
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
                        const store = useTopologyStore.getState();
                        const expanded = new Set(store.expandedEdges);
                        expanded.add(edge.id);
                        useTopologyStore.setState({ expandedEdges: expanded });
                        store.selectMemberLink(edge.id, idx, false);
                      }}
                    >
                      <Typography variant="body2" fontWeight={500} sx={{ mb: '0.25rem' }}>
                        {link.name}
                      </Typography>
                      <LinkDiagram
                        localNode={nodeData.name}
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

      <PanelSection
        title="Edge Links"
        count={nodeData.edgeLinks?.length || 0}
        actions={
          <Button size="small" startIcon={<EditIcon />} onClick={() => { setEdgeLinksModalOpen(true); }}>
            Edit
          </Button>
        }
      >
        {nodeData.edgeLinks && nodeData.edgeLinks.length > 0 ? (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
            {nodeData.edgeLinks.map((link, idx) => (
              <Chip
                key={idx}
                label={link.interface}
                size="small"
                variant="outlined"
                sx={{ bgcolor: CARD_BG, borderColor: CARD_BORDER }}
              />
            ))}
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
            No edge links configured
          </Typography>
        )}
      </PanelSection>

      <EdgeLinksModal
        open={edgeLinksModalOpen}
        onClose={() => { setEdgeLinksModalOpen(false); }}
        nodeName={nodeData.name}
        edgeLinks={nodeData.edgeLinks || []}
        linkTemplates={linkTemplates}
        onUpdate={(newEdgeLinks: UIEdgeLink[]) => {
          handleUpdateNodeField({ edgeLinks: newEdgeLinks });
        }}
      />
    </Box>
  );
}
