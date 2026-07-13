/**
 * SR OS connector components <-> front-panel breakout state.
 *
 * On SR OS, cabling a channel of a cage requires the cage's connector to be provisioned as a
 * component on the TopoNode ({ kind: "connector", slot: "1-a-3", type: "c4-25g" }); the type
 * carries the channel count and per-channel speed. This module derives cage native speeds from
 * the card naming scheme ("me6-100gb-qsfp28" = 6 cages of 100G), offers the valid breakout
 * choices per cage, and converts between the UI's breakouts map and connector component lists
 * so exported NetworkTopology YAML matches what the cluster expects.
 */
import type { Component, NodeTemplate } from '../types/schema';
import type { UINode } from '../types/ui';

import {
  SR1_LINECARD_STENCILS,
  mdaBayOfLetter,
  portAddressForInterface,
  resolveNodePanel,
  sanitiseCardType,
  srosCageAddress,
  type NodePanel,
} from './frontpanel';
import { isSrosNode } from './interfaces';
import { platformSpeedGroups, type SpeedGroup } from './portSpeeds';

// Card names encode "<count>-<speed>g[b]" port groups in panel order:
// "me16-25gb-sfp28+2-100gb-qsfp28" -> 16 cages of 25G followed by 2 cages of 100G.
const SPEED_GROUP_RE = /(\d+)-(\d+)gb?(?=-|$)/g;

// Names the group regex misreads ("ms24-10-100gb-sfpdd" is 24 cages of 10/100G).
const SPEED_GROUP_OVERRIDES: Record<string, SpeedGroup[]> = {
  'ms24-10-100gb-sfpdd': [{ count: 24, gbps: 100 }],
};

export function cardSpeedGroups(cardType: string): SpeedGroup[] {
  const token = sanitiseCardType(cardType.trim());
  const override = SPEED_GROUP_OVERRIDES[token];
  if (override) return override;
  const groups: SpeedGroup[] = [];
  for (const match of token.matchAll(SPEED_GROUP_RE)) {
    groups.push({ count: Number(match[1]), gbps: Number(match[2]) });
  }
  return groups;
}

const STENCIL_TO_SR1_CARD = new Map<string, string>(
  Object.entries(SR1_LINECARD_STENCILS).map(([card, stencil]) => [stencil, card]),
);

// Composite stencil keys are "<chassis> <bay1card>_<bay2card>" — card tokens never contain
// spaces. Full-width cards have a bare "<chassis> <card>" key serving both bays.
function bayCardFromStencil(stencil: string, bay: number): string | null {
  const combo = stencil.split(' ').at(-1);
  if (!combo) return null;
  if (!combo.includes('_')) return bay === 1 ? combo : null;
  const token = combo.split('_')[bay - 1];
  return token && token !== 'blank' ? token : null;
}

function panelSpeedGroups(panel: NodePanel, bay: string | null): SpeedGroup[] {
  if (bay) {
    const card = bayCardFromStencil(panel.stencil, Number(bay));
    return card ? cardSpeedGroups(card) : [];
  }
  for (const component of panel.components ?? []) {
    if (component.kind !== 'mda' && component.kind !== 'lineCard') continue;
    const groups = cardSpeedGroups(component.type);
    if (groups.length) return groups;
  }
  const sr1Card = STENCIL_TO_SR1_CARD.get(panel.stencil);
  if (sr1Card) return cardSpeedGroups(sr1Card);
  // Fixed faceplates without cards (SR Linux, SR-1se) carry their speeds per platform.
  return platformSpeedGroups(panel.platform);
}

/** Native speed (Gb/s) of a cage on a resolved panel, or null when the card layout is unknown. */
export function cageNativeSpeed(panel: NodePanel, cage: string): number | null {
  const parts = cage.split('-');
  const index = Number(parts.at(-1));
  if (!Number.isInteger(index) || index < 1) return null;
  const groups = panelSpeedGroups(panel, parts.length > 1 ? parts[0] : null);
  if (!groups.length) return null;
  let cumulative = 0;
  for (const group of groups) {
    cumulative += group.count;
    if (index <= cumulative) return group.gbps;
  }
  return groups[groups.length - 1].gbps;
}

// Channelisations SR OS supports per cage speed (connector types c<channels>-<speed>g).
const SROS_BREAKOUTS: Record<number, { channels: number; gbps: number }[]> = {
  800: [{ channels: 2, gbps: 400 }, { channels: 4, gbps: 200 }, { channels: 8, gbps: 100 }],
  400: [{ channels: 2, gbps: 200 }, { channels: 4, gbps: 100 }, { channels: 8, gbps: 50 }],
  300: [],
  200: [{ channels: 2, gbps: 100 }, { channels: 4, gbps: 50 }],
  100: [{ channels: 2, gbps: 50 }, { channels: 4, gbps: 25 }, { channels: 10, gbps: 10 }],
  50: [],
  40: [{ channels: 4, gbps: 10 }],
  25: [],
  10: [],
};

// Channelisations SR Linux supports per cage speed (EDA Breakout resources cap channels at 8).
const SRL_BREAKOUTS: Record<number, { channels: number; gbps: number }[]> = {
  800: [{ channels: 2, gbps: 400 }, { channels: 4, gbps: 200 }, { channels: 8, gbps: 100 }],
  400: [{ channels: 4, gbps: 100 }],
  100: [{ channels: 4, gbps: 25 }, { channels: 4, gbps: 10 }],
  40: [{ channels: 4, gbps: 10 }],
  25: [],
  10: [],
  1: [],
};

const GENERIC_CHANNEL_COUNTS = [2, 4, 8];

const isSrosPlatform = (platform: string): boolean =>
  platform.trim().toLowerCase().startsWith('7750');

const breakoutTableFor = (sros: boolean) => (sros ? SROS_BREAKOUTS : SRL_BREAKOUTS);

/** Per-channel speed implied by evenly dividing a cage: 100G / 4 -> 25. */
export const defaultChannelGbps = (nativeGbps: number, channels: number): number | null => {
  const gbps = nativeGbps / channels;
  return Number.isInteger(gbps) && gbps >= 1 ? gbps : null;
};

/** "40 × 200G + 6 × 800G" — human summary of a card's port groups, or null when unknown. */
export function speedGroupsLabel(cardType: string): string | null {
  const groups = cardSpeedGroups(cardType);
  if (!groups.length) return null;
  return groups.map(g => `${g.count} × ${g.gbps}G`).join(' + ');
}

/** Per-speed breakout capabilities of a panel, e.g. ["100G → 2 × 50G · 4 × 25G · 10 × 10G"]. */
export function panelBreakoutSummary(panel: NodePanel): string[] {
  const table = breakoutTableFor(isSrosPlatform(panel.platform));
  const speeds = new Set<number>();
  const bays = panel.meta.slotted ? ['1', '2'] : [null];
  for (const bay of bays) {
    for (const group of panelSpeedGroups(panel, bay)) speeds.add(group.gbps);
  }
  const lines: string[] = [];
  for (const speed of [...speeds].sort((a, b) => b - a)) {
    const options = table[speed];
    if (options?.length) {
      const choices = options.map(o => `${o.channels} × ${o.gbps}G`).join(' · ');
      lines.push(`${speed}G → ${choices}`);
    }
  }
  return lines;
}

export interface BreakoutOption { channels: number; gbps?: number; label: string }

/**
 * Breakout choices for a cage. Cages with a known native speed offer only the channelisations
 * their OS supports (labelled with the per-channel speed); everything else falls back to 2/4/8.
 */
export function breakoutOptionsFor(panel: NodePanel, cage: string, sros: boolean): BreakoutOption[] {
  const speed = cageNativeSpeed(panel, cage);
  const options = speed == null ? undefined : breakoutTableFor(sros)[speed];
  if (options) {
    return options.map(o => ({ channels: o.channels, gbps: o.gbps, label: `${o.channels} × ${o.gbps}G` }));
  }
  return GENERIC_CHANNEL_COUNTS.map(n => ({ channels: n, label: `${n} channels` }));
}

function connectorTypeFor(speed: number, channels: number): string | null {
  if (channels === 1) return `c1-${speed}g`;
  const option = SROS_BREAKOUTS[speed]?.find(o => o.channels === channels);
  return option ? `c${channels}-${option.gbps}g` : null;
}

const CONNECTOR_TYPE_RE = /^c(\d+)-/i;
const CONNECTOR_SLOT_RE = /^(\d+)-([a-z])-(\d+)$/i;

export function connectorChannels(type: string): number | null {
  const match = CONNECTOR_TYPE_RE.exec(type.trim());
  return match ? Number(match[1]) : null;
}

function cageForConnectorSlot(slot: string, slotted: boolean): string | null {
  const match = CONNECTOR_SLOT_RE.exec(slot.trim());
  if (!match) return null;
  return slotted ? `${mdaBayOfLetter(match[2])}-${match[3]}` : match[3];
}

const bySlotNumeric = (a: Component, b: Component) =>
  (a.slot ?? '').localeCompare(b.slot ?? '', undefined, { numeric: true });

interface GeneratedConnectors { components: Component[]; covered: Set<string> }

function connectorsFromBreakouts(
  breakouts: Record<string, number> | undefined,
  panel: NodePanel | null,
): GeneratedConnectors {
  const components: Component[] = [];
  const covered = new Set<string>();
  if (!breakouts || !panel) return { components, covered };
  for (const [cage, channels] of Object.entries(breakouts)) {
    const address = srosCageAddress(cage, panel.components);
    const speed = cageNativeSpeed(panel, cage);
    if (!address || speed == null) continue;
    const type = connectorTypeFor(speed, channels);
    if (!type) continue;
    components.push({ kind: 'connector', slot: `${address.lc}-${address.letter}-${address.port}`, type });
    covered.add(cage);
  }
  return { components, covered };
}

export interface NodeComponentsExport {
  components: Component[];
  /** breakouts that could not be expressed as connector components (persisted as annotation) */
  residualBreakouts?: Record<string, number>;
}

// On SR OS a cabled cage rides on a provisioned connector even without a breakout
// (c1-<native speed>g), so every cage referenced by a link gets one.
function plainConnectorsForCabledCages(options: {
  usedInterfaces: string[];
  panel: NodePanel;
  breakouts: Record<string, number> | undefined;
  connectorised: Set<string>;
}): Component[] {
  const { usedInterfaces, panel, breakouts, connectorised } = options;

  const channelled = new Set<string>();
  const cabled = new Set<string>();
  for (const iface of usedInterfaces) {
    const address = portAddressForInterface(iface, panel.meta);
    if (!address || !panel.meta.layout.some(p => p.p === address.cage)) continue;
    cabled.add(address.cage);
    // channel 1 also exists on plain c1 connectors ("1/1/c3/1"), so only >= 2 implies a breakout
    if (address.channel && address.channel >= 2) channelled.add(address.cage);
  }

  const components: Component[] = [];
  for (const cage of cabled) {
    if (connectorised.has(cage) || breakouts?.[cage]) continue;
    // A channelised interface without breakout state needs a multi-channel connector we
    // cannot size here; the importer infers the breakout instead of guessing c1.
    if (channelled.has(cage)) continue;
    const address = srosCageAddress(cage, panel.components);
    const speed = cageNativeSpeed(panel, cage);
    if (!address || speed == null) continue;
    components.push({ kind: 'connector', slot: `${address.lc}-${address.letter}-${address.port}`, type: `c1-${speed}g` });
  }
  return components;
}

/**
 * Components to emit for a topology node. SR OS breakouts become connector components, cabled
 * SR OS cages get their plain c1 connector, and explicit components from the YAML/catalog pass
 * through, except connectors superseded by breakout state.
 */
export function exportNodeComponents(
  node: UINode,
  nodeTemplates: NodeTemplate[],
  usedInterfaces: string[] = [],
): NodeComponentsExport {
  const own = node.data.components ?? [];
  const breakouts = node.data.breakouts;
  if (!isSrosNode(node, nodeTemplates)) {
    return { components: own, residualBreakouts: breakouts };
  }

  const panel = resolveNodePanel(node.data, nodeTemplates);
  const { components: generated, covered } = connectorsFromBreakouts(breakouts, panel);
  const slotted = panel?.meta.slotted ?? false;

  const kept = own.filter(component => {
    if (component.kind !== 'connector' || !component.slot) return true;
    const cage = cageForConnectorSlot(component.slot, slotted);
    if (cage == null) return true;
    // A breakout on this cage regenerates the connector; a removed breakout drops stale
    // multi-channel connectors while explicit single-channel connectors survive.
    if (breakouts?.[cage]) return false;
    return (connectorChannels(component.type) ?? 1) === 1;
  });

  if (panel) {
    const connectorised = new Set<string>();
    for (const component of [...kept, ...generated]) {
      if (component.kind !== 'connector' || !component.slot) continue;
      const cage = cageForConnectorSlot(component.slot, slotted);
      if (cage) connectorised.add(cage);
    }
    generated.push(...plainConnectorsForCabledCages({ usedInterfaces, panel, breakouts, connectorised }));
  }

  const connectors = [...kept.filter(c => c.kind === 'connector'), ...generated].sort(bySlotNumeric);
  const components = [...kept.filter(c => c.kind !== 'connector'), ...connectors];

  const residual = Object.fromEntries(
    Object.entries(breakouts ?? {}).filter(([cage]) => !covered.has(cage)),
  );
  return {
    components,
    residualBreakouts: Object.keys(residual).length ? residual : undefined,
  };
}

function breakoutsImpliedByConnectors(components: Component[], panel: NodePanel): Record<string, number> {
  const derived: Record<string, number> = {};
  for (const component of components) {
    if (component.kind !== 'connector' || !component.slot) continue;
    const channels = connectorChannels(component.type);
    if (!channels || channels < 2) continue;
    const cage = cageForConnectorSlot(component.slot, panel.meta.slotted);
    if (cage && panel.meta.layout.some(p => p.p === cage)) derived[cage] = channels;
  }
  return derived;
}

/**
 * Breakout state implied by connector components (channels >= 2) when importing YAML, merged
 * under any explicit breakout annotation.
 */
export function deriveBreakoutsFromComponents(nodes: UINode[], nodeTemplates: NodeTemplate[]): void {
  for (const node of nodes) {
    if (node.data.nodeType === 'simnode' || !node.data.components?.length) continue;
    const panel = resolveNodePanel(node.data, nodeTemplates);
    if (!panel) continue;
    const derived = breakoutsImpliedByConnectors(node.data.components, panel);
    if (Object.keys(derived).length) {
      node.data.breakouts = { ...derived, ...node.data.breakouts };
    }
  }
}
