import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useReactFlow } from '@xyflow/react';
import {
  Box,
  IconButton,
  InputAdornment,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  AutoFixHigh as WizardIcon,
  ChevronLeft as CollapseIcon,
  ChevronRight as ExpandIcon,
  Delete as DeleteIcon,
  ExpandLess as GroupOpenIcon,
  ExpandMore as GroupClosedIcon,
  Search as SearchIcon,
} from '@mui/icons-material';

import { useTopologyStore, generateUniqueName } from '../lib/store';
import {
  frontPanelMetaOf,
  paintPanel,
  panelDims,
  resolveFrontPanel,
  type FrontPanelMeta,
} from '../lib/frontpanel';
import {
  namePrefixForPlatform,
  osOfPlatform,
  platformCatalog,
  type CatalogFixedItem,
} from '../lib/catalog';
import { DEFAULT_NODE_PROFILE_SRL, DEFAULT_NODE_PROFILE_SROS } from '../lib/constants';
import { exampleTopologies, type ExampleTopology } from '../samples';
import type { Component, NodeTemplate, SimNodeTemplate } from '../types/schema';

import { RoleIcons } from './nodes/roleIcons';
import PlatformDetailsPopover, { type PlatformDetail } from './PlatformDetailsPopover';
import SrosWizardDialog, { type SrosWizardResult } from './SrosWizardDialog';

export const PALETTE_DND_TYPE = 'application/x-topobuilder-template';

const TEXT_SECONDARY = 'text.secondary';
const DEFAULT_PANEL_WIDTH = 252;
const MIN_PANEL_WIDTH = 200;
const MAX_PANEL_WIDTH = 460;
const RAIL_WIDTH = 36;
const ELLIPSIS_SX = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } as const;
const HOVER_COLOR = 'primary.main';
const HOVER_SX = { borderColor: HOVER_COLOR, bgcolor: 'action.hover' } as const;
const ITEM_HINT = 'Drag onto the canvas · click for details';

export type PaletteDragPayload =
  | { kind: 'node'; name: string }
  | { kind: 'sim'; name: string }
  | { kind: 'external' }
  | { kind: 'catalog'; platform: string; components?: Component[] };

export function readPaletteDrag(e: React.DragEvent): PaletteDragPayload | null {
  const raw = e.dataTransfer.getData(PALETTE_DND_TYPE);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PaletteDragPayload>;
    if ((parsed.kind === 'node' || parsed.kind === 'sim') && typeof (parsed as { name?: unknown }).name === 'string') {
      return { kind: parsed.kind, name: (parsed as { name: string }).name };
    }
    if (parsed.kind === 'external') {
      return { kind: 'external' };
    }
    if (parsed.kind === 'catalog' && typeof (parsed as { platform?: unknown }).platform === 'string') {
      const { platform, components } = parsed as { platform: string; components?: Component[] };
      return { kind: 'catalog', platform, components: Array.isArray(components) ? components : undefined };
    }
  } catch { /* not ours */ }
  return null;
}

export function addPaletteItem(payload: PaletteDragPayload, position: { x: number; y: number }): void {
  const store = useTopologyStore.getState();
  if (payload.kind === 'node') {
    store.addNode(position, payload.name);
    return;
  }
  if (payload.kind === 'external') {
    store.addExternalNode({ position });
    return;
  }
  if (payload.kind === 'catalog') {
    const sros = osOfPlatform(payload.platform) === 'sros';
    store.addCatalogNode(position, {
      platform: payload.platform,
      components: payload.components,
      namePrefix: namePrefixForPlatform(payload.platform),
      nodeProfile: sros ? DEFAULT_NODE_PROFILE_SROS : DEFAULT_NODE_PROFILE_SRL,
    });
    return;
  }
  const template = payload.name;
  const existingNames = store.nodes.filter(n => n.data.nodeType === 'simnode').map(n => n.data.name);
  const name = generateUniqueName(template || 'sim', existingNames, existingNames.length + 1);
  store.addSimNode({ name, template, position });
}

const PREVIEW_W = 180;

function PanelPreview({ meta, width = PREVIEW_W }: { meta: FrontPanelMeta; width?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { w, h } = panelDims(meta);
  const height = Math.max(8, Math.round((width * h) / w));
  useLayoutEffect(() => {
    if (ref.current) {
      paintPanel(ref.current, meta, {
        width,
        height,
        freeFill: '#222B37',
        freeLine: '#39445580',
      });
    }
  }, [meta, width, height]);
  return (
    <Box sx={{ bgcolor: '#000', borderRadius: '3px', p: '3px', lineHeight: 0, alignSelf: 'flex-start' }}>
      <canvas ref={ref} aria-hidden style={{ display: 'block' }} />
    </Box>
  );
}

function setDragPayload(e: React.DragEvent, payload: PaletteDragPayload): void {
  e.dataTransfer.setData(PALETTE_DND_TYPE, JSON.stringify(payload));
  e.dataTransfer.effectAllowed = 'copy';
}

function QuickAddButton({ onAdd, testId }: { onAdd: () => void; testId?: string }) {
  return (
    <Tooltip title="Add to canvas">
      <IconButton
        size="small"
        data-testid={testId}
        onClick={e => { e.stopPropagation(); onAdd(); }}
        sx={{ p: 0.25, flexShrink: 0 }}
      >
        <AddIcon sx={{ fontSize: 16 }} />
      </IconButton>
    </Tooltip>
  );
}

function PaletteItem({
  payload,
  testId,
  title,
  subtitle,
  roleIcon,
  meta,
  previewWidth,
  actions,
  onAdd,
  onOpenDetails,
}: {
  payload: PaletteDragPayload;
  testId: string;
  title: string;
  subtitle?: string;
  roleIcon?: string;
  meta?: FrontPanelMeta;
  previewWidth?: number;
  /** extra header buttons (e.g. template delete) rendered before the add button */
  actions?: React.ReactNode;
  onAdd: () => void;
  /** click target — omitted (sim nodes) means clicking does nothing */
  onOpenDetails?: (anchor: HTMLElement) => void;
}) {
  return (
    <Box
      draggable
      data-testid={testId}
      onDragStart={e => { setDragPayload(e, payload); }}
      onClick={onOpenDetails ? e => { onOpenDetails(e.currentTarget); } : undefined}
      title={onOpenDetails ? ITEM_HINT : 'Drag onto the canvas, or use + to add'}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
        p: 1,
        borderRadius: 1,
        border: '1px solid',
        borderColor: 'divider',
        cursor: 'grab',
        userSelect: 'none',
        '&:hover': HOVER_SX,
        '&:active': { cursor: 'grabbing' },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
        {roleIcon && (
          <span
            style={{ lineHeight: 0, flexShrink: 0 }}
            dangerouslySetInnerHTML={{ __html: roleIcon.replace(/width="\d+"/, 'width="14"').replace(/height="\d+"/, 'height="14"') }}
          />
        )}
        <Typography variant="body2" sx={{ fontWeight: 700, ...ELLIPSIS_SX }}>
          {title}
        </Typography>
        <Box sx={{ flex: 1 }} />
        {meta && (
          <Typography variant="caption" sx={{ color: TEXT_SECONDARY, flexShrink: 0, fontSize: 10 }}>
            {meta.ports} ports
          </Typography>
        )}
        {actions}
        <QuickAddButton onAdd={onAdd} />
      </Box>
      {subtitle && (
        <Typography variant="caption" sx={{ color: TEXT_SECONDARY, fontSize: 10, mt: -0.5, ...ELLIPSIS_SX }}>
          {subtitle}
        </Typography>
      )}
      {meta && <PanelPreview meta={meta} width={previewWidth} />}
    </Box>
  );
}

const slugify = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]+/g, '-');

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <Typography variant="caption" sx={{ color: TEXT_SECONDARY, fontWeight: 700, letterSpacing: 0.5, mt: 0.5 }}>
      {children}
    </Typography>
  );
}

function FixedCatalogItem({ item, previewWidth, onAdd, onOpenDetails }: {
  item: CatalogFixedItem;
  previewWidth?: number;
  onAdd: (payload: PaletteDragPayload) => void;
  onOpenDetails: (anchor: HTMLElement, detail: PlatformDetail, payload: PaletteDragPayload) => void;
}) {
  const meta = frontPanelMetaOf(item.stencil);
  const payload: PaletteDragPayload = { kind: 'catalog', platform: item.platform, components: item.components };
  return (
    <PaletteItem
      payload={payload}
      testId={`palette-item-catalog-${slugify(item.label)}`}
      title={item.label}
      subtitle={item.os === 'sros' ? 'SR OS' : 'SR Linux'}
      meta={meta?.layout.length ? meta : undefined}
      previewWidth={previewWidth}
      onAdd={() => { onAdd(payload); }}
      onOpenDetails={anchor => {
        onOpenDetails(anchor, {
          title: item.label,
          platform: item.platform,
          os: item.os,
          stencil: item.stencil,
          components: item.components,
        }, payload);
      }}
    />
  );
}

interface CatalogItemHandlers {
  onAdd: (payload: PaletteDragPayload) => void;
  onOpenDetails: (anchor: HTMLElement, detail: PlatformDetail, payload: PaletteDragPayload) => void;
  previewWidth?: number;
}

function CatalogGroupSection({ family, items, expanded, onToggle, onAdd, onOpenDetails, previewWidth, leadItem }: CatalogItemHandlers & {
  family: string;
  items: CatalogFixedItem[];
  expanded: boolean;
  onToggle: () => void;
  /** rendered above the items when expanded (SR OS wizard entry in the 7750 SR group) */
  leadItem?: React.ReactNode;
}) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box
        onClick={onToggle}
        data-testid={`palette-group-${slugify(family)}`}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          cursor: 'pointer',
          userSelect: 'none',
          '&:hover': { color: HOVER_COLOR },
        }}
      >
        {expanded ? <GroupOpenIcon sx={{ fontSize: 16 }} /> : <GroupClosedIcon sx={{ fontSize: 16 }} />}
        <Typography variant="caption" sx={{ fontWeight: 700 }}>
          {family}
        </Typography>
        <Typography variant="caption" sx={{ color: TEXT_SECONDARY, fontSize: 10 }}>
          ({items.length})
        </Typography>
      </Box>
      {expanded && leadItem}
      {expanded && items.map(item => (
        <FixedCatalogItem key={item.label} item={item} previewWidth={previewWidth} onAdd={onAdd} onOpenDetails={onOpenDetails} />
      ))}
    </Box>
  );
}

/** Bundled example topology: clicking replaces the canvas (undoable) and refreshes the YAML. */
function ExampleItem({ example, onLoad }: { example: ExampleTopology; onLoad: (example: ExampleTopology) => void }) {
  return (
    <Box
      data-testid={`palette-example-${example.id}`}
      onClick={() => { onLoad(example); }}
      title="Load this example topology (replaces the canvas — undo restores it)"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0.25,
        p: 1,
        borderRadius: 1,
        border: '1px dashed',
        borderColor: 'divider',
        cursor: 'pointer',
        userSelect: 'none',
        '&:hover': HOVER_SX,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 700, ...ELLIPSIS_SX }}>
          {example.title}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Typography variant="caption" sx={{ color: TEXT_SECONDARY, flexShrink: 0, fontSize: 10 }}>
          ns: {example.namespace}
        </Typography>
      </Box>
      <Typography variant="caption" sx={{ color: TEXT_SECONDARY, fontSize: 10, ...ELLIPSIS_SX }}>
        {example.description}
      </Typography>
    </Box>
  );
}

function templateRole(template: NodeTemplate): string | undefined {
  return template.labels?.['eda.nokia.com/role'];
}

function matchesQuery(label: string, query: string): boolean {
  return label.toLowerCase().includes(query);
}

export default function PalettePanel() {
  const nodeTemplates = useTopologyStore(state => state.nodeTemplates);
  const simNodeTemplates = useTopologyStore(state => state.simulation.simNodeTemplates);
  const deleteNodeTemplate = useTopologyStore(state => state.deleteNodeTemplate);
  const { screenToFlowPosition, fitView } = useReactFlow();

  const [open, setOpen] = useState(() => localStorage.getItem('topology-palette-open') !== '0');
  const [query, setQuery] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [wizardOpen, setWizardOpen] = useState(false);
  const [details, setDetails] = useState<{
    anchor: HTMLElement;
    detail: PlatformDetail;
    payload: PaletteDragPayload;
  } | null>(null);

  const [panelWidth, setPanelWidth] = useState(() => {
    const saved = parseInt(localStorage.getItem('topology-palette-width') ?? '', 10);
    return Number.isFinite(saved) && saved >= MIN_PANEL_WIDTH ? Math.min(saved, MAX_PANEL_WIDTH) : DEFAULT_PANEL_WIDTH;
  });
  const widthRef = useRef(panelWidth);

  // Drag the palette's right edge to resize; width persists like the right-hand side panel's.
  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const onMouseMove = (ev: MouseEvent) => {
      const next = Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, ev.clientX));
      widthRef.current = next;
      setPanelWidth(next);
    };
    const onMouseUp = () => {
      localStorage.setItem('topology-palette-width', String(widthRef.current));
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, []);

  const toggleOpen = () => {
    setOpen(prev => {
      localStorage.setItem('topology-palette-open', prev ? '0' : '1');
      return !prev;
    });
  };

  const openDetails = useCallback((anchor: HTMLElement, detail: PlatformDetail, payload: PaletteDragPayload) => {
    setDetails({ anchor, detail, payload });
  }, []);

  const toggleGroup = (family: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(family)) next.delete(family);
      else next.add(family);
      return next;
    });
  };

  const loadExample = useCallback((example: ExampleTopology) => {
    const store = useTopologyStore.getState();
    store.saveToUndoHistory();
    if (store.importFromYaml(example.yaml)) {
      store.triggerYamlRefresh();
      setTimeout(() => { void fitView({ padding: 0.1, duration: 300 }); }, 100);
    }
  }, [fitView]);

  const addAtCanvasCenter = (payload: PaletteDragPayload) => {
    const canvas = document.querySelector('[data-testid="topology-canvas"]');
    const rect = canvas?.getBoundingClientRect();
    const center = rect
      ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
      : { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    addPaletteItem(payload, screenToFlowPosition(center));
  };

  const normalizedQuery = query.trim().toLowerCase();
  const searching = normalizedQuery.length > 0;

  const visibleCatalog = useMemo(() => {
    if (!searching) return platformCatalog;
    return platformCatalog
      .map(group => ({
        family: group.family,
        items: group.items.filter(item =>
          matchesQuery(item.label, normalizedQuery) || matchesQuery(item.platform, normalizedQuery)),
      }))
      .filter(group => group.items.length > 0);
  }, [searching, normalizedQuery]);

  const visibleTemplates = useMemo(() => {
    if (!searching) return nodeTemplates;
    return nodeTemplates.filter(t =>
      matchesQuery(t.name, normalizedQuery) || matchesQuery(t.platform ?? '', normalizedQuery));
  }, [nodeTemplates, searching, normalizedQuery]);

  if (!open) {
    return (
      <Box
        data-testid="palette-panel"
        sx={{
          width: RAIL_WIDTH,
          flexShrink: 0,
          borderRight: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          pt: 0.5,
        }}
      >
        <Tooltip title="Open palette">
          <IconButton size="small" onClick={toggleOpen} data-testid="palette-toggle">
            <ExpandIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Typography
          variant="caption"
          onClick={toggleOpen}
          sx={{ color: TEXT_SECONDARY, fontWeight: 700, letterSpacing: 1.5, writingMode: 'vertical-rl', mt: 1, userSelect: 'none', cursor: 'pointer' }}
        >
          PALETTE
        </Typography>
      </Box>
    );
  }

  const previewWidth = Math.max(120, panelWidth - 72);

  return (
    <Box
      data-testid="palette-panel"
      sx={{
        width: panelWidth,
        flexShrink: 0,
        position: 'relative',
        borderRight: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Box
        onMouseDown={startResize}
        data-testid="palette-resize-handle"
        sx={{ position: 'absolute', right: -2, top: 0, bottom: 0, width: 6, cursor: 'col-resize', zIndex: 2 }}
      />
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pl: 1, py: 0.25 }}>
        <Typography variant="caption" sx={{ color: TEXT_SECONDARY, fontWeight: 700, letterSpacing: 0.5 }}>
          PALETTE
        </Typography>
        <Tooltip title="Collapse palette">
          <IconButton size="small" onClick={toggleOpen} data-testid="palette-toggle">
            <CollapseIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
      <Box sx={{ px: 1, pb: 0.5 }}>
        <TextField
          size="small"
          fullWidth
          placeholder="Search platforms…"
          value={query}
          onChange={e => { setQuery(e.target.value); }}
          data-testid="palette-search"
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 16 }} />
                </InputAdornment>
              ),
              sx: { fontSize: 12 },
            },
          }}
        />
      </Box>
      <Box sx={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1, p: 1, pt: 0.5 }}>
        {visibleTemplates.length > 0 && <SectionHeader>TEMPLATES</SectionHeader>}
        {visibleTemplates.map(template => {
          const stencil = resolveFrontPanel(template.platform, template.components);
          const meta = stencil ? frontPanelMetaOf(stencil) : undefined;
          const role = templateRole(template);
          const payload: PaletteDragPayload = { kind: 'node', name: template.name };
          return (
            <PaletteItem
              key={template.name}
              payload={payload}
              testId={`palette-item-node-${template.name}`}
              title={template.name}
              subtitle={template.platform}
              roleIcon={role ? RoleIcons[role] : undefined}
              meta={meta?.layout.length ? meta : undefined}
              previewWidth={previewWidth}
              actions={(
                <Tooltip title="Delete template">
                  <IconButton
                    size="small"
                    data-testid={`palette-template-delete-${template.name}`}
                    onClick={e => {
                      e.stopPropagation();
                      deleteNodeTemplate(template.name);
                    }}
                    sx={{ p: 0.25, flexShrink: 0 }}
                  >
                    <DeleteIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Tooltip>
              )}
              onAdd={() => { addAtCanvasCenter(payload); }}
              onOpenDetails={anchor => {
                openDetails(anchor, {
                  title: template.name,
                  platform: template.platform ?? '',
                  os: osOfPlatform(template.platform ?? ''),
                  stencil,
                  components: template.components,
                }, payload);
              }}
            />
          );
        })}

        <SectionHeader>CATALOG</SectionHeader>
        {visibleCatalog.map(group => (
          <CatalogGroupSection
            key={group.family}
            family={group.family}
            items={group.items}
            expanded={searching || expandedGroups.has(group.family)}
            onToggle={() => { toggleGroup(group.family); }}
            onAdd={addAtCanvasCenter}
            onOpenDetails={openDetails}
            previewWidth={previewWidth}
            leadItem={group.family === '7750 SR'
              ? (
                <Box
                  data-testid="palette-sros-wizard"
                  onClick={() => { setWizardOpen(true); }}
                  title="Configure an SR OS chassis (cards, MDAs, XIOMs) and add it to the canvas"
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.75,
                    p: 1,
                    borderRadius: 1,
                    border: '1px dashed',
                    borderColor: 'divider',
                    cursor: 'pointer',
                    userSelect: 'none',
                    '&:hover': HOVER_SX,
                  }}
                >
                  <WizardIcon sx={{ fontSize: 16, color: TEXT_SECONDARY }} />
                  <Typography variant="body2" sx={{ fontWeight: 700, ...ELLIPSIS_SX }}>
                    SR OS chassis wizard
                  </Typography>
                  <Box sx={{ flex: 1 }} />
                  <Typography variant="caption" sx={{ color: TEXT_SECONDARY, fontSize: 10, flexShrink: 0 }}>
                    SR-7s, SR-12…
                  </Typography>
                </Box>
              )
              : undefined}
          />
        ))}
        {searching && visibleCatalog.length === 0 && visibleTemplates.length === 0 && (
          <Typography variant="caption" sx={{ color: TEXT_SECONDARY }}>
            No platforms match “{query.trim()}”.
          </Typography>
        )}

        {!searching && (
          <>
            <SectionHeader>EXAMPLES</SectionHeader>
            {exampleTopologies.map(example => (
              <ExampleItem key={example.id} example={example} onLoad={loadExample} />
            ))}
          </>
        )}

        {simNodeTemplates.length > 0 && !searching && (
          <>
            <SectionHeader>SIM NODES</SectionHeader>
            {simNodeTemplates.map((template: SimNodeTemplate) => (
              <PaletteItem
                key={template.name}
                payload={{ kind: 'sim', name: template.name }}
                testId={`palette-item-sim-${template.name}`}
                title={template.name}
                subtitle={template.type}
                onAdd={() => { addAtCanvasCenter({ kind: 'sim', name: template.name }); }}
              />
            ))}
          </>
        )}

        {!searching && (
          <>
            <SectionHeader>EXTERNAL</SectionHeader>
            <PaletteItem
              payload={{ kind: 'external' }}
              testId="palette-item-external"
              title="external"
              subtitle="Device outside the topology — cables to it become edge links"
              onAdd={() => { addAtCanvasCenter({ kind: 'external' }); }}
            />
          </>
        )}
      </Box>
      <PlatformDetailsPopover
        anchorEl={details?.anchor ?? null}
        detail={details?.detail ?? null}
        onClose={() => { setDetails(null); }}
        onAdd={() => {
          if (details) addAtCanvasCenter(details.payload);
          setDetails(null);
        }}
      />
      {wizardOpen && (
        <SrosWizardDialog
          open={wizardOpen}
          onClose={() => { setWizardOpen(false); }}
          onAdd={(result: SrosWizardResult) => {
            addAtCanvasCenter({ kind: 'catalog', platform: result.platform, components: result.components });
            setWizardOpen(false);
          }}
        />
      )}
    </Box>
  );
}
