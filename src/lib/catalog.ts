/**
 * Platform catalog derived from the cable-map front-panel metadata.
 *
 * Fixed-faceplate platforms (SR Linux 7220/7250/7215/7730 and the 7750 SR-1 line-card variants)
 * become single catalog items. The modular SR OS chassis (SR-1, SR-1s, SR-2s, SR-2se) appear
 * once each with a sensible default card fit — anything beyond the default is the SR OS chassis
 * wizard's job. Card types are mapped back to their canonical component spelling
 * ("ms16-100gb-sfpdd+4-100gb-qsfp28") so the emitted YAML matches the cluster's TopoNodes.
 */
import type { Component } from '../types/schema';

import {
  SR1_LINECARD_STENCILS,
  frontPanelKeys,
  frontPanelMetaOf,
  resolveFrontPanel,
  sanitiseCardType,
} from './frontpanel';

export type CatalogOS = 'srl' | 'sros';

export interface CatalogFixedItem {
  kind: 'fixed';
  label: string;
  platform: string;
  os: CatalogOS;
  stencil: string;
  ports: number;
  components?: Component[];
}

export type CatalogItem = CatalogFixedItem;

export interface CatalogGroup {
  family: string;
  items: CatalogItem[];
}

// Canonical component `type` spellings (as used by TopoNodes on the cluster) for the sanitised
// card tokens embedded in composite stencil names.
const CANONICAL_CARD_TYPES = [
  // 7750 SR-1 MDAs
  'me12-100gb-qsfp28',
  'me16-25gb-sfp28+2-100gb-qsfp-b',
  'me16-25gb-sfp28+2-100gb-qsfp28',
  'me3-200gb-cfp2-dco',
  'me3-400gb-qsfpdd',
  'me6-100gb-qsfp28',
  'me6-400gb-qsfpdd',
  // 7750 SR-1s / SR-2s MDAs
  'ms16-100gb-sfpdd+4-100gb-qsfp28',
  'ms18-100gb-qsfp28',
  'ms2-400gb-qsfpdd+2-100gb-qsfp28',
  'ms24-10-100gb-sfpdd',
  'ms3-200gb-cfp2-dco',
  'ms4-400gb-qsfpdd+4-100gb-qsfp28',
  'ms6-300gb-cfp2-dco',
  'ms8-100gb-sfpdd+2-100gb-qsfp28',
  's18-100gb-qsfp28',
  's36-400gb-qsfpdd',
  // 7750 SR-2se MDAs
  'mse14-800g+4-400g',
  'mse24-200g-sfpdd',
  'mse6-800g-cfp2-dco',
  'mse6-800g-qsfpdd',
  'x2-s36-800g-qsfpdd-18.0t',
];

const CANONICAL_BY_TOKEN = new Map<string, string>(
  CANONICAL_CARD_TYPES.map(type => [sanitiseCardType(type), type]),
);

export const canonicalCardType = (token: string): string => CANONICAL_BY_TOKEN.get(token) ?? token;

// Longest prefixes first so "7750 SR-2se …" is not claimed by "7750 SR-2s".
const MODULAR_CHASSIS = ['7750 SR-2se', '7750 SR-2s', '7750 SR-1s', '7750 SR-1'];

function parseComboKey(key: string): { chassis: string; bay1: string; bay2: string | null } | null {
  for (const chassis of MODULAR_CHASSIS) {
    if (!key.startsWith(`${chassis} `)) continue;
    const combo = key.slice(chassis.length + 1);
    const separator = combo.indexOf('_');
    // No separator: a full-width card occupying the whole chassis ("7750 SR-1s s36-400gb-qsfpdd").
    if (separator <= 0) return { chassis, bay1: combo, bay2: null };
    return { chassis, bay1: combo.slice(0, separator), bay2: combo.slice(separator + 1) };
  }
  return null;
}

const familyOf = (label: string): string => {
  const [generation, model] = label.split(' ');
  return `${generation} ${model?.split('-')[0] ?? ''}`.trim();
};

// 7750 plus the wizard-only SR OS families; 7250/7220 stay SR Linux in this app.
const SROS_PLATFORM_PREFIX = /^(?:7750|7450|7705|7950)\b/;

export const osOfPlatform = (platform: string): CatalogOS =>
  SROS_PLATFORM_PREFIX.test(platform.trim()) ? 'sros' : 'srl';

/** MDA components for a modular-chassis combo; bays are numbered 1/2 like the cluster fixtures. */
export function componentsForCombo(bay1?: string | null, bay2?: string | null): Component[] {
  const components: Component[] = [];
  if (bay1) components.push({ kind: 'mda', slot: '1', type: canonicalCardType(bay1) });
  if (bay2) components.push({ kind: 'mda', slot: '2', type: canonicalCardType(bay2) });
  return components;
}

/** "7220 IXR-D3L" -> "d3l", "7750 SR-2se" -> "sr2se" — default name prefix for catalog nodes. */
export function namePrefixForPlatform(platform: string): string {
  const model = platform.trim().split(/\s+/).slice(1).join('-').toLowerCase();
  const prefix = model.replace(/^(ixr|ixs)-/, '').replace(/[^a-z0-9]/g, '');
  return prefix || 'node';
}

function fixedItemOf(label: string, platform: string, components?: Component[]): CatalogFixedItem | null {
  const meta = frontPanelMetaOf(label);
  if (!meta?.layout.length) return null;
  return { kind: 'fixed', label, platform, os: osOfPlatform(platform), stencil: label, ports: meta.ports, components };
}

function recordComboBays(
  chassisBays: Map<string, [Set<string>, Set<string>]>,
  combo: { chassis: string; bay1: string; bay2: string | null },
): void {
  let bays = chassisBays.get(combo.chassis);
  if (!bays) {
    bays = [new Set(), new Set()];
    chassisBays.set(combo.chassis, bays);
  }
  if (combo.bay1 !== 'blank') bays[0].add(canonicalCardType(combo.bay1));
  if (combo.bay2 && combo.bay2 !== 'blank') bays[1].add(canonicalCardType(combo.bay2));
}

function collectFixedItems(chassisBays: Map<string, [Set<string>, Set<string>]>): CatalogFixedItem[] {
  const items: CatalogFixedItem[] = [];
  const sr1Stencils = new Set(Object.values(SR1_LINECARD_STENCILS));

  for (const key of frontPanelKeys) {
    const combo = parseComboKey(key);
    if (combo) {
      recordComboBays(chassisBays, combo);
      continue;
    }
    if (sr1Stencils.has(key) && key !== '7750 SR-1se') continue; // added below with their line card
    const item = fixedItemOf(key, key);
    if (item) items.push(item);
  }

  // 7750 SR-1 integrated line-card variants: platform "7750 SR-1" + lineCard component.
  // The SR-1se faceplate is reachable as its own platform, so it is offered that way instead.
  for (const [card, stencil] of Object.entries(SR1_LINECARD_STENCILS)) {
    if (stencil === '7750 SR-1se') continue;
    const item = fixedItemOf(stencil, '7750 SR-1', [{ kind: 'lineCard', slot: '1', type: card }]);
    if (item) items.push(item);
  }

  return items;
}

// Preferred default card fit per modular chassis (SR-1 mirrors the SR OS default layout);
// anything unresolvable falls back to the first bay-card whose composite stencil exists.
const S36_400G_CARD = 's36-400gb-qsfpdd';
const DEFAULT_CHASSIS_CARDS: Record<string, [string, string | null]> = {
  '7750 SR-1': ['me6-100gb-qsfp28', 'me12-100gb-qsfp28'],
  '7750 SR-1s': [S36_400G_CARD, null],
  '7750 SR-2s': [S36_400G_CARD, null],
  '7750 SR-2se': ['x2-s36-800g-qsfpdd-18.0t', null],
};

/** One default item per modular chassis; other card combinations come from the SR OS wizard. */
function defaultChassisItem(chassis: string, bays: [Set<string>, Set<string>]): CatalogFixedItem | null {
  const candidates: [string, string | null][] = [];
  const preferred = DEFAULT_CHASSIS_CARDS[chassis];
  if (preferred) candidates.push(preferred);
  for (const bay1 of bays[0]) candidates.push([bay1, null]);
  for (const bay1 of bays[0]) {
    for (const bay2 of bays[1]) candidates.push([bay1, bay2]);
  }

  for (const [bay1, bay2] of candidates) {
    const components = componentsForCombo(bay1, bay2);
    const stencil = resolveFrontPanel(chassis, components);
    const meta = stencil ? frontPanelMetaOf(stencil) : undefined;
    if (stencil && meta?.layout.length) {
      return { kind: 'fixed', label: chassis, platform: chassis, os: 'sros', stencil, ports: meta.ports, components };
    }
  }
  return null;
}

function buildCatalog(): CatalogGroup[] {
  const chassisBays = new Map<string, [Set<string>, Set<string>]>();
  const fixedItems = collectFixedItems(chassisBays);

  const chassisItems: CatalogFixedItem[] = [...chassisBays.entries()]
    .map(([chassis, bays]) => defaultChassisItem(chassis, bays))
    .filter((item): item is CatalogFixedItem => item !== null);

  const byLabel = (a: CatalogItem, b: CatalogItem) =>
    a.label.localeCompare(b.label, undefined, { numeric: true });

  const groups = new Map<string, CatalogItem[]>();
  for (const item of [...fixedItems, ...chassisItems]) {
    const family = familyOf(item.platform);
    const items = groups.get(family) ?? [];
    items.push(item);
    groups.set(family, items);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([family, items]) => ({ family, items: items.sort(byLabel) }));
}

export const platformCatalog: readonly CatalogGroup[] = buildCatalog();
