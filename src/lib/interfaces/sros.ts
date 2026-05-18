import type { NodeTemplate } from '../../types/schema';
import type { UINode } from '../../types/ui';

import type { InterfaceGenerator, InterfaceContext, ParsedInterface, Component } from './types';

const DEFAULT_INTERFACE = 'ethernet-1-a-1';

interface ConnectorInfo {
  slotNum: number;
  portCount: number;
}

interface MdaInfo {
  linecard: number;
  mda: string;
  connectors: Map<number, ConnectorInfo>;
}

const parseConnectorPortCount = (connectorType: string): number => {
  const match = connectorType.match(/^c(\d+)-/);
  return match ? parseInt(match[1], 10) : 1;
};

const getNodeComponents = (
  node: UINode | undefined,
  nodeTemplates: NodeTemplate[],
): Component[] | undefined => {
  if (!node?.data) return undefined;

  const nodeComponents = (node.data as { components?: Component[] }).components;
  if (nodeComponents && nodeComponents.length > 0) return nodeComponents;

  const template = nodeTemplates.find(t => t.name === node.data.template);
  return template?.components;
};

const parseMdaInfo = (components: Component[] | undefined): MdaInfo | null => {
  if (!components || components.length === 0) return null;

  const mdaComponent = components.find(c => c.kind === 'mda' && c.slot);
  if (!mdaComponent?.slot) return null;

  const mdaMatch = mdaComponent.slot.match(/^(\d+)-([a-z])$/);
  if (!mdaMatch) return null;

  const linecard = parseInt(mdaMatch[1], 10);
  const mda = mdaMatch[2];

  const connectors = new Map<number, ConnectorInfo>();
  const connectorComponents = components.filter(c => c.kind === 'connector' && c.slot);

  for (const conn of connectorComponents) {
    if (!conn.slot) continue;
    const connMatch = conn.slot.match(/^\d+-[a-z]-(\d+)$/);
    if (connMatch) {
      const slotNum = parseInt(connMatch[1], 10);
      const portCount = parseConnectorPortCount(conn.type);
      connectors.set(slotNum, { slotNum, portCount });
    }
  }

  return { linecard, mda, connectors };
};

export class SrosInterfaceGenerator implements InterfaceGenerator {
  parse(iface: string): ParsedInterface | null {
    const match = iface.match(/^(ethernet-\d+-[a-z](?:-\d+)?)-(\d+)$/);
    if (!match) return null;
    return {
      prefix: match[1],
      port: parseInt(match[2], 10),
      raw: iface,
    };
  }

  extractPortNumber(iface: string): number {
    const parsed = this.parse(iface);
    return parsed?.port ?? 0;
  }

  getDefaultInterface(): string {
    return DEFAULT_INTERFACE;
  }

  generate(ctx: InterfaceContext): string {
    const components = getNodeComponents(ctx.node, ctx.nodeTemplates);
    const mdaInfo = parseMdaInfo(components);

    if (!mdaInfo) {
      const usedPorts = ctx.usedInterfaces
        .map(iface => this.extractPortNumber(iface))
        .filter(port => port > 0);
      const maxPort = usedPorts.length > 0 ? Math.max(...usedPorts) : 0;
      return `ethernet-1-a-${maxPort + 1}`;
    }

    const { linecard, mda, connectors } = mdaInfo;
    const usedSet = new Set(ctx.usedInterfaces);

    for (let slotNum = 1; slotNum <= 100; slotNum++) {
      const connector = connectors.get(slotNum);

      if (connector) {
        for (let port = 1; port <= connector.portCount; port++) {
          const iface = `ethernet-${linecard}-${mda}-${slotNum}-${port}`;
          if (!usedSet.has(iface)) {
            return iface;
          }
        }
      } else {
        const iface = `ethernet-${linecard}-${mda}-${slotNum}`;
        if (!usedSet.has(iface)) {
          return iface;
        }
      }
    }

    return `ethernet-${linecard}-${mda}-1`;
  }
}

export const srosGenerator = new SrosInterfaceGenerator();
