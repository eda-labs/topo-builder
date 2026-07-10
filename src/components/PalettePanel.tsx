import { useLayoutEffect, useRef, useState } from 'react';
import { useReactFlow } from '@xyflow/react';
import { Box, IconButton, Tooltip, Typography, useTheme } from '@mui/material';
import {
  PushPin as PushPinIcon,
  PushPinOutlined as PushPinOutlinedIcon,
} from '@mui/icons-material';

import { useTopologyStore, generateUniqueName } from '../lib/store';
import { paintPanel, resolveFrontPanel, frontPanelMetaOf, panelDims, type FrontPanelMeta } from '../lib/frontpanel';
import type { NodeTemplate, SimNodeTemplate } from '../types/schema';

import { RoleIcons } from './nodes/roleIcons';

export const PALETTE_DND_TYPE = 'application/x-topobuilder-template';

const TEXT_SECONDARY = 'text.secondary';

export interface PaletteDragPayload {
  kind: 'node' | 'sim';
  name: string;
}

export function readPaletteDrag(e: React.DragEvent): PaletteDragPayload | null {
  const raw = e.dataTransfer.getData(PALETTE_DND_TYPE);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PaletteDragPayload>;
    if ((parsed.kind === 'node' || parsed.kind === 'sim') && typeof parsed.name === 'string') {
      return { kind: parsed.kind, name: parsed.name };
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
  const template = payload.name;
  const existingNames = store.nodes.filter(n => n.data.nodeType === 'simnode').map(n => n.data.name);
  const name = generateUniqueName(template || 'sim', existingNames, existingNames.length + 1);
  store.addSimNode({ name, template, position });
}

const PREVIEW_W = 180;

function PanelPreview({ meta }: { meta: FrontPanelMeta }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { w, h } = panelDims(meta);
  const height = Math.max(8, Math.round((PREVIEW_W * h) / w));
  useLayoutEffect(() => {
    if (ref.current) {
      paintPanel(ref.current, meta, {
        width: PREVIEW_W,
        height,
        freeFill: '#222B37',
        freeLine: '#39445580',
      });
    }
  }, [meta, height]);
  return (
    <Box sx={{ bgcolor: '#000', borderRadius: '3px', p: '3px', lineHeight: 0 }}>
      <canvas ref={ref} aria-hidden style={{ display: 'block' }} />
    </Box>
  );
}

function PaletteItem({
  payload,
  title,
  subtitle,
  roleIcon,
  meta,
  onAdd,
}: {
  payload: PaletteDragPayload;
  title: string;
  subtitle?: string;
  roleIcon?: string;
  meta?: FrontPanelMeta;
  onAdd: () => void;
}) {
  return (
    <Box
      draggable
      data-testid={`palette-item-${payload.kind}-${payload.name}`}
      onDragStart={e => {
        e.dataTransfer.setData(PALETTE_DND_TYPE, JSON.stringify(payload));
        e.dataTransfer.effectAllowed = 'copy';
      }}
      onClick={onAdd}
      title="Drag onto the canvas, or click to add"
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
        '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
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
        <Typography variant="body2" sx={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {title}
        </Typography>
        <Box sx={{ flex: 1 }} />
        {meta && (
          <Typography variant="caption" sx={{ color: TEXT_SECONDARY, flexShrink: 0, fontSize: 10 }}>
            {meta.ports} ports
          </Typography>
        )}
      </Box>
      {subtitle && (
        <Typography variant="caption" sx={{ color: TEXT_SECONDARY, fontSize: 10, mt: -0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {subtitle}
        </Typography>
      )}
      {meta && <PanelPreview meta={meta} />}
    </Box>
  );
}

function templateRole(template: NodeTemplate): string | undefined {
  return template.labels?.['eda.nokia.com/role'];
}

export default function PalettePanel() {
  const theme = useTheme();
  const nodeTemplates = useTopologyStore(state => state.nodeTemplates);
  const simNodeTemplates = useTopologyStore(state => state.simulation.simNodeTemplates);
  const { screenToFlowPosition } = useReactFlow();

  // Slim rail by default; expands on hover so it never eats canvas space, with a pin to keep it open.
  const [pinned, setPinned] = useState(() => localStorage.getItem('topology-palette-pinned') === '1');
  const [hovered, setHovered] = useState(false);
  const open = pinned || hovered;
  const toggle = () => {
    setPinned(prev => {
      localStorage.setItem('topology-palette-pinned', prev ? '0' : '1');
      return !prev;
    });
  };

  const addAtCanvasCenter = (payload: PaletteDragPayload) => {
    const canvas = document.querySelector('[data-testid="topology-canvas"]');
    const rect = canvas?.getBoundingClientRect();
    const center = rect
      ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
      : { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    addPaletteItem(payload, screenToFlowPosition(center));
  };

  // Floating overlay inside the canvas so the react-flow pane keeps its full geometry
  // (node coordinates are unaffected by the palette being open or closed).
  return (
    <Box
      data-testid="palette-panel"
      onMouseEnter={() => { setHovered(true); }}
      onMouseLeave={() => { setHovered(false); }}
      onDragEnd={() => { setHovered(false); }}
      sx={{
        position: 'absolute',
        left: 12,
        top: 12,
        maxHeight: 'calc(100% - 24px)',
        zIndex: 5,
        width: open ? 220 : 34,
        transition: theme.transitions.create('width', { duration: 150 }),
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        bgcolor: 'background.paper',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: 3,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: open ? 'space-between' : 'center', pl: open ? 1 : 0 }}>
        {open && (
          <Typography variant="caption" sx={{ color: TEXT_SECONDARY, fontWeight: 700, letterSpacing: 0.5 }}>
            TEMPLATES
          </Typography>
        )}
        <Tooltip title={pinned ? 'Unpin palette' : 'Pin palette open'}>
          <IconButton size="small" onClick={toggle} data-testid="palette-toggle">
            {pinned ? <PushPinIcon fontSize="small" /> : <PushPinOutlinedIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Box>
      {!open && (
        <Typography
          variant="caption"
          sx={{ color: TEXT_SECONDARY, fontWeight: 700, letterSpacing: 1.5, writingMode: 'vertical-rl', mx: 'auto', mt: 1, userSelect: 'none' }}
        >
          TEMPLATES
        </Typography>
      )}
      {open && (
        <Box sx={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1, p: 1, pt: 0.5 }}>
          {nodeTemplates.map(template => {
            const stencil = resolveFrontPanel(template.platform, template.components);
            const meta = stencil ? frontPanelMetaOf(stencil) : undefined;
            const role = templateRole(template);
            return (
              <PaletteItem
                key={template.name}
                payload={{ kind: 'node', name: template.name }}
                title={template.name}
                subtitle={template.platform}
                roleIcon={role ? RoleIcons[role] : undefined}
                meta={meta?.layout.length ? meta : undefined}
                onAdd={() => { addAtCanvasCenter({ kind: 'node', name: template.name }); }}
              />
            );
          })}
          {simNodeTemplates.length > 0 && (
            <Typography variant="caption" sx={{ color: TEXT_SECONDARY, fontWeight: 700, letterSpacing: 0.5, mt: 0.5 }}>
              SIM NODES
            </Typography>
          )}
          {simNodeTemplates.map((template: SimNodeTemplate) => (
            <PaletteItem
              key={template.name}
              payload={{ kind: 'sim', name: template.name }}
              title={template.name}
              subtitle={template.type}
              onAdd={() => { addAtCanvasCenter({ kind: 'sim', name: template.name }); }}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}
