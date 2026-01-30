import { useState, useEffect, useRef } from "react";
import {
  Box,
  Typography,
  TextField,
  Select,
  MenuItem,
  Button,
  IconButton,
  Paper,
  FormControl,
  InputLabel,
  Autocomplete,
  Chip,
} from "@mui/material";
import { Delete as DeleteIcon, Add as AddIcon } from "@mui/icons-material";
import type { Edge } from "@xyflow/react";

import { useTopologyStore } from "../lib/store";
import { formatName } from "../lib/utils";
import {
  NODE_PROFILE_SUGGESTIONS,
  PLATFORM_SUGGESTIONS,
} from "../lib/constants";
import type {
  NodeTemplate,
  LinkTemplate,
  LinkType,
  LinkSpeed,
  EncapType,
  SimNodeTemplate,
  SimNodeType,
  TopologyEdgeData,
} from "../types/topology";

import {
  createNameBlurHandler,
  createLabelHandlers,
  PanelHeader,
  PanelSection,
  PanelCard,
  LabelEditor,
} from "./PropertiesPanelShared";

// Individual template editor to maintain stable local state for text fields
function NodeTemplateEditor({
  template,
  onUpdate,
  onDelete,
  existingNodeProfiles,
  existingPlatforms,
}: Readonly<{
  template: NodeTemplate;
  onUpdate: (name: string, update: Partial<NodeTemplate>) => boolean;
  onDelete: (name: string) => void;
  existingNodeProfiles: string[];
  existingPlatforms: string[];
}>) {
  const [localName, setLocalName] = useState(template.name);
  const [localPlatform, setLocalPlatform] = useState(template.platform || "");
  const [localNodeProfile, setLocalNodeProfile] = useState(
    template.nodeProfile || "",
  );

  // Sync local state when template changes from external source
  useEffect(() => {
    setLocalName(template.name);
    setLocalPlatform(template.platform || "");
    setLocalNodeProfile(template.nodeProfile || "");
  }, [template]);

  const handleNameBlur = createNameBlurHandler(template, localName, setLocalName, onUpdate);
  const { handleAddLabel, handleUpdateLabel, handleDeleteLabel } = createLabelHandlers(template, onUpdate);

  return (
    <PanelCard highlighted>
      <Box sx={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: "0.5rem",
            alignItems: "center",
          }}
        >
          <TextField
            label="Name"
            size="small"
            value={localName}
            onChange={(e) => setLocalName(e.target.value)}
            onBlur={handleNameBlur}
            fullWidth
          />
          <IconButton size="small" onClick={() => onDelete(template.name)}>
            <DeleteIcon fontSize="small" color="error" />
          </IconButton>
        </Box>

        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
          <Autocomplete
            freeSolo
            size="small"
            options={existingPlatforms}
            value={localPlatform}
            onInputChange={(_, value) => setLocalPlatform(value)}
            onBlur={() => onUpdate(template.name, { platform: localPlatform })}
            renderInput={(params) => <TextField {...params} label="Platform" />}
          />
          <Autocomplete
            freeSolo
            size="small"
            options={existingNodeProfiles}
            value={localNodeProfile}
            onInputChange={(_, value) => setLocalNodeProfile(value)}
            onBlur={() =>
              onUpdate(template.name, { nodeProfile: localNodeProfile })
            }
            renderInput={(params) => (
              <TextField {...params} label="Node Profile" />
            )}
          />
        </Box>

        <Box>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              mb: "0.5rem",
            }}
          >
            <Typography variant="body2" fontWeight={600}>
              Labels
            </Typography>
            <Button size="small" startIcon={<AddIcon />} onClick={handleAddLabel}>
              Add
            </Button>
          </Box>
          <Box sx={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {Object.entries(template.labels || {}).map(([key, value]) => (
              <LabelEditor
                key={key}
                labelKey={key}
                labelValue={value}
                onUpdate={(newKey, newValue) =>
                  handleUpdateLabel(key, newKey, newValue)
                }
                onDelete={() => handleDeleteLabel(key)}
              />
            ))}
          </Box>
        </Box>
      </Box>
    </PanelCard>
  );
}

export function NodeTemplatesPanel() {
  const nodeTemplates = useTopologyStore((state) => state.nodeTemplates);
  const addNodeTemplate = useTopologyStore((state) => state.addNodeTemplate);
  const updateNodeTemplate = useTopologyStore(
    (state) => state.updateNodeTemplate,
  );
  const deleteNodeTemplate = useTopologyStore(
    (state) => state.deleteNodeTemplate,
  );
  const triggerYamlRefresh = useTopologyStore(
    (state) => state.triggerYamlRefresh,
  );

  const existingNodeProfiles = [
    ...new Set([
      ...NODE_PROFILE_SUGGESTIONS,
      ...nodeTemplates
        .map((t) => t.nodeProfile)
        .filter((p): p is string => !!p),
    ]),
  ];
  const existingPlatforms = [
    ...new Set([
      ...PLATFORM_SUGGESTIONS,
      ...nodeTemplates.map((t) => t.platform).filter((p): p is string => !!p),
    ]),
  ];

  const handleAdd = () => {
    const name = `template-${nodeTemplates.length + 1}`;
    addNodeTemplate({
      name,
      labels: {
        "eda.nokia.com/role": "leaf",
        "eda.nokia.com/security-profile": "managed",
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
        <Box sx={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {nodeTemplates.map((t) => (
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
}: Readonly<{
  template: LinkTemplate;
  onUpdate: (name: string, update: Partial<LinkTemplate>) => boolean;
  onDelete: (name: string) => void;
}>) {
  const [localName, setLocalName] = useState(template.name);

  // Sync local state when template changes from external source
  useEffect(() => {
    setLocalName(template.name);
  }, [template.name]);

  const handleNameBlur = createNameBlurHandler(template, localName, setLocalName, onUpdate);
  const { handleAddLabel, handleUpdateLabel, handleDeleteLabel } = createLabelHandlers(template, onUpdate);

  return (
    <PanelCard highlighted>
      <Box sx={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: "0.5rem",
            alignItems: "center",
          }}
        >
          <TextField
            label="Name"
            size="small"
            value={localName}
            onChange={(e) => setLocalName(e.target.value)}
            onBlur={handleNameBlur}
            fullWidth
          />
          <IconButton size="small" onClick={() => onDelete(template.name)}>
            <DeleteIcon fontSize="small" color="error" />
          </IconButton>
        </Box>

        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem" }}>
          <FormControl size="small" fullWidth>
            <InputLabel>Type</InputLabel>
            <Select
              label="Type"
              value={template.type || "interSwitch"}
              onChange={(e) =>
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
              value={template.speed || ""}
              onChange={(e) =>
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
              value={template.encapType || ""}
              onChange={(e) =>
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
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              mb: "0.5rem",
            }}
          >
            <Typography variant="body2" fontWeight={600}>
              Labels
            </Typography>
            <Button size="small" startIcon={<AddIcon />} onClick={handleAddLabel}>
              Add
            </Button>
          </Box>
          <Box sx={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "65fr 35fr auto",
                gap: "0.5rem",
                alignItems: "center",
              }}
            >
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
                value={template.type || "interSwitch"}
                disabled
                fullWidth
              />
              <Box sx={{ width: 32 }} />
            </Box>
            {Object.entries(template.labels || {})
              .filter(([key]) => key !== "eda.nokia.com/role")
              .map(([key, value]) => (
                <LabelEditor
                  key={key}
                  labelKey={key}
                  labelValue={value}
                  onUpdate={(newKey, newValue) =>
                    handleUpdateLabel(key, newKey, newValue)
                  }
                  onDelete={() => handleDeleteLabel(key)}
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
  const linkTemplates = useTopologyStore((state) => state.linkTemplates);
  const addLinkTemplate = useTopologyStore((state) => state.addLinkTemplate);
  const updateLinkTemplate = useTopologyStore(
    (state) => state.updateLinkTemplate,
  );
  const deleteLinkTemplate = useTopologyStore(
    (state) => state.deleteLinkTemplate,
  );
  const triggerYamlRefresh = useTopologyStore(
    (state) => state.triggerYamlRefresh,
  );

  const handleAdd = () => {
    const name = `link-template-${linkTemplates.length + 1}`;
    addLinkTemplate({ name, type: "interSwitch" });
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
        <Box sx={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {linkTemplates.map((t) => (
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

// SimNode selection editor with local state to prevent focus loss
export function SimNodeSelectionEditor({
  simNode,
  simNodeTemplates,
  connectedEdges,
  onUpdate,
}: Readonly<{
  simNode: { name: string; template?: string; id?: string };
  simNodeTemplates: SimNodeTemplate[];
  connectedEdges: Edge<TopologyEdgeData>[];
  onUpdate: (update: Partial<{ name: string; template?: string }>) => void;
}>) {
  const [localName, setLocalName] = useState(simNode.name);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalName(simNode.name);
  }, [simNode.name]);

  useEffect(() => {
    const handler = () => nameInputRef.current?.focus();
    window.addEventListener("focusNodeName", handler);
    return () => window.removeEventListener("focusNodeName", handler);
  }, []);

  const handleNameBlur = () => {
    if (localName !== simNode.name) {
      onUpdate({ name: localName });
      setTimeout(() => {
        const freshSimNodes = useTopologyStore.getState().simulation.simNodes;
        const currentSimNode = freshSimNodes.find((n) => n.id === simNode.id);
        if (currentSimNode && currentSimNode.name !== localName) {
          setLocalName(currentSimNode.name);
        }
      }, 50);
    }
  };

  return (
    <Box>
      <PanelHeader title={simNode.name} />

      <Box sx={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <TextField
          label="Name"
          size="small"
          value={localName}
          onChange={(e) => setLocalName(formatName(e.target.value))}
          onBlur={handleNameBlur}
          inputRef={nameInputRef}
          fullWidth
        />

        <FormControl size="small" fullWidth>
          <InputLabel>Template</InputLabel>
          <Select
            label="Template"
            value={simNode.template || ""}
            onChange={(e) => onUpdate({ template: e.target.value || undefined })}
          >
            <MenuItem value="">None</MenuItem>
            {simNodeTemplates.map((t) => (
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
          <Box sx={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {connectedEdges.flatMap((edge) => {
              const edgeData = edge.data;
              if (!edgeData) return [];
              const memberLinks = edgeData.memberLinks || [];
              const lagGroups = edgeData.lagGroups || [];
              const isEsiLag = edgeData.isMultihomed;
              const otherNode =
                edgeData.sourceNode === simNode.name
                  ? edgeData.targetNode
                  : edgeData.sourceNode;

              if (isEsiLag && edgeData.esiLeaves) {
                const esiName = memberLinks[0]?.name || `${edgeData.sourceNode}-esi-lag`;
                return [(
                  <Paper
                    key={edge.id}
                    variant="outlined"
                    sx={{
                      p: "0.5rem",
                      cursor: "pointer",
                      bgcolor: "var(--mui-palette-card-bg)",
                      borderColor: "var(--mui-palette-card-border)",
                    }}
                    onClick={() => useTopologyStore.getState().selectEdge(edge.id)}
                  >
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Typography variant="body2" fontWeight={500}>
                        {esiName}
                      </Typography>
                      <Chip label="ESI-LAG" size="small" sx={{ height: 16, fontSize: 10 }} color="primary" />
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {edgeData.esiLeaves.length} member links
                    </Typography>
                  </Paper>
                )];
              }

              const indicesInLags = new Set<number>();
              lagGroups.forEach((lag) => lag.memberLinkIndices.forEach((i) => indicesInLags.add(i)));

              const lagElements = lagGroups.map((lag) => (
                <Paper
                  key={lag.id}
                  variant="outlined"
                  sx={{
                    p: "0.5rem",
                    cursor: "pointer",
                    bgcolor: "var(--mui-palette-card-bg)",
                    borderColor: "var(--mui-palette-card-border)",
                  }}
                  onClick={() => {
                    useTopologyStore.getState().selectEdge(edge.id);
                    useTopologyStore.getState().selectLag(edge.id, lag.id);
                  }}
                >
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Typography variant="body2" fontWeight={500}>
                      {lag.name || `${simNode.name} ↔ ${otherNode}`}
                    </Typography>
                    <Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
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

              const standaloneLinks = memberLinks
                .map((link, idx) => ({ link, idx }))
                .filter(({ idx }) => !indicesInLags.has(idx))
                .map(({ link, idx }) => (
                  <Paper
                    key={`${edge.id}-${idx}`}
                    variant="outlined"
                    sx={{
                      p: "0.5rem",
                      cursor: "pointer",
                      bgcolor: "var(--mui-palette-card-bg)",
                      borderColor: "var(--mui-palette-card-border)",
                    }}
                    onClick={() => {
                      useTopologyStore.getState().selectEdge(edge.id);
                      useTopologyStore.getState().selectMemberLink(edge.id, idx, false);
                    }}
                  >
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Typography variant="body2" fontWeight={500}>
                        {link.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        → {otherNode}
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {link.sourceInterface} ↔ {link.targetInterface}
                    </Typography>
                  </Paper>
                ));

              return [...lagElements, ...standaloneLinks];
            })}
          </Box>
        </PanelSection>
      )}
    </Box>
  );
}

// SimNode Template editor component
function SimNodeTemplateEditor({
  template,
  onUpdate,
  onDelete,
}: Readonly<{
  template: SimNodeTemplate;
  onUpdate: (name: string, update: Partial<SimNodeTemplate>) => boolean;
  onDelete: (name: string) => void;
}>) {
  const [localName, setLocalName] = useState(template.name);
  const [localImage, setLocalImage] = useState(template.image || "");
  const [localImagePullSecret, setLocalImagePullSecret] = useState(
    template.imagePullSecret || "",
  );

  useEffect(() => {
    setLocalName(template.name);
    setLocalImage(template.image || "");
    setLocalImagePullSecret(template.imagePullSecret || "");
  }, [template]);

  const handleNameBlur = createNameBlurHandler(template, localName, setLocalName, onUpdate);

  return (
    <PanelCard highlighted>
      <Box sx={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: "0.5rem",
            alignItems: "center",
          }}
        >
          <TextField
            label="Name"
            size="small"
            value={localName}
            onChange={(e) => setLocalName(e.target.value)}
            onBlur={handleNameBlur}
            fullWidth
          />
          <IconButton size="small" onClick={() => onDelete(template.name)}>
            <DeleteIcon fontSize="small" color="error" />
          </IconButton>
        </Box>

        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "0.5rem" }}>
          <FormControl size="small" fullWidth>
            <InputLabel>Type</InputLabel>
            <Select
              label="Type"
              value={template.type}
              onChange={(e) =>
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
            onChange={(e) => setLocalImage(e.target.value)}
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
          onChange={(e) => setLocalImagePullSecret(e.target.value)}
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
  const simulation = useTopologyStore((state) => state.simulation);
  const addSimNodeTemplate = useTopologyStore(
    (state) => state.addSimNodeTemplate,
  );
  const updateSimNodeTemplate = useTopologyStore(
    (state) => state.updateSimNodeTemplate,
  );
  const deleteSimNodeTemplate = useTopologyStore(
    (state) => state.deleteSimNodeTemplate,
  );

  const simNodeTemplates = simulation.simNodeTemplates || [];

  const handleAddLinux = () => {
    const name = `linux-${simNodeTemplates.length + 1}`;
    addSimNodeTemplate({ name, type: "Linux" });
  };

  const handleAddTestMan = () => {
    const name = `testman-${simNodeTemplates.length + 1}`;
    addSimNodeTemplate({ name, type: "TestMan" });
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
              sx={{ mr: "0.25rem" }}
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
        <Box sx={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {simNodeTemplates.map((t) => (
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
