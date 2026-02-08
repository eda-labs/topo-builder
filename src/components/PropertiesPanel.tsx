import { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  TextField,
  Select,
  MenuItem,
  Button,
  IconButton,
  FormControl,
  InputLabel,
  Autocomplete,
} from '@mui/material';
import { Delete as DeleteIcon, Add as AddIcon } from '@mui/icons-material';

import { useTopologyStore } from '../lib/store';
import {
  NODE_PROFILE_SUGGESTIONS,
  PLATFORM_SUGGESTIONS,
  ANNOTATION_NAME_PREFIX,
  SESSION_NEW_LINK_ID,
} from '../lib/constants';
import type {
  NodeTemplate,
  LinkTemplate,
  LinkType,
  LinkSpeed,
  EncapType,
  SimNodeTemplate,
  SimNodeType,
} from '../types/schema';

import {
  PanelHeader,
  PanelCard,
  LabelEditor,
  NodeEditor,
  EdgeEditor,
  SimNodeEditor,
  AnnotationEditor,
} from './panels';

export function SelectionPanel() {
  const selectedNodeId = useTopologyStore(state => state.selectedNodeId);
  const selectedEdgeId = useTopologyStore(state => state.selectedEdgeId);
  const selectedMemberLinkIndices = useTopologyStore(
    state => state.selectedMemberLinkIndices,
  );
  const selectedLagId = useTopologyStore(state => state.selectedLagId);
  const expandedEdges = useTopologyStore(state => state.expandedEdges);
  const nodes = useTopologyStore(state => state.nodes);
  const edges = useTopologyStore(state => state.edges);
  const nodeTemplates = useTopologyStore(state => state.nodeTemplates);
  const linkTemplates = useTopologyStore(state => state.linkTemplates);
  const simulation = useTopologyStore(state => state.simulation);

  const selectedAnnotationId = useTopologyStore(state => state.selectedAnnotationId);
  const annotations = useTopologyStore(state => state.annotations);

  const selectedNode = nodes.find(n => n.id === selectedNodeId);
  const selectedEdge = edges.find(e => e.id === selectedEdgeId);
  const selectedSimNode = nodes.find(
    n => n.selected && n.data.nodeType === 'simnode',
  );
  const selectedAnnotation = annotations.find(a => a.id === selectedAnnotationId);
  const updateNode = useTopologyStore(state => state.updateNode);
  const updateSimNode = useTopologyStore(state => state.updateSimNode);

  // Ref for node name input to auto-focus and select
  const nodeNameInputRef = useRef<HTMLInputElement>(null);
  const prevSelectedNodeIdRef = useRef<string | null>(null);

  const sourceInterfaceRef = useRef<HTMLInputElement>(null);
  const targetInterfaceRef = useRef<HTMLInputElement>(null);
  const prevSelectedEdgeIdRef = useRef<string | null>(null);

  const focusAtEnd = (input: HTMLInputElement | null) => {
    if (input) {
      input.focus();
      const len = input.value.length;
      input.setSelectionRange(len, len);
    }
  };

  const selectedNodes = nodes.filter(n => n.selected);
  const selectedRegularNodes = selectedNodes.filter(n => n.data.nodeType !== 'simnode');
  const selectedSimNodes = selectedNodes.filter(n => n.data.nodeType === 'simnode');
  const selectedEdges = edges.filter(e => e.selected);
  const selectedMemberLinksCount = selectedMemberLinkIndices.length;

  const hasMultipleSelected =
    selectedRegularNodes.length > 1 ||
    selectedEdges.length > 1 ||
    selectedSimNodes.length > 1 ||
    selectedMemberLinksCount > 1 ||
    (selectedRegularNodes.length + selectedEdges.length + selectedSimNodes.length) > 1;

  // Auto-focus and select node name when a new node is selected
  useEffect(() => {
    if (selectedNodeId && selectedNodeId !== prevSelectedNodeIdRef.current && selectedNode?.data.isNew) {
      setTimeout(() => {
        focusAtEnd(nodeNameInputRef.current);
        updateNode(selectedNodeId, { isNew: false });
      }, 50);
    }
    prevSelectedNodeIdRef.current = selectedNodeId;
  }, [selectedNodeId, selectedNode?.data.isNew, updateNode]);

  // Auto-focus source interface when a new link is created
  useEffect(() => {
    const newLinkId = sessionStorage.getItem(SESSION_NEW_LINK_ID);
    if (selectedEdgeId && selectedEdgeId === newLinkId) {
      setTimeout(() => { focusAtEnd(sourceInterfaceRef.current); }, 100);
      sessionStorage.removeItem(SESSION_NEW_LINK_ID);
    }
    prevSelectedEdgeIdRef.current = selectedEdgeId;
  }, [selectedEdgeId]);

  useEffect(() => {
    const handler = () => { focusAtEnd(nodeNameInputRef.current); };
    window.addEventListener('focusNodeName', handler);
    return () => { window.removeEventListener('focusNodeName', handler); };
  }, []);

  // Don't show properties panel when multiple items are selected
  if (hasMultipleSelected) {
    return (
      <Typography color="text.secondary" textAlign="center" py="1rem">
        Select a node or link
      </Typography>
    );
  }

  if (selectedNode && selectedNode.data.nodeType !== 'simnode') {
    return (
      <NodeEditor
        node={selectedNode}
        edges={edges}
        nodeTemplates={nodeTemplates}
        nodeNameInputRef={nodeNameInputRef}
      />
    );
  }

  if (selectedEdge && selectedEdge.data) {
    return (
      <EdgeEditor
        edge={selectedEdge}
        linkTemplates={linkTemplates}
        selectedLagId={selectedLagId}
        selectedMemberLinkIndices={selectedMemberLinkIndices}
        expandedEdges={expandedEdges}
        sourceInterfaceRef={sourceInterfaceRef}
        targetInterfaceRef={targetInterfaceRef}
      />
    );
  }

  if (selectedAnnotation) {
    return <AnnotationEditor annotation={selectedAnnotation} />;
  }

  if (selectedSimNode) {
    const simNodeId = selectedSimNode.id;
    const connectedEdges = edges.filter(
      e => e.source === simNodeId || e.target === simNodeId,
    );
    const esiLagEdges = edges.filter(e => {
      if (connectedEdges.includes(e)) return false;
      return e.data?.sourceNode === selectedSimNode.data.name ||
        e.data?.esiLeaves?.some(leaf => leaf.nodeName === selectedSimNode.data.name);
    });
    const allConnectedEdges = [...connectedEdges, ...esiLagEdges];

    return (
      <SimNodeEditor
        simNode={{ name: selectedSimNode.data.name, template: selectedSimNode.data.template, id: selectedSimNode.id }}
        simNodeTemplates={simulation.simNodeTemplates}
        connectedEdges={allConnectedEdges}
        onUpdate={update => {
          updateSimNode(selectedSimNode.data.name, update);
        }}
      />
    );
  }

  return (
    <Typography color="text.secondary" textAlign="center" py="1rem">
      Select a node or link
    </Typography>
  );
}

function createNameBlurHandler(
  templateName: string,
  localName: string,
  setLocalName: (v: string) => void,
  onUpdate: (name: string, update: { name: string }) => boolean,
) {
  return () => {
    const success = onUpdate(templateName, { name: localName });
    if (!success) setLocalName(templateName);
  };
}

function createTemplateLabelHandlers(
  template: { name: string; labels?: Record<string, string> },
  onUpdate: (name: string, update: { labels: Record<string, string> }) => void,
) {
  const handleAddLabel = () => {
    let counter = 1;
    let newKey = `eda.nokia.com/label-${counter}`;
    while (template.labels?.[newKey]) {
      counter++;
      newKey = `eda.nokia.com/label-${counter}`;
    }
    onUpdate(template.name, {
      labels: { ...template.labels, [newKey]: '' },
    });
  };

  const handleUpdateLabel = (oldKey: string, newKey: string, value: string) => {
    const filteredLabels = Object.fromEntries(
      Object.entries(template.labels ?? {}).filter(([k]) => k !== oldKey),
    );
    onUpdate(template.name, { labels: { ...filteredLabels, [newKey]: value } });
  };

  const handleDeleteLabel = (key: string) => {
    const newLabels = Object.fromEntries(
      Object.entries(template.labels ?? {}).filter(([k]) => k !== key),
    );
    onUpdate(template.name, { labels: newLabels });
  };

  return { handleAddLabel, handleUpdateLabel, handleDeleteLabel };
}

// Individual template editor to maintain stable local state for text fields
function NodeTemplateEditor({
  template,
  onUpdate,
  onDelete,
  existingNodeProfiles,
  existingPlatforms,
}: {
  template: NodeTemplate;
  onUpdate: (name: string, update: Partial<NodeTemplate>) => boolean;
  onDelete: (name: string) => void;
  existingNodeProfiles: string[];
  existingPlatforms: string[];
}) {
  const [localName, setLocalName] = useState(template.name);
  const [localNamePrefix, setLocalNamePrefix] = useState(template.annotations?.[ANNOTATION_NAME_PREFIX] || '');
  const [localPlatform, setLocalPlatform] = useState(template.platform || '');
  const [localNodeProfile, setLocalNodeProfile] = useState(
    template.nodeProfile || '',
  );

  // Sync local state when template changes from external source
  useEffect(() => {
    setLocalName(template.name);
    setLocalNamePrefix(template.annotations?.[ANNOTATION_NAME_PREFIX] || '');
    setLocalPlatform(template.platform || '');
    setLocalNodeProfile(template.nodeProfile || '');
  }, [template]);

  const handleNameBlur = createNameBlurHandler(template.name, localName, setLocalName, onUpdate);
  const { handleAddLabel, handleUpdateLabel, handleDeleteLabel } = createTemplateLabelHandlers(template, onUpdate);

  return (
    <PanelCard>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            gap: '0.5rem',
            alignItems: 'center',
          }}
        >
          <TextField
            label="Name"
            size="small"
            value={localName}
            onChange={e => { setLocalName(e.target.value); }}
            onBlur={handleNameBlur}
            fullWidth
          />
          <IconButton size="small" onClick={() => { onDelete(template.name); }}>
            <DeleteIcon fontSize="small" color="error" />
          </IconButton>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <Autocomplete
            freeSolo
            size="small"
            options={existingPlatforms}
            value={localPlatform}
            onInputChange={(_, value) => { setLocalPlatform(value); }}
            onBlur={() => onUpdate(template.name, { platform: localPlatform })}
            renderInput={params => <TextField {...params} label="Platform" />}
          />
          <Autocomplete
            freeSolo
            size="small"
            options={existingNodeProfiles}
            value={localNodeProfile}
            onInputChange={(_, value) => { setLocalNodeProfile(value); }}
            onBlur={() =>
              onUpdate(template.name, { nodeProfile: localNodeProfile })
            }
            renderInput={params => (
              <TextField {...params} label="Node Profile" />
            )}
          />
        </Box>

        <TextField
          label="Name Prefix"
          size="small"
          value={localNamePrefix}
          onChange={e => { setLocalNamePrefix(e.target.value); }}
          onBlur={() => {
            const existing = Object.entries(template.annotations ?? {}).filter(
              ([k]) => k !== ANNOTATION_NAME_PREFIX,
            );
            const annotations = Object.fromEntries(
              localNamePrefix ? [...existing, [ANNOTATION_NAME_PREFIX, localNamePrefix]] : existing,
            );
            onUpdate(template.name, { annotations: Object.keys(annotations).length > 0 ? annotations : undefined });
          }}
          fullWidth
        />

        {/* Labels Section */}
        <Box>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: '0.5rem',
            }}
          >
            <Typography variant="body2" fontWeight={600}>
              Labels
            </Typography>
            <Button size="small" startIcon={<AddIcon />} onClick={handleAddLabel}>
              Add
            </Button>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {Object.entries(template.labels || {}).map(([key, value]) => (
              <LabelEditor
                key={key}
                labelKey={key}
                labelValue={value}
                onUpdate={(newKey, newValue) =>
                { handleUpdateLabel(key, newKey, newValue); }
                }
                onDelete={() => { handleDeleteLabel(key); }}
              />
            ))}
          </Box>
        </Box>
      </Box>
    </PanelCard>
  );
}

export function NodeTemplatesPanel() {
  const nodeTemplates = useTopologyStore(state => state.nodeTemplates);
  const addNodeTemplate = useTopologyStore(state => state.addNodeTemplate);
  const updateNodeTemplate = useTopologyStore(
    state => state.updateNodeTemplate,
  );
  const deleteNodeTemplate = useTopologyStore(
    state => state.deleteNodeTemplate,
  );
  const triggerYamlRefresh = useTopologyStore(
    state => state.triggerYamlRefresh,
  );

  const existingNodeProfiles = [
    ...new Set([
      ...NODE_PROFILE_SUGGESTIONS,
      ...nodeTemplates
        .map(t => t.nodeProfile)
        .filter((p): p is string => !!p),
    ]),
  ];
  const existingPlatforms = [
    ...new Set([
      ...PLATFORM_SUGGESTIONS,
      ...nodeTemplates.map(t => t.platform).filter((p): p is string => !!p),
    ]),
  ];

  const handleAdd = () => {
    const name = `template-${nodeTemplates.length + 1}`;
    addNodeTemplate({
      name,
      labels: {
        'eda.nokia.com/role': 'leaf',
        'eda.nokia.com/security-profile': 'managed',
      },
    });
    triggerYamlRefresh();
  };

  const handleUpdate = (
    templateName: string,
    update: Partial<NodeTemplate>,
  ) => {
    const success = updateNodeTemplate(templateName, update);
    if (success) triggerYamlRefresh();
    return success;
  };

  const handleDelete = (templateName: string) => {
    deleteNodeTemplate(templateName);
    triggerYamlRefresh();
  };

  return (
    <Box>
      <PanelHeader
        title="Node Templates"
        actions={
          <Button size="small" startIcon={<AddIcon />} onClick={handleAdd}>
            Add
          </Button>
        }
      />

      {nodeTemplates.length === 0 ? (
        <Typography color="text.secondary" textAlign="center" py="1rem">
          No templates
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {nodeTemplates.map(t => (
            <NodeTemplateEditor
              key={t.name}
              template={t}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              existingNodeProfiles={existingNodeProfiles}
              existingPlatforms={existingPlatforms}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}

// Individual link template editor to maintain stable local state for text fields
function LinkTemplateEditor({
  template,
  onUpdate,
  onDelete,
}: {
  template: LinkTemplate;
  onUpdate: (name: string, update: Partial<LinkTemplate>) => boolean;
  onDelete: (name: string) => void;
}) {
  const [localName, setLocalName] = useState(template.name);

  // Sync local state when template changes from external source
  useEffect(() => {
    setLocalName(template.name);
  }, [template.name]);

  const handleNameBlur = createNameBlurHandler(template.name, localName, setLocalName, onUpdate);
  const { handleAddLabel, handleUpdateLabel, handleDeleteLabel } = createTemplateLabelHandlers(template, onUpdate);

  return (
    <PanelCard>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            gap: '0.5rem',
            alignItems: 'center',
          }}
        >
          <TextField
            label="Name"
            size="small"
            value={localName}
            onChange={e => { setLocalName(e.target.value); }}
            onBlur={handleNameBlur}
            fullWidth
          />
          <IconButton size="small" onClick={() => { onDelete(template.name); }}>
            <DeleteIcon fontSize="small" color="error" />
          </IconButton>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
          <FormControl size="small" fullWidth>
            <InputLabel>Type</InputLabel>
            <Select
              label="Type"
              value={template.type || 'interSwitch'}
              onChange={e =>
                onUpdate(template.name, { type: e.target.value as LinkType })
              }
            >
              <MenuItem value="interSwitch">interSwitch</MenuItem>
              <MenuItem value="edge">edge</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" fullWidth>
            <InputLabel>Speed</InputLabel>
            <Select
              label="Speed"
              value={template.speed || ''}
              onChange={e =>
                onUpdate(template.name, { speed: e.target.value as LinkSpeed })
              }
            >
              <MenuItem value="">None</MenuItem>
              <MenuItem value="400G">400G</MenuItem>
              <MenuItem value="100G">100G</MenuItem>
              <MenuItem value="25G">25G</MenuItem>
              <MenuItem value="10G">10G</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" fullWidth>
            <InputLabel>Encap</InputLabel>
            <Select
              label="Encap"
              value={template.encapType || ''}
              onChange={e =>
                onUpdate(template.name, {
                  encapType: e.target.value as EncapType,
                })
              }
            >
              <MenuItem value="">None</MenuItem>
              <MenuItem value="null">null</MenuItem>
              <MenuItem value="dot1q">dot1q</MenuItem>
            </Select>
          </FormControl>
        </Box>

        <Box>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: '0.5rem',
            }}
          >
            <Typography variant="body2" fontWeight={600}>
              Labels
            </Typography>
            <Button size="small" startIcon={<AddIcon />} onClick={handleAddLabel}>
              Add
            </Button>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: '65fr 35fr auto', gap: '0.5rem', alignItems: 'center' }}>
              <TextField
                size="small"
                label="Key"
                value="eda.nokia.com/role"
                disabled
                fullWidth
              />
              <TextField
                size="small"
                label="Value"
                value={template.type || 'interSwitch'}
                disabled
                fullWidth
              />
              <Box sx={{ width: 32 }} />
            </Box>
            {Object.entries(template.labels || {})
              .filter(([key]) => key !== 'eda.nokia.com/role')
              .map(([key, value]) => (
                <LabelEditor
                  key={key}
                  labelKey={key}
                  labelValue={value}
                  onUpdate={(newKey, newValue) =>
                  { handleUpdateLabel(key, newKey, newValue); }
                  }
                  onDelete={() => { handleDeleteLabel(key); }}
                  disableSuggestions
                />
              ))}
          </Box>
        </Box>
      </Box>
    </PanelCard>
  );
}

export function LinkTemplatesPanel() {
  const linkTemplates = useTopologyStore(state => state.linkTemplates);
  const addLinkTemplate = useTopologyStore(state => state.addLinkTemplate);
  const updateLinkTemplate = useTopologyStore(
    state => state.updateLinkTemplate,
  );
  const deleteLinkTemplate = useTopologyStore(
    state => state.deleteLinkTemplate,
  );
  const triggerYamlRefresh = useTopologyStore(
    state => state.triggerYamlRefresh,
  );

  const handleAdd = () => {
    const name = `link-template-${linkTemplates.length + 1}`;
    addLinkTemplate({ name, type: 'interSwitch' });
    triggerYamlRefresh();
  };

  const handleUpdate = (
    templateName: string,
    update: Partial<LinkTemplate>,
  ) => {
    const success = updateLinkTemplate(templateName, update);
    if (success) triggerYamlRefresh();
    return success;
  };

  const handleDelete = (templateName: string) => {
    deleteLinkTemplate(templateName);
    triggerYamlRefresh();
  };

  return (
    <Box>
      <PanelHeader
        title="Link Templates"
        actions={
          <Button size="small" startIcon={<AddIcon />} onClick={handleAdd}>
            Add
          </Button>
        }
      />

      {linkTemplates.length === 0 ? (
        <Typography color="text.secondary" textAlign="center" py="1rem">
          No templates
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {linkTemplates.map(t => (
            <LinkTemplateEditor
              key={t.name}
              template={t}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}

// SimNode Template editor component
function SimNodeTemplateEditor({
  template,
  onUpdate,
  onDelete,
}: {
  template: SimNodeTemplate;
  onUpdate: (name: string, update: Partial<SimNodeTemplate>) => boolean;
  onDelete: (name: string) => void;
}) {
  const [localName, setLocalName] = useState(template.name);
  const [localImage, setLocalImage] = useState(template.image || '');
  const [localImagePullSecret, setLocalImagePullSecret] = useState(
    template.imagePullSecret || '',
  );

  useEffect(() => {
    setLocalName(template.name);
    setLocalImage(template.image || '');
    setLocalImagePullSecret(template.imagePullSecret || '');
  }, [template]);

  const handleNameBlur = createNameBlurHandler(template.name, localName, setLocalName, onUpdate);

  return (
    <PanelCard>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            gap: '0.5rem',
            alignItems: 'center',
          }}
        >
          <TextField
            label="Name"
            size="small"
            value={localName}
            onChange={e => { setLocalName(e.target.value); }}
            onBlur={handleNameBlur}
            fullWidth
          />
          <IconButton size="small" onClick={() => { onDelete(template.name); }}>
            <DeleteIcon fontSize="small" color="error" />
          </IconButton>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.5rem' }}>
          <FormControl size="small" fullWidth>
            <InputLabel>Type</InputLabel>
            <Select
              label="Type"
              value={template.type}
              onChange={e =>
                onUpdate(template.name, { type: e.target.value as SimNodeType })
              }
            >
              <MenuItem value="Linux">Linux</MenuItem>
              <MenuItem value="TestMan">TestMan</MenuItem>
              <MenuItem value="SrlTest">SrlTest</MenuItem>
            </Select>
          </FormControl>
          <TextField
            label="Image"
            size="small"
            value={localImage}
            onChange={e => { setLocalImage(e.target.value); }}
            onBlur={() =>
              onUpdate(template.name, { image: localImage || undefined })
            }
            fullWidth
          />
        </Box>

        <TextField
          label="Image Pull Secret"
          size="small"
          value={localImagePullSecret}
          onChange={e => { setLocalImagePullSecret(e.target.value); }}
          onBlur={() =>
            onUpdate(template.name, {
              imagePullSecret: localImagePullSecret || undefined,
            })
          }
          fullWidth
        />
      </Box>
    </PanelCard>
  );
}

export function SimNodeTemplatesPanel() {
  const simulation = useTopologyStore(state => state.simulation);
  const addSimNodeTemplate = useTopologyStore(
    state => state.addSimNodeTemplate,
  );
  const updateSimNodeTemplate = useTopologyStore(
    state => state.updateSimNodeTemplate,
  );
  const deleteSimNodeTemplate = useTopologyStore(
    state => state.deleteSimNodeTemplate,
  );

  const simNodeTemplates = simulation.simNodeTemplates || [];

  const handleAddLinux = () => {
    const name = `linux-${simNodeTemplates.length + 1}`;
    addSimNodeTemplate({ name, type: 'Linux' });
  };

  const handleAddTestMan = () => {
    const name = `testman-${simNodeTemplates.length + 1}`;
    addSimNodeTemplate({ name, type: 'TestMan' });
  };

  const handleUpdateTemplate = (
    templateName: string,
    update: Partial<SimNodeTemplate>,
  ) => {
    return updateSimNodeTemplate(templateName, update);
  };

  const handleDeleteTemplate = (templateName: string) => {
    deleteSimNodeTemplate(templateName);
  };

  return (
    <Box>
      <PanelHeader
        title="SimNode Templates"
        actions={
          <Box>
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={handleAddLinux}
              sx={{ mr: '0.25rem' }}
            >
              Linux
            </Button>
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={handleAddTestMan}
            >
              TestMan
            </Button>
          </Box>
        }
      />

      {simNodeTemplates.length === 0 ? (
        <Typography color="text.secondary" textAlign="center" py="1rem">
          No sim templates
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {simNodeTemplates.map(t => (
            <SimNodeTemplateEditor
              key={t.name}
              template={t}
              onUpdate={handleUpdateTemplate}
              onDelete={handleDeleteTemplate}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}
