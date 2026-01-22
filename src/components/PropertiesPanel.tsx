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
  useTheme,
} from "@mui/material";
import { Delete as DeleteIcon, Add as AddIcon } from "@mui/icons-material";
import { useTopologyStore } from "../lib/store";
import {
  NODE_PROFILE_SUGGESTIONS,
  PLATFORM_SUGGESTIONS,
} from "../lib/constants";
import type {
  MemberLink,
  TopologyNodeData,
  NodeTemplate,
  LinkTemplate,
  EdgeLink,
  LinkType,
  LinkSpeed,
  EncapType,
  SimNodeTemplate,
  SimNodeType,
} from "../types/topology";

export function SelectionPanel() {
  const selectedNodeId = useTopologyStore((state) => state.selectedNodeId);
  const selectedEdgeId = useTopologyStore((state) => state.selectedEdgeId);
  const selectedEdgeLinkIndex = useTopologyStore(
    (state) => state.selectedEdgeLinkIndex,
  );
  const selectedSimNodeName = useTopologyStore(
    (state) => state.selectedSimNodeName,
  );
  const nodes = useTopologyStore((state) => state.nodes);
  const edges = useTopologyStore((state) => state.edges);
  const nodeTemplates = useTopologyStore((state) => state.nodeTemplates);
  const linkTemplates = useTopologyStore((state) => state.linkTemplates);
  const edgeLinks = useTopologyStore((state) => state.edgeLinks);
  const simulation = useTopologyStore((state) => state.simulation);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const selectedEdge = edges.find((e) => e.id === selectedEdgeId);
  const selectedSimNode = simulation.simNodes.find(
    (n) => n.name === selectedSimNodeName,
  );
  const updateNode = useTopologyStore((state) => state.updateNode);
  const updateEdge = useTopologyStore((state) => state.updateEdge);
  const updateEdgeLink = useTopologyStore((state) => state.updateEdgeLink);
  const deleteEdgeLink = useTopologyStore((state) => state.deleteEdgeLink);
  const updateSimNode = useTopologyStore((state) => state.updateSimNode);
  const triggerYamlRefresh = useTopologyStore(
    (state) => state.triggerYamlRefresh,
  );

  // Ref for node name input to auto-focus and select
  const nodeNameInputRef = useRef<HTMLInputElement>(null);
  const prevSelectedNodeIdRef = useRef<string | null>(null);

  const linkNameInputRef = useRef<HTMLInputElement>(null);

  // Count selected items
  const selectedNodesCount = nodes.filter((n) => n.selected).length;
  const selectedEdgesCount = edges.filter((e) => e.selected).length;
  const totalSelected = selectedNodesCount + selectedEdgesCount;

  // Auto-focus and select node name when a new node is selected
  useEffect(() => {
    if (selectedNodeId && selectedNodeId !== prevSelectedNodeIdRef.current) {
      // Small delay to ensure the input is rendered
      setTimeout(() => {
        if (nodeNameInputRef.current) {
          nodeNameInputRef.current.focus();
          nodeNameInputRef.current.select();
        }
      }, 50);
    }
    prevSelectedNodeIdRef.current = selectedNodeId;
  }, [selectedNodeId]);

  // Don't show properties panel when multiple items are selected
  if (totalSelected > 1) {
    return null;
  }

  // Handle edge link selection (via stub click)
  if (selectedEdgeLinkIndex !== null && edgeLinks[selectedEdgeLinkIndex]) {
    const link = edgeLinks[selectedEdgeLinkIndex];

    const handleUpdateEdgeLinkField = (update: Partial<EdgeLink>) => {
      updateEdgeLink(selectedEdgeLinkIndex, { ...link, ...update });
      triggerYamlRefresh();
    };

    const handleUpdateEdgeLinkEndpoint = (
      field: "interface" | "simNode" | "simNodeInterface",
      value: string,
    ) => {
      const currentEndpoint = link.endpoints[0] || {
        local: { node: "", interface: "" },
      };

      if (field === "interface") {
        updateEdgeLink(selectedEdgeLinkIndex, {
          ...link,
          endpoints: [
            {
              ...currentEndpoint,
              local: { ...currentEndpoint.local, interface: value },
            },
          ],
        });
      } else if (field === "simNode") {
        updateEdgeLink(selectedEdgeLinkIndex, {
          ...link,
          endpoints: [
            {
              ...currentEndpoint,
              sim: value
                ? {
                    simNode: value,
                    simNodeInterface: currentEndpoint.sim?.simNodeInterface,
                  }
                : undefined,
            },
          ],
        });
      } else if (field === "simNodeInterface") {
        updateEdgeLink(selectedEdgeLinkIndex, {
          ...link,
          endpoints: [
            {
              ...currentEndpoint,
              sim: currentEndpoint.sim?.simNode
                ? {
                    ...currentEndpoint.sim,
                    simNodeInterface: value || undefined,
                  }
                : undefined,
            },
          ],
        });
      }
      triggerYamlRefresh();
    };

    const handleDeleteEdgeLinkClick = () => {
      deleteEdgeLink(selectedEdgeLinkIndex);
      triggerYamlRefresh();
    };

    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <Typography variant="subtitle2" fontWeight={600}>
          Edge Link
        </Typography>

        <TextField
          label="Link Name"
          size="small"
          value={link.name}
          onChange={(e) => handleUpdateEdgeLinkField({ name: e.target.value })}
          fullWidth
        />

        <TextField
          label="Node"
          size="small"
          value={link.endpoints[0]?.local?.node || ""}
          disabled
          fullWidth
        />

        <FormControl size="small" fullWidth>
          <InputLabel>Template</InputLabel>
          <Select
            label="Template"
            value={link.template || ""}
            onChange={(e) =>
              handleUpdateEdgeLinkField({ template: e.target.value })
            }
          >
            <MenuItem value="">None</MenuItem>
            {linkTemplates.map((t) => (
              <MenuItem key={t.name} value={t.name}>
                {t.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          label="Interface"
          size="small"
          value={link.endpoints[0]?.local?.interface || ""}
          onChange={(e) =>
            handleUpdateEdgeLinkEndpoint("interface", e.target.value)
          }
          fullWidth
        />

        <Typography
          variant="body2"
          color="text.secondary"
          fontWeight={600}
          sx={{ mt: 1 }}
        >
          Sim Connection
        </Typography>

        <FormControl size="small" fullWidth>
          <InputLabel>SimNode</InputLabel>
          <Select
            label="SimNode"
            value={link.endpoints[0]?.sim?.simNode || ""}
            onChange={(e) =>
              handleUpdateEdgeLinkEndpoint("simNode", e.target.value)
            }
          >
            <MenuItem value="">None</MenuItem>
            {simulation.simNodes.map((s) => (
              <MenuItem key={s.name} value={s.name}>
                {s.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {link.endpoints[0]?.sim?.simNode && (
          <TextField
            label="SimNode Interface"
            size="small"
            value={link.endpoints[0]?.sim?.simNodeInterface || ""}
            onChange={(e) =>
              handleUpdateEdgeLinkEndpoint("simNodeInterface", e.target.value)
            }
            fullWidth
            placeholder="e.g., eth1"
          />
        )}

        <Button
          variant="outlined"
          color="error"
          size="small"
          startIcon={<DeleteIcon />}
          onClick={handleDeleteEdgeLinkClick}
        >
          Delete Edge Link
        </Button>
      </Box>
    );
  }

  if (selectedNode) {
    const nodeData = selectedNode.data;
    // Filter edge links for this node
    const nodeEdgeLinks = edgeLinks
      .map((el, index) => ({ el, index }))
      .filter(({ el }) => el.endpoints[0]?.local?.node === nodeData.name);

    const handleUpdateNodeField = (update: Partial<TopologyNodeData>) => {
      updateNode(selectedNode.id, update);
      triggerYamlRefresh();
    };

    const handleUpdateEdgeLinkField = (
      globalIndex: number,
      update: Partial<EdgeLink>,
    ) => {
      const currentLink = edgeLinks[globalIndex];
      updateEdgeLink(globalIndex, { ...currentLink, ...update });
      triggerYamlRefresh();
    };

    const handleUpdateEdgeLinkEndpoint = (
      globalIndex: number,
      field: "interface" | "simNode" | "simNodeInterface",
      value: string,
    ) => {
      const currentLink = edgeLinks[globalIndex];
      const currentEndpoint = currentLink.endpoints[0] || {
        local: { node: "", interface: "" },
      };

      if (field === "interface") {
        updateEdgeLink(globalIndex, {
          ...currentLink,
          endpoints: [
            {
              ...currentEndpoint,
              local: { ...currentEndpoint.local, interface: value },
            },
          ],
        });
      } else if (field === "simNode") {
        updateEdgeLink(globalIndex, {
          ...currentLink,
          endpoints: [
            {
              ...currentEndpoint,
              sim: value
                ? {
                    simNode: value,
                    simNodeInterface: currentEndpoint.sim?.simNodeInterface,
                  }
                : undefined,
            },
          ],
        });
      } else if (field === "simNodeInterface") {
        updateEdgeLink(globalIndex, {
          ...currentLink,
          endpoints: [
            {
              ...currentEndpoint,
              sim: currentEndpoint.sim?.simNode
                ? {
                    ...currentEndpoint.sim,
                    simNodeInterface: value || undefined,
                  }
                : undefined,
            },
          ],
        });
      }
      triggerYamlRefresh();
    };

    const handleDeleteEdgeLinkClick = (globalIndex: number) => {
      deleteEdgeLink(globalIndex);
      triggerYamlRefresh();
    };

    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <Typography variant="subtitle2" fontWeight={600}>
          Node: {nodeData.name}
        </Typography>

        <TextField
          label="Name"
          size="small"
          value={nodeData.name || ""}
          onChange={(e) => handleUpdateNodeField({ name: e.target.value })}
          fullWidth
          inputRef={nodeNameInputRef}
        />

        <FormControl size="small" fullWidth>
          <InputLabel>Template</InputLabel>
          <Select
            label="Template"
            value={nodeData.template || ""}
            onChange={(e) =>
              handleUpdateNodeField({ template: e.target.value || undefined })
            }
          >
            <MenuItem value="">None</MenuItem>
            {nodeTemplates.map((t) => (
              <MenuItem key={t.name} value={t.name}>
                {t.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {nodeEdgeLinks.length > 0 && (
          <>
            <Typography variant="subtitle2" fontWeight={600} sx={{ mt: 1 }}>
              Edge Links
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {nodeEdgeLinks.map(({ el: link, index: globalIndex }) => (
                <Paper key={globalIndex} variant="outlined" sx={{ p: 1 }}>
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      mb: 1,
                    }}
                  >
                    <TextField
                      label="Link Name"
                      size="small"
                      value={link.name}
                      onChange={(e) =>
                        handleUpdateEdgeLinkField(globalIndex, {
                          name: e.target.value,
                        })
                      }
                      sx={{ flex: 1, mr: 1 }}
                    />
                    <IconButton
                      size="small"
                      onClick={() => handleDeleteEdgeLinkClick(globalIndex)}
                    >
                      <DeleteIcon fontSize="small" color="error" />
                    </IconButton>
                  </Box>
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 1,
                      mb: 1,
                    }}
                  >
                    <FormControl size="small" fullWidth>
                      <InputLabel>Template</InputLabel>
                      <Select
                        label="Template"
                        value={link.template || ""}
                        onChange={(e) =>
                          handleUpdateEdgeLinkField(globalIndex, {
                            template: e.target.value,
                          })
                        }
                      >
                        <MenuItem value="">None</MenuItem>
                        {linkTemplates.map((t) => (
                          <MenuItem key={t.name} value={t.name}>
                            {t.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <TextField
                      label="Interface"
                      size="small"
                      value={link.endpoints[0]?.local?.interface || ""}
                      onChange={(e) =>
                        handleUpdateEdgeLinkEndpoint(
                          globalIndex,
                          "interface",
                          e.target.value,
                        )
                      }
                      fullWidth
                    />
                  </Box>
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 1,
                    }}
                  >
                    <FormControl size="small" fullWidth>
                      <InputLabel>SimNode</InputLabel>
                      <Select
                        label="SimNode"
                        value={link.endpoints[0]?.sim?.simNode || ""}
                        onChange={(e) =>
                          handleUpdateEdgeLinkEndpoint(
                            globalIndex,
                            "simNode",
                            e.target.value,
                          )
                        }
                      >
                        <MenuItem value="">None</MenuItem>
                        {simulation.simNodes.map((s) => (
                          <MenuItem key={s.name} value={s.name}>
                            {s.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <TextField
                      label="SimNode Interface"
                      size="small"
                      value={link.endpoints[0]?.sim?.simNodeInterface || ""}
                      onChange={(e) =>
                        handleUpdateEdgeLinkEndpoint(
                          globalIndex,
                          "simNodeInterface",
                          e.target.value,
                        )
                      }
                      fullWidth
                      placeholder="e.g., eth1"
                      disabled={!link.endpoints[0]?.sim?.simNode}
                    />
                  </Box>
                </Paper>
              ))}
            </Box>
          </>
        )}
      </Box>
    );
  }

  if (selectedEdge && selectedEdge.data) {
    const edgeData = selectedEdge.data;
    const memberLinks = edgeData.memberLinks || [];
    const isNewLink = sessionStorage.getItem('topology-is-new-link') === 'true';

    const handleAddLink = () => {
      const newLink: MemberLink = {
        name: `${edgeData.sourceNode}-${edgeData.targetNode}-${memberLinks.length + 1}`,
        template:
          linkTemplates.find((t) => t.type === "interSwitch")?.name || "isl",
        sourceInterface: `ethernet-1-${memberLinks.length + 1}`,
        targetInterface: `ethernet-1-${memberLinks.length + 1}`,
      };
      updateEdge(selectedEdge.id, { memberLinks: [...memberLinks, newLink] });
      triggerYamlRefresh();
    };

    const handleUpdateLink = (index: number, update: Partial<MemberLink>) => {
      const newLinks = memberLinks.map((link, i) =>
        i === index ? { ...link, ...update } : link,
      );
      updateEdge(selectedEdge.id, { memberLinks: newLinks });
      triggerYamlRefresh();
    };

    const handleDeleteLink = (index: number) => {
      const newLinks = memberLinks.filter((_, i) => i !== index);
      updateEdge(selectedEdge.id, { memberLinks: newLinks });
      triggerYamlRefresh();
    };

    return (
      <Box>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 1,
          }}
        >
          <Typography variant="subtitle2" fontWeight={600}>
            {edgeData.sourceNode} ↔ {edgeData.targetNode}
          </Typography>
          <Button size="small" startIcon={<AddIcon />} onClick={handleAddLink}>
            Add Link
          </Button>
        </Box>

        {memberLinks.length === 0 ? (
          <Typography color="text.secondary" textAlign="center" py={2}>
            No member links
          </Typography>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {memberLinks.map((link, index) => (
              <Paper key={index} variant="outlined" sx={{ p: 1 }}>
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    mb: 1,
                  }}
                >
                  <TextField
                    label="Link Name"
                    size="small"
                    value={link.name}
                    onChange={(e) =>
                      handleUpdateLink(index, { name: e.target.value })
                    }
                    sx={{ flex: 1, mr: 1 }}
                    inputRef={index === 0 ? linkNameInputRef : undefined}
                    autoFocus={index === 0 && isNewLink}
                    onFocus={(e) => {
                      if (index === 0 && isNewLink) {
                        e.target.select();
                      }
                    }}
                  />
                  <IconButton
                    size="small"
                    onClick={() => handleDeleteLink(index)}
                  >
                    <DeleteIcon fontSize="small" color="error" />
                  </IconButton>
                </Box>

                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr",
                    gap: 1,
                  }}
                >
                  <FormControl size="small" fullWidth>
                    <InputLabel>Template</InputLabel>
                    <Select
                      label="Template"
                      value={link.template || ""}
                      onChange={(e) =>
                        handleUpdateLink(index, { template: e.target.value })
                      }
                    >
                      <MenuItem value="">None</MenuItem>
                      {linkTemplates.map((t) => (
                        <MenuItem key={t.name} value={t.name}>
                          {t.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <TextField
                    label={`${edgeData.sourceNode} Interface`}
                    size="small"
                    value={link.sourceInterface}
                    onChange={(e) =>
                      handleUpdateLink(index, {
                        sourceInterface: e.target.value,
                      })
                    }
                    fullWidth
                  />

                  <TextField
                    label={`${edgeData.targetNode} Interface`}
                    size="small"
                    value={link.targetInterface}
                    onChange={(e) =>
                      handleUpdateLink(index, {
                        targetInterface: e.target.value,
                      })
                    }
                    fullWidth
                  />
                </Box>
              </Paper>
            ))}
          </Box>
        )}
      </Box>
    );
  }

  // Handle sim node selection
  if (selectedSimNode) {
    return (
      <SimNodeSelectionEditor
        simNode={selectedSimNode}
        simNodeTemplates={simulation.simNodeTemplates}
        onUpdate={(update) => {
          updateSimNode(selectedSimNode.name, update);
          triggerYamlRefresh();
        }}
      />
    );
  }

  return (
    <Typography color="text.secondary" textAlign="center" py={2}>
      Select a node or link
    </Typography>
  );
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
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
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

  const handleNameBlur = () => {
    const success = onUpdate(template.name, { name: localName });
    if (!success) {
      setLocalName(template.name); // Revert on failure
    }
  };

  const handleAddLabel = () => {
    // Find a unique key
    let counter = 1;
    let newKey = `eda.nokia.com/label-${counter}`;
    while (template.labels?.[newKey]) {
      counter++;
      newKey = `eda.nokia.com/label-${counter}`;
    }
    onUpdate(template.name, {
      labels: {
        ...template.labels,
        [newKey]: "",
      },
    });
  };

  const handleUpdateLabel = (oldKey: string, newKey: string, value: string) => {
    const newLabels = { ...template.labels };
    if (oldKey !== newKey) {
      delete newLabels[oldKey];
    }
    newLabels[newKey] = value;
    onUpdate(template.name, { labels: newLabels });
  };

  const handleDeleteLabel = (key: string) => {
    const newLabels = { ...template.labels };
    delete newLabels[key];
    onUpdate(template.name, { labels: newLabels });
  };

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        bgcolor: isDark ? "#262626" : "#f5f5f5",
        borderColor: isDark ? "#3d3d3d" : "#e0e0e0",
        "&:hover": {
          borderColor: isDark ? "#525252" : "#bdbdbd",
        },
      }}
    >
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 1,
        }}
      >
        <TextField
          label="Name"
          size="small"
          value={localName}
          onChange={(e) => setLocalName(e.target.value)}
          onBlur={handleNameBlur}
          sx={{ flex: 1, mr: 1 }}
        />
        <IconButton size="small" onClick={() => onDelete(template.name)}>
          <DeleteIcon fontSize="small" color="error" />
        </IconButton>
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
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

      {/* Labels Section */}
      <Box sx={{ mt: 1.5 }}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 1,
          }}
        >
          <Typography variant="body2" color="text.secondary" fontWeight={600}>
            Labels
          </Typography>
          <Button size="small" startIcon={<AddIcon />} onClick={handleAddLabel}>
            Add
          </Button>
        </Box>
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
    </Paper>
  );
}

const SPECIAL_LABELS: Record<string, string[]> = {
  "eda.nokia.com/role": ["leaf", "spine", "borderleaf", "superspine"],
  "eda.nokia.com/security-profile": ["managed"],
};

// Label key/value editor component
function LabelEditor({
  labelKey,
  labelValue,
  onUpdate,
  onDelete,
}: {
  labelKey: string;
  labelValue: string;
  onUpdate: (key: string, value: string) => void;
  onDelete: () => void;
}) {
  const [localKey, setLocalKey] = useState(labelKey);
  const [localValue, setLocalValue] = useState(labelValue);

  useEffect(() => {
    setLocalKey(labelKey);
    setLocalValue(labelValue);
  }, [labelKey, labelValue]);

  const isSpecialLabel = labelKey in SPECIAL_LABELS;
  const enumOptions = SPECIAL_LABELS[labelKey];

  return (
    <Box sx={{ display: "flex", gap: 1, mb: 1, alignItems: "center" }}>
      <TextField
        size="small"
        label="Key"
        value={localKey}
        onChange={(e) => setLocalKey(e.target.value)}
        onBlur={() => onUpdate(localKey, localValue)}
        sx={{ flex: 65 }}
        disabled={isSpecialLabel}
      />
      {isSpecialLabel ? (
        <Autocomplete
          freeSolo
          size="small"
          options={enumOptions}
          value={localValue}
          onInputChange={(_, value) => setLocalValue(value)}
          onBlur={() => onUpdate(localKey, localValue)}
          sx={{ flex: 35 }}
          renderInput={(params) => <TextField {...params} label="Value" />}
        />
      ) : (
        <TextField
          size="small"
          label="Value"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={() => onUpdate(localKey, localValue)}
          sx={{ flex: 35 }}
        />
      )}
      <Box sx={{ width: 32, display: "flex", justifyContent: "center" }}>
        {!isSpecialLabel && (
          <IconButton size="small" onClick={onDelete}>
            <DeleteIcon fontSize="small" color="error" />
          </IconButton>
        )}
      </Box>
    </Box>
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
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 1,
        }}
      >
        <Typography variant="subtitle2" fontWeight={600}>
          Node Templates
        </Typography>
        <Button size="small" startIcon={<AddIcon />} onClick={handleAdd}>
          Add
        </Button>
      </Box>

      {nodeTemplates.length === 0 ? (
        <Typography color="text.secondary" textAlign="center" py={2}>
          No templates
        </Typography>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
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
}: {
  template: LinkTemplate;
  onUpdate: (name: string, update: Partial<LinkTemplate>) => boolean;
  onDelete: (name: string) => void;
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const [localName, setLocalName] = useState(template.name);

  // Sync local state when template changes from external source
  useEffect(() => {
    setLocalName(template.name);
  }, [template.name]);

  const handleNameBlur = () => {
    const success = onUpdate(template.name, { name: localName });
    if (!success) {
      setLocalName(template.name); // Revert on failure
    }
  };

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        bgcolor: isDark ? "#262626" : "#f5f5f5",
        borderColor: isDark ? "#3d3d3d" : "#e0e0e0",
        "&:hover": {
          borderColor: isDark ? "#525252" : "#bdbdbd",
        },
      }}
    >
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 1,
        }}
      >
        <TextField
          label="Name"
          size="small"
          value={localName}
          onChange={(e) => setLocalName(e.target.value)}
          onBlur={handleNameBlur}
          sx={{ flex: 1, mr: 1 }}
        />
        <IconButton size="small" onClick={() => onDelete(template.name)}>
          <DeleteIcon fontSize="small" color="error" />
        </IconButton>
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1 }}>
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
    </Paper>
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
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 1,
        }}
      >
        <Typography variant="subtitle2" fontWeight={600}>
          Link Templates
        </Typography>
        <Button size="small" startIcon={<AddIcon />} onClick={handleAdd}>
          Add
        </Button>
      </Box>

      {linkTemplates.length === 0 ? (
        <Typography color="text.secondary" textAlign="center" py={2}>
          No templates
        </Typography>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
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
function SimNodeSelectionEditor({
  simNode,
  simNodeTemplates,
  onUpdate,
}: {
  simNode: { name: string; template?: string };
  simNodeTemplates: SimNodeTemplate[];
  onUpdate: (update: Partial<{ name: string; template?: string }>) => void;
}) {
  const [localName, setLocalName] = useState(simNode.name);

  useEffect(() => {
    setLocalName(simNode.name);
  }, [simNode.name]);

  const handleNameBlur = () => {
    if (localName !== simNode.name) {
      onUpdate({ name: localName });
    }
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Typography variant="subtitle2" fontWeight={600}>
        Sim Node: {simNode.name}
      </Typography>

      <TextField
        label="Name"
        size="small"
        value={localName}
        onChange={(e) => setLocalName(e.target.value)}
        onBlur={handleNameBlur}
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
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
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

  const handleNameBlur = () => {
    const success = onUpdate(template.name, { name: localName });
    if (!success) {
      setLocalName(template.name); // Revert on failure
    }
  };

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        bgcolor: isDark ? "#262626" : "#f5f5f5",
        borderColor: isDark ? "#3d3d3d" : "#e0e0e0",
        "&:hover": {
          borderColor: isDark ? "#525252" : "#bdbdbd",
        },
      }}
    >
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 1,
        }}
      >
        <TextField
          label="Name"
          size="small"
          value={localName}
          onChange={(e) => setLocalName(e.target.value)}
          onBlur={handleNameBlur}
          sx={{ flex: 1, mr: 1 }}
        />
        <IconButton size="small" onClick={() => onDelete(template.name)}>
          <DeleteIcon fontSize="small" color="error" />
        </IconButton>
      </Box>

      <Box
        sx={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 1, mb: 1 }}
      >
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
    </Paper>
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
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 1,
        }}
      >
        <Typography variant="subtitle2" fontWeight={600}>
          SimNode Templates
        </Typography>
        <Box>
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={handleAddLinux}
            sx={{ mr: 0.5 }}
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
      </Box>

      {simNodeTemplates.length === 0 ? (
        <Typography color="text.secondary" textAlign="center" py={2}>
          No sim templates
        </Typography>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
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
