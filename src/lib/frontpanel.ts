/**
 * Front-panel metadata and geometry.
 *
 * The per-platform port-cage layouts in `src/generated/frontpanel-meta.json` are extracted from
 * the cable-map front-panel stencil SVGs: for every platform they carry the port count, the number
 * of physical cage rows, the faceplate aspect ratio and the normalised position/size of every cage
 * on the panel. This module resolves a node's platform (and fitted cards, for modular chassis) to
 * that metadata, converts between EDA interface names and cage ids, and provides the pixel
 * geometry used to render nodes and anchor cables at their exact ports.
 */
import frontpanelMeta from '../generated/frontpanel-meta.json';
import frontpanelLabels from '../generated/frontpanel-labels.json';
import type { Component, NodeTemplate } from '../types/schema';
import type { UINodeData } from '../types/ui';

export interface FrontPanelPortPos { p: string; x: number; y: number; w: number; h: number }
export interface FrontPanelMeta {
  ports: number;
  rows: number;
  aspect: number;
  slotted: boolean;
  layout: FrontPanelPortPos[];
}

const FP_META = frontpanelMeta as Record<string, FrontPanelMeta>;
const FP_LABEL_STYLE = frontpanelLabels as Record<string, Record<string, 'c' | ''>>;

// Platform strings in topologies are not case-normalised ("7250 IXR-X1B" vs the meta's
// "7250 IXR-X1b"), so all lookups go through a lowercase index.
const KEY_BY_LOWER = new Map<string, string>(Object.keys(FP_META).map(k => [k.toLowerCase(), k]));

const metaKeyOf = (name: string | undefined): string | null => {
  if (!name) return null;
  return KEY_BY_LOWER.get(name.trim().toLowerCase()) ?? null;
};

// 7750 SR-1 integrated variants: the line card fixes the faceplate.
const SR1_LINECARD_STENCIL: Record<string, string> = {
  'i24-800g-qsfpdd-1': '7750 SR-1-24D',
  'i40-200g-sfpdd+6-800g-qsfpdd-1': '7750 SR-1-46S',
  'i48-400g-qsfpdd-1': '7750 SR-1-48D',
  'i80-200g-sfpdd+12-400g-qsfpdd-1': '7750 SR-1-92S',
  'i48-800g-qsfpdd-1x': '7750 SR-1x-48D',
  'i80-200g-sfpdd+12-800g-qsfpdd-1x': '7750 SR-1x-92S',
  'imm36-800g-qsfpdd': '7750 SR-1se',
};

// '/' and '+' are flattened to '-' in the pre-generated composite stencil names.
const sanitise = (t: string) => t.replace(/[/+]/g, '-');

const mdaBay = (slot: string | undefined): '1' | '2' | null => {
  const tail = (slot ?? '').split('/').pop() ?? '';
  const letter = tail.toLowerCase().split(/[-_]/).find(part => part === 'a' || part === 'b');
  if (letter === 'a') return '1';
  if (letter === 'b') return '2';
  if (tail === '1' || tail === '2') return tail;
  return null;
};

function sr1LineCardStencil(components?: Component[]): string | null {
  const lineCard = components?.find(c => c.kind === 'lineCard')?.type;
  if (!lineCard) return null;
  const variant = SR1_LINECARD_STENCIL[lineCard] ?? SR1_LINECARD_STENCIL[sanitise(lineCard)];
  return metaKeyOf(variant);
}

// Two-bay MDA chassis (7750 SR-1 / SR-1s): "<platform> <mda1>_<mda2>", empty bay -> "blank".
function twoBayStencil(platform: string, components?: Component[]): string | null {
  const bays = new Map<string, string>();
  for (const c of components ?? []) {
    if (c.kind !== 'mda' || !c.type) continue;
    const bay = mdaBay(c.slot);
    if (bay && !bays.has(bay)) bays.set(bay, sanitise(c.type));
  }
  if (!bays.size) return null;
  return metaKeyOf(`${platform} ${bays.get('1') ?? 'blank'}_${bays.get('2') ?? 'blank'}`);
}

/**
 * Resolve a platform (+ fitted components, for modular chassis) to a front-panel meta key,
 * or null when no faceplate is known for it.
 */
export function resolveFrontPanel(platform?: string, components?: Component[]): string | null {
  if (!platform) return null;
  const trimmed = platform.trim();

  if (trimmed === '7750 SR-1') {
    const lineCardKey = sr1LineCardStencil(components);
    if (lineCardKey) return lineCardKey;
  }
  if (trimmed === '7750 SR-1' || trimmed === '7750 SR-1s') {
    return twoBayStencil(trimmed, components);
  }

  return metaKeyOf(platform);
}

export const frontPanelMetaOf = (stencil: string): FrontPanelMeta | undefined => FP_META[stencil];

export interface NodePanel { stencil: string; meta: FrontPanelMeta; platform: string; components?: Component[] }

/** Front panel for a topology node: platform/components from the node, falling back to its template. */
export function resolveNodePanel(
  data: Pick<UINodeData, 'platform' | 'template'> & { components?: Component[] },
  nodeTemplates: NodeTemplate[],
): NodePanel | null {
  const template = data.template ? nodeTemplates.find(t => t.name === data.template) : undefined;
  const platform = data.platform || template?.platform;
  if (!platform) return null;
  const components = data.components ?? template?.components;
  const stencil = resolveFrontPanel(platform, components);
  if (!stencil) return null;
  const meta = FP_META[stencil];
  if (!meta.layout.length) return null;
  return { stencil, meta, platform, components };
}

// User-facing cage labels copied from the stencil silkscreen ("c1" vs "1" per slot).
export function frontPanelPortLabel(stencil: string, cage: string): string {
  const parts = cage.split('-');
  const number = parts.at(-1) ?? cage;
  const slot = parts.length > 1 ? parts.slice(0, -1).join('-') : '';
  return `${FP_LABEL_STYLE[stencil]?.[slot] ?? ''}${number}`;
}

// ---- pixel geometry ------------------------------------------------------

// Panel height scales with the physical cage-row count so port cells stay legible;
// width follows from the faceplate aspect ratio (same rule as cable-map).
const LAYOUT_ROW = 19;
export const FP_PAD = 8;
export const FP_HEADER_H = 26;

export const panelDims = (meta: FrontPanelMeta): { w: number; h: number } => ({
  w: Math.max(1, meta.rows) * LAYOUT_ROW * (meta.aspect || 4),
  h: Math.max(1, meta.rows) * LAYOUT_ROW,
});

export const frontPanelNodeSize = (meta: FrontPanelMeta): { width: number; height: number } => {
  const { w, h } = panelDims(meta);
  return { width: w + FP_PAD * 2, height: h + FP_HEADER_H + FP_PAD * 2 };
};

export interface PortBox { left: number; top: number; width: number; height: number }

// Cage rectangle in panel-local pixels.
export function portBox(meta: FrontPanelMeta, pos: FrontPanelPortPos): PortBox {
  const { w: W, h: H } = panelDims(meta);
  const width = Math.max(3, pos.w * W);
  const height = Math.max(3, pos.h * H);
  return { left: pos.x * W - width / 2, top: pos.y * H - height / 2, width, height };
}

// Broken-out cages split into a small channel grid: one row up to 4 channels, two rows beyond.
export function breakoutGrid(channels: number): { cols: number; rows: number } {
  const n = Math.max(1, channels);
  const rows = n > 4 ? 2 : 1;
  return { cols: Math.ceil(n / rows), rows };
}

// Channel sliver rectangle within its cage box (channel is 1-based).
export function breakoutChannelBox(box: PortBox, channel: number, channels: number): PortBox {
  const { cols, rows } = breakoutGrid(channels);
  const ch = Math.max(1, Math.min(channels, channel));
  const width = box.width / cols;
  const height = box.height / rows;
  return {
    left: box.left + ((ch - 1) % cols) * width,
    top: box.top + Math.floor((ch - 1) / cols) * height,
    width,
    height,
  };
}

// Cage (or breakout-channel) centre in node-local pixels, for anchoring cables.
export function portCenterInNode(
  meta: FrontPanelMeta,
  cage: string,
  breakout?: { channel: number; channels: number },
): { x: number; y: number } | null {
  const pos = meta.layout.find(p => p.p === cage);
  if (!pos) return null;
  const { w: W, h: H } = panelDims(meta);
  const center = { x: FP_PAD + pos.x * W, y: FP_HEADER_H + FP_PAD + pos.y * H };
  if (!breakout) return center;
  const box = portBox(meta, pos);
  const sliver = breakoutChannelBox(box, breakout.channel, breakout.channels);
  return {
    x: center.x - box.width / 2 + (sliver.left - box.left) + sliver.width / 2,
    y: center.y - box.height / 2 + (sliver.top - box.top) + sliver.height / 2,
  };
}

// ---- breakout persistence ("cage:channels,cage:channels") ----------------

export function parseBreakouts(value: string | undefined): Record<string, number> | undefined {
  if (!value) return undefined;
  const breakouts: Record<string, number> = {};
  for (const entry of value.split(',')) {
    const [cage, channels] = entry.split(':');
    const n = Number(channels);
    if (cage && Number.isInteger(n) && n >= 2 && n <= 16) breakouts[cage.trim()] = n;
  }
  return Object.keys(breakouts).length ? breakouts : undefined;
}

export function formatBreakouts(breakouts: Record<string, number> | undefined): string | null {
  if (!breakouts) return null;
  const entries = Object.entries(breakouts)
    .filter(([, n]) => Number.isInteger(n) && n >= 2)
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));
  if (!entries.length) return null;
  return entries.map(([cage, n]) => `${cage}:${n}`).join(',');
}

// ---- interface name <-> cage id -----------------------------------------

const SROS_EDA_RE = /^ethernet-(\d+)-([a-z])-(\d+)(?:-(\d+))?$/i;
const SRL_RE = /^ethernet-(\d+)-(\d+)(?:-(\d+))?$/i;

const mdaNumber = (letter: string): number => letter.toLowerCase().charCodeAt(0) - 96;

export interface InterfacePortAddress { cage: string; channel?: number }

/**
 * Front-panel cage id (+ breakout channel) for an EDA interface name, or null when it doesn't
 * parse. SR Linux "ethernet-1-12[-ch]" -> "12"; SR OS "ethernet-1-a-6[-p]" -> "6" on fixed
 * faceplates and "<bay>-6" on slotted (two-bay MDA) composites.
 */
export function portAddressForInterface(iface: string, meta: FrontPanelMeta): InterfacePortAddress | null {
  const sros = SROS_EDA_RE.exec(iface.trim());
  if (sros) {
    const connector = sros[3];
    const channel = sros[4] == null ? undefined : Number(sros[4]);
    if (!meta.slotted) return { cage: connector, channel };
    return { cage: `${mdaNumber(sros[2])}-${connector}`, channel };
  }
  const srl = SRL_RE.exec(iface.trim());
  if (srl) {
    const channel = srl[3] == null ? undefined : Number(srl[3]);
    if (!meta.slotted) return { cage: srl[2], channel };
    return { cage: `${srl[1]}-${srl[2]}`, channel };
  }
  return null;
}

export function cageForInterface(iface: string, meta: FrontPanelMeta): string | null {
  return portAddressForInterface(iface, meta)?.cage ?? null;
}

export interface InterfaceForCageOptions {
  sros: boolean;
  components?: Component[];
  usedInterfaces: string[];
  /** breakout channel (1-based) when cabling a channel sliver of a broken-out cage */
  channel?: number;
}

/**
 * EDA interface name for a cage the user cabled directly. SR Linux cages map 1:1 to
 * "ethernet-1-<cage>" ("-<channel>" appended for breakout channels). SR OS cages map to
 * "ethernet-<lc>-<mda>-<connector>"; when that connector name is taken (multi-port connector
 * cards), fall through its channels.
 */
export function interfaceForCage(cage: string, opts: InterfaceForCageOptions): string | null {
  const parts = cage.split('-');
  const port = parts.at(-1);
  if (!port || !/^\d+$/.test(port)) return null;

  const used = new Set(opts.usedInterfaces);
  if (!opts.sros) {
    const iface = opts.channel ? `ethernet-1-${port}-${opts.channel}` : `ethernet-1-${port}`;
    return used.has(iface) ? null : iface;
  }

  const bay = parts.length > 1 ? Number(parts[0]) : null;
  const mda = opts.components?.find(c => c.kind === 'mda' && c.slot)?.slot?.match(/^(\d+)-([a-z])$/);
  const linecard = mda ? mda[1] : '1';
  let letter = mda ? mda[2] : 'a';
  if (bay) letter = String.fromCharCode(96 + bay);

  const base = `ethernet-${linecard}-${letter}-${port}`;
  if (opts.channel) {
    const iface = `${base}-${opts.channel}`;
    return used.has(iface) ? null : iface;
  }
  if (!used.has(base)) return base;
  for (let channel = 1; channel <= 8; channel++) {
    const candidate = `${base}-${channel}`;
    if (!used.has(candidate)) return candidate;
  }
  return null;
}

// ---- canvas painting ------------------------------------------------------

export interface PaintPanelOptions {
  width: number;
  height: number;
  /** cage id -> fill colour for occupied cages */
  occupied?: ReadonlyMap<string, string>;
  freeFill: string;
  freeLine: string;
}

/** Paint the faceplate cages onto a canvas (zoomed-out nodes, palette previews). */
export function paintPanel(canvas: HTMLCanvasElement, meta: FrontPanelMeta, opts: PaintPanelOptions): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(opts.width * dpr));
  canvas.height = Math.max(1, Math.round(opts.height * dpr));
  canvas.style.width = `${opts.width}px`;
  canvas.style.height = `${opts.height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, opts.width, opts.height);

  const { w: W, h: H } = panelDims(meta);
  const sx = opts.width / W;
  const sy = opts.height / H;
  for (const pos of meta.layout) {
    const box = portBox(meta, pos);
    const fill = opts.occupied?.get(pos.p);
    ctx.fillStyle = fill ?? opts.freeFill;
    ctx.fillRect(box.left * sx, box.top * sy, box.width * sx, box.height * sy);
    if (!fill) {
      ctx.strokeStyle = opts.freeLine;
      ctx.lineWidth = 1;
      ctx.strokeRect(box.left * sx + 0.5, box.top * sy + 0.5, Math.max(0, box.width * sx - 1), Math.max(0, box.height * sy - 1));
    }
  }
}
