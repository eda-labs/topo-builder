/**
 * SR Linux breakouts <-> NetworkTopology link templates.
 *
 * EDA breaks out SR Linux ports through the link template: a template carrying
 * `breakouts: [{ local/remote: { channels, speed } }]` makes every link that references it
 * break out the corresponding endpoint (the endpoint interface then names the channel,
 * "ethernet-1-1-1"). SR OS cages are excluded — their breakouts are connector components on
 * the node (see connectors.ts).
 *
 * On export, links whose endpoints land on broken-out SR Linux cages are re-pointed at a
 * derived template ("isl-r4x100g") tagged with the breakout-variant annotation; on import,
 * those variants collapse back onto their base template after their breakout intent has been
 * harvested into per-node breakout state.
 */
import type { Link, LinkTemplate, LinkTemplateBreakout, NodeTemplate } from '../../types/schema';
import type { UINode } from '../../types/ui';
import { ANNOTATION_BREAKOUT_VARIANT } from '../constants';
import { cageNativeSpeed, defaultChannelGbps } from '../connectors';
import { portAddressForInterface, resolveNodePanel, type NodePanel } from '../frontpanel';
import { isSrosNode } from '../interfaces';

interface EndpointBreakout {
  channels: number;
  gbps: number;
}

interface NodeBreakoutInfo {
  sros: boolean;
  panel: NodePanel | null;
  breakouts: Record<string, number>;
  speeds: Record<string, number>;
}

// SR Linux channel interface without panel context: ethernet-<lc>-<port>-<channel>.
const SRL_CHANNEL_RE = /^ethernet-\d+-(\d+)-(\d+)$/;

const speedString = (gbps: number): string => `${gbps}G`;

const parseSpeed = (speed: string | undefined): number | null => {
  const match = /^(\d+(?:\.\d+)?)G$/i.exec((speed ?? '').trim());
  if (!match) return null;
  const gbps = Number(match[1]);
  return gbps >= 1 ? gbps : null;
};

function buildNodeInfo(nodes: UINode[], nodeTemplates: NodeTemplate[]): Map<string, NodeBreakoutInfo> {
  const infoByName = new Map<string, NodeBreakoutInfo>();
  for (const node of nodes) {
    if (node.data.nodeType === 'simnode') continue;
    infoByName.set(node.data.name, {
      sros: isSrosNode(node, nodeTemplates),
      panel: resolveNodePanel(node.data, nodeTemplates),
      breakouts: node.data.breakouts ?? {},
      speeds: node.data.breakoutSpeeds ?? {},
    });
  }
  return infoByName;
}

/** Cage id + channel for an interface, falling back to the plain SR Linux form. */
function channelledCage(iface: string, panel: NodePanel | null): { cage: string; channel: number } | null {
  if (panel) {
    const address = portAddressForInterface(iface, panel.meta);
    return address?.channel ? { cage: address.cage, channel: address.channel } : null;
  }
  const match = SRL_CHANNEL_RE.exec(iface.trim());
  return match ? { cage: match[1], channel: Number(match[2]) } : null;
}

function endpointBreakout(
  infoByName: Map<string, NodeBreakoutInfo>,
  nodeName: string | undefined,
  iface: string | undefined,
): EndpointBreakout | null {
  if (!nodeName || !iface) return null;
  const info = infoByName.get(nodeName);
  if (!info || info.sros) return null;
  const address = channelledCage(iface, info.panel);
  if (!address) return null;
  const channels = info.breakouts[address.cage];
  if (!channels) return null;
  const native = info.panel ? cageNativeSpeed(info.panel, address.cage) : null;
  const gbps = info.speeds[address.cage] ?? (native == null ? null : defaultChannelGbps(native, channels));
  if (gbps == null) return null;
  return { channels, gbps };
}

const sameSpec = (a: EndpointBreakout | null, b: EndpointBreakout | null): boolean =>
  a === b || (!!a && !!b && a.channels === b.channels && a.gbps === b.gbps);

interface LinkSignature {
  local: EndpointBreakout | null;
  remote: EndpointBreakout | null;
}

/** Uniform breakout signature across all endpoints of a link, or undefined when mixed. */
function linkSignature(link: Link, infoByName: Map<string, NodeBreakoutInfo>): LinkSignature | undefined {
  let signature: LinkSignature | null = null;
  for (const endpoint of link.endpoints ?? []) {
    const current: LinkSignature = {
      local: endpointBreakout(infoByName, endpoint.local?.node, endpoint.local?.interface),
      remote: endpointBreakout(infoByName, endpoint.remote?.node, endpoint.remote?.interface),
    };
    if (!signature) {
      signature = current;
    } else if (!sameSpec(signature.local, current.local) || !sameSpec(signature.remote, current.remote)) {
      return undefined;
    }
  }
  return signature ?? { local: null, remote: null };
}

const specMatches = (spec: EndpointBreakout | null, declared?: { channels?: number; speed?: string }): boolean => {
  if (!spec) return !declared?.channels && !declared?.speed;
  return declared?.channels === spec.channels && parseSpeed(declared?.speed) === spec.gbps;
};

function templateMatches(template: LinkTemplate | undefined, signature: LinkSignature): boolean {
  const declared = template?.breakouts;
  if (!signature.local && !signature.remote) return !declared?.length;
  if (declared?.length !== 1) return false;
  return specMatches(signature.local, declared[0].local) && specMatches(signature.remote, declared[0].remote);
}

function variantName(base: string, signature: LinkSignature): string {
  const parts = [base || 'link'];
  if (signature.local) parts.push(`l${signature.local.channels}x${signature.local.gbps}g`);
  if (signature.remote) parts.push(`r${signature.remote.channels}x${signature.remote.gbps}g`);
  if (!signature.local && !signature.remote) parts.push('plain');
  return parts.join('-');
}

function breakoutEntry(signature: LinkSignature): LinkTemplateBreakout[] | undefined {
  if (!signature.local && !signature.remote) return undefined;
  const entry: LinkTemplateBreakout = {};
  if (signature.local) entry.local = { channels: signature.local.channels, speed: speedString(signature.local.gbps) };
  if (signature.remote) entry.remote = { channels: signature.remote.channels, speed: speedString(signature.remote.gbps) };
  return [entry];
}

/**
 * Re-point links landing on broken-out SR Linux cages at derived breakout templates.
 * Mutates link.template; returns the final template list (base templates + derived variants).
 */
export function applyBreakoutTemplates(options: {
  links: Link[];
  linkTemplates: LinkTemplate[];
  nodes: UINode[];
  nodeTemplates: NodeTemplate[];
}): LinkTemplate[] {
  const { links, linkTemplates, nodes, nodeTemplates } = options;

  const infoByName = buildNodeInfo(nodes, nodeTemplates);
  const templatesByName = new Map(linkTemplates.map(t => [t.name, t]));
  const derived: LinkTemplate[] = [];

  for (const link of links) {
    const signature = linkSignature(link, infoByName);
    if (!signature) continue; // mixed endpoint breakouts: leave the link on its base template

    const baseName = link.template ?? '';
    const base = templatesByName.get(baseName);
    if (templateMatches(base, signature)) continue;
    // A plain link on a breakout-free base template needs no variant even when the base is unknown.
    if (!base && !signature.local && !signature.remote) continue;

    const name = variantName(baseName, signature);
    const existing = templatesByName.get(name);
    if (existing) {
      if (templateMatches(existing, signature)) link.template = name;
      continue; // name collision with a different shape: keep the base template
    }

    const variant: LinkTemplate = {
      ...(base ?? {}),
      name,
      breakouts: breakoutEntry(signature),
      annotations: { ...base?.annotations, [ANNOTATION_BREAKOUT_VARIANT]: baseName },
    };
    if (!variant.breakouts) delete variant.breakouts;
    templatesByName.set(name, variant);
    derived.push(variant);
    link.template = name;
  }

  return [...linkTemplates, ...derived];
}

/**
 * Harvest breakout intent from link templates into per-node breakout state so the front
 * panels render split cages (covers hand-written YAML as well as our derived variants).
 */
export function harvestTemplateBreakouts(options: {
  nodes: UINode[];
  links: Link[];
  linkTemplates: LinkTemplate[];
  nodeTemplates: NodeTemplate[];
}): void {
  const { nodes, links, linkTemplates, nodeTemplates } = options;

  const templatesByName = new Map(linkTemplates.map(t => [t.name, t]));
  const nodesByName = new Map(nodes.map(n => [n.data.name, n]));
  const infoByName = buildNodeInfo(nodes, nodeTemplates);

  const apply = (nodeName: string | undefined, iface: string | undefined, declared?: { channels?: number; speed?: string }) => {
    if (!nodeName || !iface || !declared?.channels) return;
    const node = nodesByName.get(nodeName);
    const info = infoByName.get(nodeName);
    if (!node || !info || info.sros) return;
    const address = channelledCage(iface, info.panel);
    if (!address) return;

    const breakouts = node.data.breakouts ?? {};
    if ((breakouts[address.cage] ?? 0) < declared.channels) {
      node.data.breakouts = { ...breakouts, [address.cage]: declared.channels };
    }
    const gbps = parseSpeed(declared.speed);
    const native = info.panel ? cageNativeSpeed(info.panel, address.cage) : null;
    const isDefault = gbps != null && native != null && defaultChannelGbps(native, declared.channels) === gbps;
    if (gbps != null && !isDefault && node.data.breakoutSpeeds?.[address.cage] == null) {
      node.data.breakoutSpeeds = { ...node.data.breakoutSpeeds, [address.cage]: gbps };
    }
  };

  for (const link of links) {
    const entry = link.template ? templatesByName.get(link.template)?.breakouts?.[0] : undefined;
    if (!entry) continue;
    for (const endpoint of link.endpoints ?? []) {
      apply(endpoint.local?.node, endpoint.local?.interface, entry.local);
      apply(endpoint.remote?.node, endpoint.remote?.interface, entry.remote);
    }
  }
}

/**
 * Drop derived breakout variants from the template list and point their links back at the
 * base template. Run after harvestTemplateBreakouts so the breakout intent is not lost.
 */
export function collapseBreakoutVariants(links: Link[], linkTemplates: LinkTemplate[]): LinkTemplate[] {
  const baseByVariant = new Map<string, string>();
  const kept: LinkTemplate[] = [];
  for (const template of linkTemplates) {
    const base = template.annotations?.[ANNOTATION_BREAKOUT_VARIANT];
    if (base === undefined) {
      kept.push(template);
    } else {
      baseByVariant.set(template.name, base);
    }
  }
  if (!baseByVariant.size) return linkTemplates;

  for (const link of links) {
    if (link.template === undefined) continue;
    const base = baseByVariant.get(link.template);
    if (base === undefined) continue;
    if (base) link.template = base;
    else delete link.template;
  }
  return kept;
}
