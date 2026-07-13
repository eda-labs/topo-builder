import { useLayoutEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  Link,
  Popover,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Close as CloseIcon,
  Description as DatasheetIcon,
  MenuBook as DocsIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
} from '@mui/icons-material';

import { frontPanelMetaOf, paintPanel, panelDims, type FrontPanelMeta } from '../lib/frontpanel';
import { panelBreakoutSummary, speedGroupsLabel } from '../lib/connectors';
import { platformLinks } from '../lib/platformInfo';
import { favoriteId, useFavoritesStore } from '../lib/favorites';
import type { CatalogOS } from '../lib/catalog';
import type { Component } from '../types/schema';

/** What the palette knows about a clicked entry — enough to preview, spec and add it. */
export interface PlatformDetail {
  title: string;
  platform: string;
  os: CatalogOS;
  stencil: string | null;
  components?: Component[];
  /** palette label used when starring this entry; omitted -> no favorite toggle shown */
  favoriteLabel?: string;
}

/** Star toggle for a platform + component fit; shared by palette items and the details card. */
export function FavoriteToggle({ label, platform, components, testId }: {
  label: string;
  platform: string;
  components?: Component[];
  testId?: string;
}) {
  const id = favoriteId(platform, components);
  const isFavorite = useFavoritesStore(state => state.favorites.some(f => f.id === id));
  const toggleFavorite = useFavoritesStore(state => state.toggleFavorite);
  return (
    <Tooltip title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}>
      <IconButton
        size="small"
        data-testid={testId}
        onClick={e => {
          e.stopPropagation();
          toggleFavorite({ label, platform, components });
        }}
        sx={{ p: 0.25, flexShrink: 0 }}
      >
        {isFavorite
          ? <StarIcon sx={{ fontSize: 16, color: 'warning.main' }} />
          : <StarBorderIcon sx={{ fontSize: 16 }} />}
      </IconButton>
    </Tooltip>
  );
}

const POPOVER_WIDTH = 560;
const TEXT_SECONDARY = 'text.secondary';

/**
 * Faceplate graphic: the real cable-map stencil SVG when the deployment serves it under
 * `frontpanel/<stencil>.svg`, otherwise the cage layout painted onto a canvas.
 */
function FaceplateGraphic({ stencil }: { stencil: string }) {
  const [svgFailed, setSvgFailed] = useState(false);
  const meta = frontPanelMetaOf(stencil);

  if (!svgFailed) {
    return (
      <Box sx={{ bgcolor: '#000', borderRadius: 1, p: 1, lineHeight: 0 }}>
        <img
          src={`frontpanel/${encodeURIComponent(stencil)}.svg`}
          alt={`${stencil} front panel`}
          onError={() => { setSvgFailed(true); }}
          style={{ width: '100%', display: 'block' }}
        />
      </Box>
    );
  }
  if (meta?.layout.length) return <FaceplateCanvas meta={meta} />;
  return (
    <Typography variant="caption" sx={{ color: TEXT_SECONDARY }}>
      No faceplate graphic available.
    </Typography>
  );
}

function FaceplateCanvas({ meta }: { meta: FrontPanelMeta }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const width = POPOVER_WIDTH - 48;
  const { w, h } = panelDims(meta);
  const height = Math.max(10, Math.round((width * h) / w));
  useLayoutEffect(() => {
    if (ref.current) {
      paintPanel(ref.current, meta, { width, height, freeFill: '#222B37', freeLine: '#394455' });
    }
  }, [meta, width, height]);
  return (
    <Box sx={{ bgcolor: '#000', borderRadius: 1, p: 1, lineHeight: 0 }}>
      <canvas ref={ref} aria-hidden style={{ display: 'block' }} />
    </Box>
  );
}

function SpecRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'baseline' }}>
      <Typography variant="caption" sx={{ color: TEXT_SECONDARY, minWidth: 84, flexShrink: 0 }}>
        {label}
      </Typography>
      <Typography variant="caption" component="div" sx={{ minWidth: 0 }}>
        {value}
      </Typography>
    </Box>
  );
}

function componentLine(component: Component): string {
  const speeds = speedGroupsLabel(component.type);
  const slot = component.slot ? ` ${component.slot}` : '';
  const speedSuffix = speeds ? ` (${speeds})` : '';
  return `${component.kind}${slot} — ${component.type}${speedSuffix}`;
}

export default function PlatformDetailsPopover({ anchorEl, anchorPosition, detail, onClose, onAdd }: {
  anchorEl?: HTMLElement | null;
  /** screen coordinates to anchor at instead of an element (context-menu flows) */
  anchorPosition?: { top: number; left: number };
  detail: PlatformDetail | null;
  onClose: () => void;
  /** omitted (canvas nodes) hides the Add button */
  onAdd?: () => void;
}) {
  if (!detail) return null;

  const meta = detail.stencil ? frontPanelMetaOf(detail.stencil) : undefined;
  const links = platformLinks(detail.platform);
  const cards = (detail.components ?? []).filter(c => c.kind === 'mda' || c.kind === 'lineCard');
  const breakoutLines = detail.stencil && meta
    ? panelBreakoutSummary({ stencil: detail.stencil, meta, platform: detail.platform, components: detail.components })
    : [];

  return (
    <Popover
      open={!!anchorEl || !!anchorPosition}
      anchorEl={anchorEl ?? undefined}
      anchorReference={anchorPosition ? 'anchorPosition' : 'anchorEl'}
      anchorPosition={anchorPosition}
      onClose={onClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      data-testid="platform-details"
      slotProps={{ paper: { sx: { width: POPOVER_WIDTH, maxWidth: '90vw', maxHeight: '85vh', overflowY: 'auto', p: 2 } } }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {detail.title}
        </Typography>
        <Chip
          size="small"
          label={detail.os === 'sros' ? 'SR OS' : 'SR Linux'}
          color={detail.os === 'sros' ? 'secondary' : 'primary'}
          variant="outlined"
          sx={{ height: 20, fontSize: 10, flexShrink: 0 }}
        />
        <Box sx={{ flex: 1 }} />
        {detail.favoriteLabel && (
          <FavoriteToggle
            label={detail.favoriteLabel}
            platform={detail.platform}
            components={detail.components}
            testId="platform-details-favorite"
          />
        )}
        {onAdd && (
          <Button
            size="small"
            variant="contained"
            startIcon={<AddIcon />}
            onClick={onAdd}
            data-testid="platform-details-add"
          >
            Add
          </Button>
        )}
        <IconButton size="small" onClick={onClose} aria-label="Close details">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {detail.stencil
        ? <FaceplateGraphic stencil={detail.stencil} />
        : (
          <Typography variant="caption" sx={{ color: TEXT_SECONDARY }}>
            No faceplate graphic available for this platform.
          </Typography>
        )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 1.5 }}>
        <SpecRow label="Platform" value={detail.platform} />
        {meta && <SpecRow label="Ports" value={`${meta.ports} front-panel cages · ${meta.rows} row${meta.rows > 1 ? 's' : ''}`} />}
        {cards.map(card => (
          <SpecRow key={`${card.kind}-${card.slot ?? ''}-${card.type}`} label={card.kind === 'lineCard' ? 'Line card' : 'MDA'} value={componentLine(card)} />
        ))}
        {breakoutLines.length > 0 && (
          <SpecRow
            label="Breakouts"
            value={breakoutLines.map(line => <div key={line}>{line}</div>)}
          />
        )}
      </Box>

      {links && (
        <>
          <Divider sx={{ my: 1.5 }} />
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Link href={links.datasheetUrl} target="_blank" rel="noopener" variant="caption" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
              <DatasheetIcon sx={{ fontSize: 14 }} /> Datasheet & product page
            </Link>
            <Link href={links.docsUrl} target="_blank" rel="noopener" variant="caption" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
              <DocsIcon sx={{ fontSize: 14 }} /> Hardware install guides
            </Link>
          </Box>
        </>
      )}
    </Popover>
  );
}
