import { useState, useEffect, useRef, type ReactNode } from "react";
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
  Divider,
} from "@mui/material";
import { Delete as DeleteIcon, Add as AddIcon, SubdirectoryArrowRight as ArrowIcon } from "@mui/icons-material";

function PanelHeader({
  title,
  chip,
  actions,
}: {
  title: string;
  chip?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <Box sx={{ mb: '1rem' }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          minHeight: 32,
          mb: '0.5rem',
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: '0.5rem' }}>
          <Typography variant="h6" fontSize={16} fontWeight={600}>
            {title}
          </Typography>
          {chip}
        </Box>
        {actions}
      </Box>
      <Divider />
    </Box>
  );
}

function PanelSection({
  title,
  count,
  actions,
  children,
}: {
  title: string;
  count?: number;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Box sx={{ mt: '1rem' }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          minHeight: 32,
        }}
      >
        <Typography variant="subtitle2" fontWeight={600}>
          {title}{count !== undefined ? ` (${count})` : ''}
        </Typography>
        {actions}
      </Box>
      <Divider sx={{ mt: '0.25rem', mb: '1rem' }} />
      {children}
    </Box>
  );
}

function PanelCard({
  children,
  highlighted,
}: {
  children: ReactNode;
  highlighted?: boolean;
}) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: '0.5rem',
        bgcolor: highlighted ? 'action.hover' : 'var(--mui-palette-card-bg)',
        borderColor: 'var(--mui-palette-card-border)',
        "&:hover": highlighted ? {
          borderColor: 'action.disabled',
        } : undefined,
      }}
    >
      {children}
    </Paper>
  );
}

import { useTopologyStore } from "../lib/store";
import { formatName } from "../lib/utils";
import {
  getInheritedNodeLabels,
  getInheritedLinkLabels,
  getInheritedLagLabels,
} from "../lib/labels";
import {
  NODE_PROFILE_SUGGESTIONS,
  PLATFORM_SUGGESTIONS,
  DEFAULT_INTERFACE,
} from "../lib/constants";
import type { Edge } from "@xyflow/react";
import type {
  MemberLink,
  LagGroup,
  TopologyNodeData,
  TopologyEdgeData,
  NodeTemplate,
  LinkTemplate,
  LinkType,
  LinkSpeed,
  EncapType,
  SimNodeTemplate,
  SimNodeType,
} from "../types/topology";

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
              {allConnectedEdges.map((edge) => {
                const edgeData = edge.data;
                if (!edgeData) return null;
                const memberLinks = edgeData.memberLinks || [];
                const lagGroups = edgeData.lagGroups || [];
                const isEsiLag = edgeData.isMultihomed;
                const otherNode = edgeData.sourceNode === nodeData.name
                  ? edgeData.targetNode
                  : edgeData.sourceNode;

                if (isEsiLag && edgeData.esiLeaves) {
                  const esiName = memberLinks[0]?.name || `${edgeData.sourceNode}-esi-lag`;
                  return (
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
                  );
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

    const indicesInLags = new Set<number>();
    for (const lag of lagGroups) {
      for (const idx of lag.memberLinkIndices) {
        indicesInLags.add(idx);
      }
    }

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

    const linksToShow = isExpanded && memberLinks.length > 1
      ? (selectedMemberLinkIndices.length > 0
          ? selectedMemberLinkIndices
              .filter(i => i >= 0 && i < memberLinks.length)
              .map(i => ({ link: memberLinks[i], index: i }))
          : [])
      : memberLinks.map((link, index) => ({ link, index }));

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
	                      slotProps={{ htmlInput: { tabIndex: listIndex * 2 + 1 } }}
	                      fullWidth
	                    />
	                    <TextField
	                      label={nodeB}
	                      size="small"
	                      value={link.sourceInterface}
	                      onChange={(e) =>
	                        handleUpdateLink(index, { sourceInterface: e.target.value })
	                      }
	                      slotProps={{ htmlInput: { tabIndex: listIndex * 2 + 2 } }}
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
	                        slotProps={{ htmlInput: { tabIndex: index * 2 + 1 } }}
	                        fullWidth
	                      />
	                      <TextField
	                        label={nodeB}
	                        size="small"
	                        value={memberLink?.sourceInterface || ''}
	                        onChange={(e) =>
	                          handleUpdateLink(index, { sourceInterface: e.target.value })
	                        }
	                        slotProps={{ htmlInput: { tabIndex: index * 2 + 2 } }}
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
        const match = iface.match(/^(.+?)(\d+)$/);
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
	                      slotProps={{ htmlInput: { 'data-testid': `link-endpoint-a-${listIndex}` } }}
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
	                      slotProps={{ htmlInput: { 'data-testid': `link-endpoint-b-${listIndex}` } }}
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
	                    slotProps={{ htmlInput: { tabIndex: 1, 'data-testid': `link-endpoint-a-${listIndex}` } }}
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
	                    slotProps={{ htmlInput: { tabIndex: 2, 'data-testid': `link-endpoint-b-${listIndex}` } }}
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

const TOPOBUILDER_LABEL_PREFIX = 'topobuilder.eda.labs/';

function InheritedLabels({ labels }: { labels?: Record<string, string> }) {
  const filteredLabels = Object.entries(labels || {}).filter(
    ([key]) => !key.startsWith(TOPOBUILDER_LABEL_PREFIX)
  );
  if (filteredLabels.length === 0) return null;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      <Box sx={{ mb: '0.5rem' }}>
        <Typography variant="body2" fontWeight={600}>
          Inherited Labels
        </Typography>
        <Divider sx={{ mt: '0.25rem' }} />
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
        {filteredLabels.map(([key, value]) => (
          <Chip
            key={key}
            label={`${key}=${value}`}
            size="small"
            variant="outlined"
            sx={{
              bgcolor: 'var(--mui-palette-card-bg)',
              borderColor: 'var(--mui-palette-card-border)',
            }}
          />
        ))}
      </Box>
    </Box>
  );
}

function EditableLabelsSection({
  labels,
  inheritedLabels,
  onUpdate,
}: {
  labels?: Record<string, string>;
  inheritedLabels?: Record<string, string>;
  onUpdate: (labels: Record<string, string>) => void;
}) {
  const handleAddLabel = () => {
    let counter = 1;
    let newKey = `eda.nokia.com/label-${counter}`;
    while (labels?.[newKey] || inheritedLabels?.[newKey]) {
      counter++;
      newKey = `eda.nokia.com/label-${counter}`;
    }
    onUpdate({ ...labels, [newKey]: "" });
  };

  const handleUpdateLabel = (oldKey: string, newKey: string, value: string) => {
    const newLabels = { ...labels };
    if (oldKey !== newKey) {
      delete newLabels[oldKey];
    }
    newLabels[newKey] = value;
    onUpdate(newLabels);
  };

  const handleDeleteLabel = (key: string) => {
    const newLabels = { ...labels };
    delete newLabels[key];
    onUpdate(newLabels);
  };

  const hasVisibleInheritedLabels = Object.keys(inheritedLabels || {}).some(
    key => !key.startsWith(TOPOBUILDER_LABEL_PREFIX)
  );

  return (
    <Box>
      <InheritedLabels labels={inheritedLabels} />
      <Box sx={{ mt: hasVisibleInheritedLabels ? '0.75rem' : 0 }}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Typography variant="body2" fontWeight={600}>
            Labels
          </Typography>
          <Button size="small" startIcon={<AddIcon />} onClick={handleAddLabel}>
            Add
          </Button>
        </Box>
        <Divider sx={{ mt: '0.25rem', mb: '1rem' }} />
      </Box>
      <Box sx={{ display: "flex", flexDirection: "column", gap: '1rem' }}>
        {Object.entries(labels || {}).map(([key, value]) => (
          <LabelEditor
            key={key}
            labelKey={key}
            labelValue={value}
            onUpdate={(newKey, newValue) => handleUpdateLabel(key, newKey, newValue)}
            onDelete={() => handleDeleteLabel(key)}
            disableSuggestions
          />
        ))}
      </Box>
    </Box>
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
    <PanelCard highlighted>
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

        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: '0.5rem' }}>
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
        <Box>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
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
        <Box sx={{ display: "flex", flexDirection: "column", gap: '0.75rem' }}>
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
  disableSuggestions = false,
}: {
  labelKey: string;
  labelValue: string;
  onUpdate: (key: string, value: string) => void;
  onDelete: () => void;
  disableSuggestions?: boolean;
}) {
  const [localKey, setLocalKey] = useState(labelKey);
  const [localValue, setLocalValue] = useState(labelValue);

  useEffect(() => {
    setLocalKey(labelKey);
    setLocalValue(labelValue);
  }, [labelKey, labelValue]);

  const isSpecialLabel = !disableSuggestions && labelKey in SPECIAL_LABELS;
  const enumOptions = SPECIAL_LABELS[labelKey];

  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "65fr 35fr auto", gap: '0.5rem', alignItems: "center" }}>
      <TextField
        size="small"
        label="Key"
        value={localKey}
        onChange={(e) => setLocalKey(e.target.value)}
        onBlur={() => onUpdate(localKey, localValue)}
        fullWidth
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
          fullWidth
          renderInput={(params) => <TextField {...params} label="Value" />}
        />
      ) : (
        <TextField
          size="small"
          label="Value"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={() => onUpdate(localKey, localValue)}
          fullWidth
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
        <Box sx={{ display: "flex", flexDirection: "column", gap: '1rem' }}>
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

  const handleAddLabel = () => {
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
    <PanelCard highlighted>
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

        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: '0.5rem' }}>
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
        <Box sx={{ display: "flex", flexDirection: "column", gap: '0.75rem' }}>
          <Box sx={{ display: "grid", gridTemplateColumns: "65fr 35fr auto", gap: '0.5rem', alignItems: "center" }}>
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
        <Box sx={{ display: "flex", flexDirection: "column", gap: '1rem' }}>
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
  connectedEdges,
  onUpdate,
}: {
  simNode: { name: string; template?: string; id?: string };
  simNodeTemplates: SimNodeTemplate[];
  connectedEdges: Edge<TopologyEdgeData>[];
  onUpdate: (update: Partial<{ name: string; template?: string }>) => void;
}) {
  const [localName, setLocalName] = useState(simNode.name);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalName(simNode.name);
  }, [simNode.name]);

  useEffect(() => {
    const handler = () => nameInputRef.current?.focus();
    window.addEventListener('focusNodeName', handler);
    return () => window.removeEventListener('focusNodeName', handler);
  }, []);

  const handleNameBlur = () => {
    if (localName !== simNode.name) {
      onUpdate({ name: localName });
      setTimeout(() => {
        const freshSimNodes = useTopologyStore.getState().simulation.simNodes;
        const currentSimNode = freshSimNodes.find(n => n.id === simNode.id);
        if (currentSimNode && currentSimNode.name !== localName) {
          setLocalName(currentSimNode.name);
        }
      }, 50);
    }
  };

  return (
    <Box>
      <PanelHeader title={simNode.name} />

      <Box sx={{ display: "flex", flexDirection: "column", gap: '1rem' }}>
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
          <Box sx={{ display: "flex", flexDirection: "column", gap: '0.5rem' }}>
            {connectedEdges.map((edge) => {
              const edgeData = edge.data;
              if (!edgeData) return null;
              const memberLinks = edgeData.memberLinks || [];
              const lagGroups = edgeData.lagGroups || [];
              const isEsiLag = edgeData.isMultihomed;
              const otherNode = edgeData.sourceNode === simNode.name
                ? edgeData.targetNode
                : edgeData.sourceNode;

              if (isEsiLag && edgeData.esiLeaves) {
                const esiName = memberLinks[0]?.name || `${edgeData.sourceNode}-esi-lag`;
                return (
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
                );
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
                      {lag.name || `${simNode.name} ↔ ${otherNode}`}
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
    <PanelCard highlighted>
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

        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: '0.5rem' }}>
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
        <Box sx={{ display: "flex", flexDirection: "column", gap: '1rem' }}>
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
