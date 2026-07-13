import type { HoverHudInfo } from './store/hoverTrace';

/**
 * Colour per link kind — exactly cable-map's palette and taxonomy: InterSwitch (blue), Edge
 * (teal — links to servers/sim nodes and edge-links alike), Local LAG (yellow), Multihome LAG
 * (purple). Ports wear their kind colour permanently; cables stay neutral and only take the
 * kind colour while hovered or selected.
 */
export const LINK_KIND_COLOR: Record<HoverHudInfo['kind'], string> = {
  link: '#4092ff',
  sim: '#23abb6',
  edge: '#23abb6',
  free: '#8994a3',
  lag: '#f7b737',
  mlag: '#9765fe',
};

/** Legend rows in cable-map's order (free ports are self-evident and stay out of the legend). */
export const LINK_KIND_LEGEND: readonly [string, string][] = [
  ['InterSwitch', LINK_KIND_COLOR.link],
  ['Edge', LINK_KIND_COLOR.edge],
  ['Local LAG', LINK_KIND_COLOR.lag],
  ['Multihome LAG', LINK_KIND_COLOR.mlag],
];

/**
 * Cable-map's cable weight: idle is a thin muted thread in its kind colour, a traced/selected
 * cable pops thick and fully opaque, everything else fades away while a trace is active.
 */
export const cableStrokeWidth = (on: boolean): number => (on ? 2.6 : 1.1);

export const cableOpacity = (on: boolean, dim: boolean): number => {
  if (dim) return 0.12;
  return on ? 1 : 0.62;
};
