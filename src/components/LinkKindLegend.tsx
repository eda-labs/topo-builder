import { useState } from 'react';
import { Panel } from '@xyflow/react';
import { Box, Grow, IconButton, Tooltip, Typography } from '@mui/material';
import { CloseOutlined as CloseIcon, InfoOutlined as InfoIcon } from '@mui/icons-material';

import { LINK_KIND_LEGEND } from '../lib/linkColors';

const STORAGE_KEY = 'topology-legend-open';
const PAPER_BG = 'background.paper';
const TEXT_SECONDARY = 'text.secondary';

/**
 * Cable-map's link-kind legend: InterSwitch / Edge / Local LAG / Multihome LAG swatches.
 * Bottom-right so it never collides with the hover HUD in the bottom-left corner.
 */
export default function LinkKindLegend() {
  const [open, setOpen] = useState(() => localStorage.getItem(STORAGE_KEY) !== '0');

  const setOpenPersisted = (next: boolean) => {
    localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
    setOpen(next);
  };

  return (
    <Panel position="bottom-right">
      {/* both states grow/shrink from the bottom-right corner; the collapsed icon is absolute
          so it adds no layout */}
      <Box sx={{ position: 'relative' }}>
        <Grow in={open} style={{ transformOrigin: 'bottom right' }} unmountOnExit>
          <Box
            data-testid="link-kind-legend"
            sx={{ position: 'relative', bgcolor: PAPER_BG, border: 1, borderColor: 'divider', borderRadius: 1.5, pl: 1.5, pr: 3.5, py: 1, boxShadow: 2 }}
          >
            <Tooltip title="Hide legend">
              <IconButton size="small" onClick={() => { setOpenPersisted(false); }} sx={{ position: 'absolute', top: 2, right: 2, p: 0.25 }}>
                <CloseIcon sx={{ fontSize: 14, color: TEXT_SECONDARY }} />
              </IconButton>
            </Tooltip>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 2, rowGap: 0.5, mb: 0.75 }}>
              {LINK_KIND_LEGEND.map(([label, swatch]) => (
                <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Box sx={{ width: 14, height: 6, borderRadius: 2, bgcolor: swatch }} />
                  <Typography variant="caption" sx={{ color: 'text.primary', fontWeight: 500 }}>{label}</Typography>
                </Box>
              ))}
            </Box>
            <Typography variant="caption" sx={{ color: TEXT_SECONDARY }}>
              Ports carry their link colour — hover or select a cable to trace it
            </Typography>
          </Box>
        </Grow>
        <Grow in={!open} style={{ transformOrigin: 'bottom right' }} unmountOnExit>
          <Box sx={{ position: 'absolute', bottom: 0, right: 0 }}>
            <Tooltip title="Show legend">
              <IconButton
                size="small"
                data-testid="link-kind-legend-toggle"
                onClick={() => { setOpenPersisted(true); }}
                sx={{ bgcolor: PAPER_BG, border: 1, borderColor: 'divider', boxShadow: 2, '&:hover': { bgcolor: PAPER_BG } }}
              >
                <InfoIcon sx={{ fontSize: 18, color: TEXT_SECONDARY }} />
              </IconButton>
            </Tooltip>
          </Box>
        </Grow>
      </Box>
    </Panel>
  );
}
