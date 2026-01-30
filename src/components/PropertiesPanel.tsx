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
  Chip,
} from "@mui/material";
import { Delete as DeleteIcon, Add as AddIcon, SubdirectoryArrowRight as ArrowIcon } from "@mui/icons-material";

import { useTopologyStore } from "../lib/store";
import { formatName } from "../lib/utils";
import {
  getInheritedNodeLabels,
  getInheritedLinkLabels,
  getInheritedLagLabels,
} from "../lib/labels";
import {
  DEFAULT_INTERFACE,
} from "../lib/constants";
import type {
  MemberLink,
  LagGroup,
  TopologyNodeData,
} from "../types/topology";

import {
  PanelHeader,
  PanelSection,
  EditableLabelsSection,
} from "./PropertiesPanelShared";
import { SimNodeSelectionEditor } from "./PropertiesTemplatesPanel";

export function SelectionPanel() {
  const selectedNodeId = useTopologyStore((state) => state.selectedNodeId);
  const selectedEdgeId = useTopologyStore((state) => state.selectedEdgeId);
  const selectedSimNodeName = useTopologyStore(
    (state) => state.selectedSimNodeName,
  );
  const selectedSimNodeNames = useTopologyStore(
    (state) => state.selectedSimNodeNames,
  );
  const selectedMemberLinkIndices = useTopologyStore(
    (state) => state.selectedMemberLinkIndices,
  );
  const selectedLagId = useTopologyStore((state) => state.selectedLagId);
  const expandedEdges = useTopologyStore((state) => state.expandedEdges);
  const nodes = useTopologyStore((state) => state.nodes);
  const edges = useTopologyStore((state) => state.edges);
  const nodeTemplates = useTopologyStore((state) => state.nodeTemplates);
  const linkTemplates = useTopologyStore((state) => state.linkTemplates);
  const simulation = useTopologyStore((state) => state.simulation);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const selectedEdge = edges.find((e) => e.id === selectedEdgeId);
  const selectedSimNode = simulation.simNodes.find(
    (n) => n.name === selectedSimNodeName,
  );
  const updateNode = useTopologyStore((state) => state.updateNode);
  const updateEdge = useTopologyStore((state) => state.updateEdge);
  const deleteEdge = useTopologyStore((state) => state.deleteEdge);
  const updateSimNode = useTopologyStore((state) => state.updateSimNode);
  const triggerYamlRefresh = useTopologyStore(
    (state) => state.triggerYamlRefresh,
  );

  // Ref for node name input to auto-focus and select
  const nodeNameInputRef = useRef<HTMLInputElement>(null);
  const prevSelectedNodeIdRef = useRef<string | null>(null);

  const [localNodeName, setLocalNodeName] = useState(selectedNode?.data.name || '');

  useEffect(() => {
    setLocalNodeName(selectedNode?.data.name || '');
  }, [selectedNode?.data.name, selectedNodeId]);

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

  // Count selected items
  const selectedNodesCount = nodes.filter((n) => n.selected).length;
  const selectedEdgesCount = edges.filter((e) => e.selected).length;
  const selectedSimNodesCount = selectedSimNodeNames.size;
  const selectedMemberLinksCount = selectedMemberLinkIndices.length;

  const hasMultipleSelected =
    selectedNodesCount > 1 ||
    selectedEdgesCount > 1 ||
    selectedSimNodesCount > 1 ||
    selectedMemberLinksCount > 1 ||
    (selectedNodesCount + selectedEdgesCount + selectedSimNodesCount) > 1;

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
    const newLinkId = sessionStorage.getItem('topology-new-link-id');
    if (selectedEdgeId && selectedEdgeId === newLinkId) {
      setTimeout(() => focusAtEnd(sourceInterfaceRef.current), 100);
      sessionStorage.removeItem('topology-new-link-id');
    }
    prevSelectedEdgeIdRef.current = selectedEdgeId;
  }, [selectedEdgeId]);

  useEffect(() => {
    const handler = () => focusAtEnd(nodeNameInputRef.current);
    window.addEventListener('focusNodeName', handler);
    return () => window.removeEventListener('focusNodeName', handler);
  }, []);

  // Don't show properties panel when multiple items are selected
  if (hasMultipleSelected) {
    return (
      <Typography color="text.secondary" textAlign="center" py="1rem">
        Select a node or link
      </Typography>
    );
  }

  if (selectedNode) {
    const nodeData = selectedNode.data;

    const handleUpdateNodeField = (update: Partial<TopologyNodeData>) => {
      updateNode(selectedNode.id, update);
      triggerYamlRefresh();
    };

    const handleNodeNameBlur = () => {
      if (localNodeName !== nodeData.name) {
        updateNode(selectedNode.id, { name: localNodeName });
        triggerYamlRefresh();
        setTimeout(() => {
          const freshNodes = useTopologyStore.getState().nodes;
          const currentNode = freshNodes.find(n => n.id === selectedNode.id);
          if (currentNode && currentNode.data.name !== localNodeName) {
            setLocalNodeName(currentNode.data.name);
          }
        }, 50);
      }
    };

    const connectedEdges = edges.filter(
      (e) => e.source === selectedNode.id || e.target === selectedNode.id
    );

    const simNodeEdges = edges.filter((e) => {
      if (e.source === selectedNode.id || e.target === selectedNode.id) return false;
      return (
        e.data?.sourceNode === nodeData.name || e.data?.targetNode === nodeData.name
      );
    });

    const esiLagEdges = edges.filter((e) => {
      if (connectedEdges.includes(e) || simNodeEdges.includes(e)) return false;
      return e.data?.esiLeaves?.some(leaf => leaf.nodeId === selectedNode.id || leaf.nodeName === nodeData.name);
    });

    const allConnectedEdges = [...connectedEdges, ...simNodeEdges, ...esiLagEdges];

    return (
      <Box>
        <PanelHeader title={nodeData.name} />

        <Box sx={{ display: "flex", flexDirection: "column", gap: '1rem' }}>
          <TextField
            label="Name"
            size="small"
            value={localNodeName}
            onChange={(e) => setLocalNodeName(formatName(e.target.value))}
            onBlur={handleNodeNameBlur}
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
          <EditableLabelsSection
            labels={nodeData.labels}
            inheritedLabels={getInheritedNodeLabels(selectedNode, nodeTemplates)}
            onUpdate={(labels) => handleUpdateNodeField({ labels })}
          />
        </Box>

        {allConnectedEdges.length > 0 && (
          <PanelSection
            title="Connected Links"
            count={allConnectedEdges.reduce((sum, e) => sum + (e.data?.memberLinks?.length || 0), 0)}
          >
            <Box sx={{ display: "flex", flexDirection: "column", gap: '0.5rem' }}>
              {allConnectedEdges.flatMap((edge) => {
                const edgeData = edge.data;
                if (!edgeData) return [];
                const memberLinks = edgeData.memberLinks || [];
                const lagGroups = edgeData.lagGroups || [];
                const isEsiLag = edgeData.isMultihomed;
                const otherNode = edgeData.sourceNode === nodeData.name
                  ? edgeData.targetNode
                  : edgeData.sourceNode;

                if (isEsiLag && edgeData.esiLeaves) {
                  const esiName = memberLinks[0]?.name || `${edgeData.sourceNode}-esi-lag`;
                  return [(
                    <Paper
                      key={edge.id}
                      variant="outlined"
                      sx={{ p: '0.5rem', cursor: "pointer", bgcolor: 'var(--mui-palette-card-bg)', borderColor: 'var(--mui-palette-card-border)' }}
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
                lagGroups.forEach(lag => lag.memberLinkIndices.forEach(i => indicesInLags.add(i)));

                const lagElements = lagGroups.map(lag => (
                  <Paper
                    key={lag.id}
                    variant="outlined"
                    sx={{ p: '0.5rem', cursor: "pointer", bgcolor: 'var(--mui-palette-card-bg)', borderColor: 'var(--mui-palette-card-border)' }}
                    onClick={() => {
                      useTopologyStore.getState().selectEdge(edge.id);
                      useTopologyStore.getState().selectLag(edge.id, lag.id);
                    }}
                  >
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Typography variant="body2" fontWeight={500}>
                        {lag.name || `${nodeData.name} ↔ ${otherNode}`}
                      </Typography>
                      <Box sx={{ display: "flex", alignItems: "center", gap: '0.25rem' }}>
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
                      sx={{ p: '0.5rem', cursor: "pointer", bgcolor: 'var(--mui-palette-card-bg)', borderColor: 'var(--mui-palette-card-border)' }}
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

  if (selectedEdge && selectedEdge.data) {
    const edgeData = selectedEdge.data;
    const memberLinks = edgeData.memberLinks || [];
    const lagGroups = edgeData.lagGroups || [];
    const isExpanded = expandedEdges.has(selectedEdge.id);

    const nodeA = edgeData.targetNode;
    const nodeB = edgeData.sourceNode;

    const handleUpdateLink = (index: number, update: Partial<MemberLink>) => {
      const newLinks = memberLinks.map((link, i) =>
        i === index ? { ...link, ...update } : link,
      );
      updateEdge(selectedEdge.id, { memberLinks: newLinks });
      triggerYamlRefresh();
    };

    const handleDeleteLink = (index: number) => {
      const newLinks = memberLinks.filter((_, i) => i !== index);

      if (newLinks.length === 0) {
        deleteEdge(selectedEdge.id);
        triggerYamlRefresh();
        return;
      }

      const newLagGroups = lagGroups.map(lag => ({
        ...lag,
        memberLinkIndices: lag.memberLinkIndices
          .filter(i => i !== index)
          .map(i => i > index ? i - 1 : i), // Adjust indices
      })).filter(lag => lag.memberLinkIndices.length > 0);

      updateEdge(selectedEdge.id, {
        memberLinks: newLinks,
        lagGroups: newLagGroups.length > 0 ? newLagGroups : undefined,
      });
      triggerYamlRefresh();
    };

    const handleUpdateLagGroup = (lagId: string, update: Partial<LagGroup>) => {
      const newLagGroups = lagGroups.map(lag =>
        lag.id === lagId ? { ...lag, ...update } : lag
      );
      updateEdge(selectedEdge.id, { lagGroups: newLagGroups });
      triggerYamlRefresh();
    };

    const selectedLag = selectedLagId ? lagGroups.find(lag => lag.id === selectedLagId) : null;

    const getLinksToShow = () => {
      if (isExpanded && memberLinks.length > 1) {
        if (selectedMemberLinkIndices.length > 0) {
          return selectedMemberLinkIndices
            .filter(i => i >= 0 && i < memberLinks.length)
            .map(i => ({ link: memberLinks[i], index: i }));
        }
        return [];
      }
      return memberLinks.map((link, index) => ({ link, index }));
    };
    const linksToShow = getLinksToShow();

    if (selectedLag) {
      const lagMemberLinksWithIndices = selectedLag.memberLinkIndices
        .filter(i => i >= 0 && i < memberLinks.length)
        .map(i => ({ link: memberLinks[i], index: i }));

      const addLinkToLag = useTopologyStore.getState().addLinkToLag;
      const removeLinkFromLag = useTopologyStore.getState().removeLinkFromLag;

      return (
        <Box>
          <PanelHeader
            title={`${nodeA} ↔ ${nodeB}`}
            actions={
              <Chip
                label="LAG"
                size="small"
                sx={{
                  height: 20,
                  fontSize: 10,
                  fontWeight: 600,
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                }}
              />
            }
          />

          <Box sx={{ display: "flex", flexDirection: "column", gap: '1rem' }}>
            <TextField
              label="Name"
              size="small"
              value={selectedLag.name || ""}
              onChange={(e) => handleUpdateLagGroup(selectedLag.id, { name: formatName(e.target.value) })}
              fullWidth
            />

            <FormControl size="small" fullWidth>
              <InputLabel>Template</InputLabel>
              <Select
                label="Template"
                value={selectedLag.template || ""}
                onChange={(e) => handleUpdateLagGroup(selectedLag.id, { template: e.target.value })}
              >
                <MenuItem value="">None</MenuItem>
                {linkTemplates.map((t) => (
                  <MenuItem key={t.name} value={t.name}>
                    {t.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <EditableLabelsSection
              labels={selectedLag.labels}
              inheritedLabels={getInheritedLagLabels(selectedLag, linkTemplates)}
              onUpdate={(labels) => handleUpdateLagGroup(selectedLag.id, { labels })}
            />
          </Box>

          <PanelSection
            title="Endpoints"
            count={lagMemberLinksWithIndices.length}
            actions={
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={() => addLinkToLag(selectedEdge.id, selectedLag.id)}
              >
                Add
              </Button>
            }
          >
            <Box sx={{ display: "flex", flexDirection: "column", gap: '0.5rem' }}>
              {lagMemberLinksWithIndices.map(({ link, index }, listIndex) => (
                <Paper
                  key={index}
                  variant="outlined"
                  sx={{ p: '0.5rem', bgcolor: 'var(--mui-palette-card-bg)', borderColor: 'var(--mui-palette-card-border)' }}
                >
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr auto",
                      gap: '0.5rem',
                      alignItems: "center",
                    }}
                  >
                    <TextField
                      label={nodeA}
                      size="small"
                      value={link.targetInterface}
                      onChange={(e) =>
                        handleUpdateLink(index, { targetInterface: e.target.value })
                      }
                      slotProps={{ input: { tabIndex: listIndex * 2 + 1 } }}
                      fullWidth
                    />
                    <TextField
                      label={nodeB}
                      size="small"
                      value={link.sourceInterface}
                      onChange={(e) =>
                        handleUpdateLink(index, { sourceInterface: e.target.value })
                      }
                      slotProps={{ input: { tabIndex: listIndex * 2 + 2 } }}
                      fullWidth
                    />
                    <IconButton
                      size="small"
                      onClick={() => removeLinkFromLag(selectedEdge.id, selectedLag.id, index)}
                      title={lagMemberLinksWithIndices.length <= 2 ? "Remove LAG (min 2 links)" : "Remove from LAG"}
                    >
                      <DeleteIcon fontSize="small" color="error" />
                    </IconButton>
                  </Box>
                </Paper>
              ))}
            </Box>
          </PanelSection>
        </Box>
      );
    }

    if (edgeData.isMultihomed && edgeData.esiLeaves) {
      const esiLeaves = edgeData.esiLeaves;
      const removeLinkFromEsiLag = useTopologyStore.getState().removeLinkFromEsiLag;

      return (
        <Box>
          <PanelHeader
            title={nodeB}
            actions={
              <Chip
                label="ESI-LAG"
                size="small"
                sx={{
                  height: 20,
                  fontSize: 10,
                  fontWeight: 600,
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                }}
              />
            }
          />

          <Box sx={{ pl: '1rem', mb: '1rem' }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.25rem' }}>
              {esiLeaves.map((leaf) => (
                <Box key={leaf.nodeId} sx={{ display: 'flex', alignItems: 'center', color: 'text.secondary' }}>
                  <ArrowIcon sx={{ fontSize: 16, mr: '0.25rem' }} />
                  <Typography variant="body2">{leaf.nodeName}</Typography>
                </Box>
              ))}
            </Box>
          </Box>

          <Box sx={{ display: "flex", flexDirection: "column", gap: '1rem' }}>
            <TextField
              label="Name"
              size="small"
              value={memberLinks[0]?.name || ""}
              onChange={(e) => {
                const newName = formatName(e.target.value);
                const newLinks = memberLinks.map((link, i) =>
                  i === 0 ? { ...link, name: newName } : link
                );
                updateEdge(selectedEdge.id, { memberLinks: newLinks });
                triggerYamlRefresh();
              }}
              fullWidth
            />

            <FormControl size="small" fullWidth>
              <InputLabel>Template</InputLabel>
              <Select
                label="Template"
                value={memberLinks[0]?.template || ""}
                onChange={(e) => {
                  const newTemplate = e.target.value;
                  const newLinks = memberLinks.map(link => ({ ...link, template: newTemplate }));
                  updateEdge(selectedEdge.id, { memberLinks: newLinks });
                  triggerYamlRefresh();
                }}
              >
                <MenuItem value="">None</MenuItem>
                {linkTemplates.map((t) => (
                  <MenuItem key={t.name} value={t.name}>
                    {t.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <EditableLabelsSection
              labels={memberLinks[0]?.labels}
              inheritedLabels={getInheritedLinkLabels(memberLinks[0], linkTemplates)}
              onUpdate={(labels) => {
                const newLinks = memberLinks.map((link, i) =>
                  i === 0 ? { ...link, labels } : link
                );
                updateEdge(selectedEdge.id, { memberLinks: newLinks });
                triggerYamlRefresh();
              }}
            />
          </Box>

          <PanelSection
            title="Endpoints"
            count={esiLeaves.length}
          >
            <Box sx={{ display: "flex", flexDirection: "column", gap: '0.5rem' }}>
              {esiLeaves.map((leaf, index) => {
                const memberLink = memberLinks[index];
                return (
                  <Paper
                    key={index}
                    variant="outlined"
                    sx={{ p: '0.5rem', bgcolor: 'var(--mui-palette-card-bg)', borderColor: 'var(--mui-palette-card-border)' }}
                  >
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr auto",
                        gap: '0.5rem',
                        alignItems: "center",
                      }}
                    >
                      <TextField
                        label={leaf.nodeName}
                        size="small"
                        value={memberLink?.targetInterface || ''}
                        onChange={(e) =>
                          handleUpdateLink(index, { targetInterface: e.target.value })
                        }
                        slotProps={{ input: { tabIndex: index * 2 + 1 } }}
                        fullWidth
                      />
                      <TextField
                        label={nodeB}
                        size="small"
                        value={memberLink?.sourceInterface || ''}
                        onChange={(e) =>
                          handleUpdateLink(index, { sourceInterface: e.target.value })
                        }
                        slotProps={{ input: { tabIndex: index * 2 + 2 } }}
                        fullWidth
                      />
                      <IconButton
                        size="small"
                        onClick={() => removeLinkFromEsiLag(selectedEdge.id, index)}
                        disabled={esiLeaves.length <= 2}
                        title={esiLeaves.length <= 2 ? "Minimum 2 links required" : "Remove endpoint"}
                      >
                        <DeleteIcon fontSize="small" color={esiLeaves.length <= 2 ? "disabled" : "error"} />
                      </IconButton>
                    </Box>
                  </Paper>
                );
              })}
            </Box>
          </PanelSection>
        </Box>
      );
    }

    const addMemberLink = useTopologyStore.getState().addMemberLink;
    const isShowingBundle = !isExpanded || memberLinks.length <= 1;

    const handleAddLink = () => {
      const lastLink = memberLinks[memberLinks.length - 1];
      const nextNum = memberLinks.length + 1;
      const incrementInterface = (iface: string) => {
        const interfaceRegex = /^(.*\D)(\d+)$/;
        const match = interfaceRegex.exec(iface);
        if (match) {
          return `${match[1]}${parseInt(match[2], 10) + 1}`;
        }
        return `${iface}-${nextNum}`;
      };
      addMemberLink(selectedEdge.id, {
        name: `${nodeB}-${nodeA}-${nextNum}`,
        template: lastLink?.template,
        sourceInterface: incrementInterface(lastLink?.sourceInterface || DEFAULT_INTERFACE),
        targetInterface: incrementInterface(lastLink?.targetInterface || DEFAULT_INTERFACE),
      });
      triggerYamlRefresh();
    };

    if (memberLinks.length === 0) {
      return (
        <Box>
          <PanelHeader title={`${nodeA} ↔ ${nodeB}`} />
          <Typography color="text.secondary" textAlign="center" py="1rem">
            No member links
          </Typography>
        </Box>
      );
    }

    if (linksToShow.length === 0) {
      return (
        <Box>
          <PanelHeader
            title={`${nodeA} ↔ ${nodeB}`}
            actions={
              <Button size="small" startIcon={<AddIcon />} onClick={handleAddLink}>
                Add
              </Button>
            }
          />
          <Typography color="text.secondary" textAlign="center" py="1rem">
            Select a link to edit
          </Typography>
        </Box>
      );
    }

    if (isShowingBundle && memberLinks.length > 1) {
      return (
        <Box>
          <PanelHeader
            title={`${nodeA} ↔ ${nodeB}`}
            actions={
              <Button size="small" startIcon={<AddIcon />} onClick={handleAddLink}>
                Add
              </Button>
            }
          />

          <Box sx={{ display: "flex", flexDirection: "column", gap: '1rem' }}>
            {linksToShow.map(({ link, index }, listIndex) => (
              <Paper
                key={index}
                variant="outlined"
                sx={{ p: '0.5rem', bgcolor: 'var(--mui-palette-card-bg)', borderColor: 'var(--mui-palette-card-border)' }}
              >
                <Box sx={{ display: "flex", flexDirection: "column", gap: '0.75rem' }}>
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      gap: '0.5rem',
                      alignItems: "center",
                    }}
                  >
                    <TextField
                      label="Link Name"
                      size="small"
                      value={link.name}
                      onChange={(e) =>
                        handleUpdateLink(index, { name: formatName(e.target.value) })
                      }
                      fullWidth
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
                      gridTemplateColumns: "1fr 1fr",
                      gap: '0.5rem',
                    }}
                  >
                    <TextField
                      label={`${nodeA} Interface`}
                      size="small"
                      value={link.targetInterface}
                      onChange={(e) =>
                        handleUpdateLink(index, {
                          targetInterface: e.target.value,
                        })
                      }
                      inputRef={listIndex === 0 ? sourceInterfaceRef : undefined}
                      fullWidth
                    />
                    <TextField
                      label={`${nodeB} Interface`}
                      size="small"
                      value={link.sourceInterface}
                      onChange={(e) =>
                        handleUpdateLink(index, {
                          sourceInterface: e.target.value,
                        })
                      }
                      fullWidth
                    />
                  </Box>

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
                </Box>
              </Paper>
            ))}
          </Box>
        </Box>
      );
    }

    return (
      <Box>
        {linksToShow.map(({ link, index }, listIndex) => (
          <Box key={index}>
            <PanelHeader
              title={`${nodeA} ↔ ${nodeB}`}
              actions={
                <IconButton
                  size="small"
                  onClick={() => handleDeleteLink(index)}
                >
                  <DeleteIcon fontSize="small" color="error" />
                </IconButton>
              }
            />

            <Box sx={{ display: "flex", flexDirection: "column", gap: '1rem' }}>
              <TextField
                label="Name"
                size="small"
                value={link.name}
                onChange={(e) =>
                  handleUpdateLink(index, { name: formatName(e.target.value) })
                }
                fullWidth
              />

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
              <EditableLabelsSection
                labels={link.labels}
                inheritedLabels={getInheritedLinkLabels(link, linkTemplates)}
                onUpdate={(labels) => handleUpdateLink(index, { labels })}
              />
            </Box>

            <PanelSection title="Endpoints">
              <Paper variant="outlined" sx={{ p: '0.5rem', bgcolor: 'var(--mui-palette-card-bg)', borderColor: 'var(--mui-palette-card-border)' }}>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: '0.5rem',
                    alignItems: "center",
                  }}
                >
                  <TextField
                    label={nodeA}
                    size="small"
                    value={link.targetInterface}
                    onChange={(e) =>
                      handleUpdateLink(index, {
                        targetInterface: e.target.value,
                      })
                    }
                    inputRef={listIndex === 0 ? sourceInterfaceRef : undefined}
                    slotProps={{ input: { tabIndex: 1 } }}
                    fullWidth
                  />
                  <TextField
                    label={nodeB}
                    size="small"
                    value={link.sourceInterface}
                    onChange={(e) =>
                      handleUpdateLink(index, {
                        sourceInterface: e.target.value,
                      })
                    }
                    inputRef={listIndex === 0 ? targetInterfaceRef : undefined}
                    slotProps={{ input: { tabIndex: 2 } }}
                    fullWidth
                  />
                </Box>
              </Paper>
            </PanelSection>
          </Box>
        ))}
      </Box>
    );
  }

  // Handle sim node selection
  if (selectedSimNode) {
    const simNodeId = selectedSimNode.id;
    const connectedEdges = edges.filter(
      (e) => e.source === simNodeId || e.target === simNodeId
    );
    const esiLagEdges = edges.filter((e) => {
      if (connectedEdges.includes(e)) return false;
      return e.data?.sourceNode === selectedSimNode.name ||
        e.data?.esiLeaves?.some(leaf => leaf.nodeName === selectedSimNode.name);
    });
    const allConnectedEdges = [...connectedEdges, ...esiLagEdges];

    return (
      <SimNodeSelectionEditor
        simNode={selectedSimNode}
        simNodeTemplates={simulation.simNodeTemplates}
        connectedEdges={allConnectedEdges}
        onUpdate={(update) => {
          updateSimNode(selectedSimNode.name, update);
          triggerYamlRefresh();
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
