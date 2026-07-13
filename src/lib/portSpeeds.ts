/**
 * Native port speeds of the fixed-faceplate platforms (SR Linux 7220/7215/7250/7730).
 *
 * SR OS cards encode their speeds in the card name ("me6-100gb-qsfp28"), but SR Linux
 * platforms carry no components, so the per-cage speeds live here. Groups are listed in
 * front-panel cage order (cage ids are 1-based and contiguous); the split between QSFP
 * and SFP cages was cross-checked against the cable-map stencil geometry, the port classes
 * against the Nokia datasheets.
 */

export interface SpeedGroup {
  count: number;
  gbps: number;
}

const G = (count: number, gbps: number): SpeedGroup => ({ count, gbps });

const PLATFORM_SPEED_GROUPS: Record<string, SpeedGroup[]> = {
  '7215 IXS-A1': [G(48, 1), G(4, 10)],
  '7220 IXR-D1': [G(48, 1), G(4, 10)],
  '7220 IXR-D2': [G(48, 25), G(8, 100)],
  '7220 IXR-D2L': [G(48, 25), G(8, 100), G(2, 10)],
  // On the D3 the two SFP+ cages lead the faceplate; the D3L moved them to ports 33/34.
  '7220 IXR-D3': [G(2, 10), G(32, 100)],
  '7220 IXR-D3L': [G(32, 100), G(2, 10)],
  '7220 IXR-D4': [G(28, 100), G(8, 400)],
  '7220 IXR-D5': [G(32, 400), G(2, 10)],
  '7220 IXR-H2': [G(128, 100)],
  '7220 IXR-H3': [G(2, 10), G(32, 400)],
  '7220 IXR-H4': [G(64, 400), G(2, 25)],
  '7220 IXR-H4-32D': [G(32, 400), G(1, 25)],
  '7220 IXR-H5-32D': [G(32, 800), G(2, 25)],
  '7220 IXR-H5-64D': [G(64, 800), G(2, 25)],
  '7220 IXR-H5-64O': [G(64, 800), G(2, 25)],
  '7250 IXR-X1b': [G(36, 400)],
  '7250 IXR-X3b': [G(36, 800)],
  '7730 SXR-1D-32D': [G(32, 400)],
  // 40 SFP-DD 100G cages with a QSFP-DD 400G pair at each row end (21/22 and 43/44).
  '7730 SXR-1X-44S': [G(20, 100), G(2, 400), G(20, 100), G(2, 400)],
};

const GROUPS_BY_LOWER = new Map<string, SpeedGroup[]>(
  Object.entries(PLATFORM_SPEED_GROUPS).map(([platform, groups]) => [platform.toLowerCase(), groups]),
);

/** Speed groups (in cage order) for a fixed-faceplate platform, or [] when unknown. */
export function platformSpeedGroups(platform: string | undefined): SpeedGroup[] {
  if (!platform) return [];
  return GROUPS_BY_LOWER.get(platform.trim().toLowerCase()) ?? [];
}
