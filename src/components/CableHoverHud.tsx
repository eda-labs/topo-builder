import { Panel } from '@xyflow/react';
import { Box, Chip, Typography } from '@mui/material';

import { useHoverTrace, type HoverHudInfo } from '../lib/store/hoverTrace';

const KIND_LABEL = { link: 'fabric link', sim: 'sim link', edge: 'edge link', free: 'free port' } as const;
const KIND_COLOR = { link: '#00A87E', sim: '#8E77D6', edge: '#4A90D9', free: '#8994a3' } as const;

function HudChip({ label, color }: { label: string; color?: string }) {
  return (
    <Chip
      label={label}
      size="small"
      sx={{
        height: 16,
        fontSize: 9,
        bgcolor: 'transparent',
        color: color ?? 'text.secondary',
        border: '1px solid',
        borderColor: color ?? 'divider',
        '& .MuiChip-label': { px: 0.5 },
      }}
    />
  );
}

function endpointLine(hud: HoverHudInfo): string {
  const a = [hud.nodeA, hud.ifaceA].filter(Boolean).join(' ');
  if (hud.kind === 'free') return a;
  const b = [hud.nodeB, hud.ifaceB].filter(Boolean).join(' ');
  return hud.kind === 'edge' ? `${a} ⇥ ${b}` : `${a} ↔ ${b}`;
}

/**
 * Bottom-left readout for the hovered cable/port (cable-map's TraceHud): full endpoint names
 * with interfaces, link kind, speed and LAG membership — hover help that a port-sized tooltip
 * cannot fit.
 */
export default function CableHoverHud() {
  const hud = useHoverTrace(state => state.hud);
  if (!hud) return null;

  return (
    <Panel position="bottom-left" style={{ pointerEvents: 'none', margin: 8 }}>
      <Box
        data-testid="cable-hover-hud"
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          px: 1,
          py: 0.5,
          borderRadius: 1,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          boxShadow: 2,
          maxWidth: '60vw',
        }}
      >
        <Typography
          variant="caption"
          sx={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
        >
          {endpointLine(hud)}
        </Typography>
        <HudChip label={KIND_LABEL[hud.kind]} color={KIND_COLOR[hud.kind]} />
        {hud.speedGbps != null && <HudChip label={`${hud.speedGbps}G`} />}
        {hud.lagName && <HudChip label={`LAG ${hud.lagName}`} />}
        {hud.linkName && (
          <Typography variant="caption" sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>
            {hud.linkName}
          </Typography>
        )}
      </Box>
    </Panel>
  );
}
