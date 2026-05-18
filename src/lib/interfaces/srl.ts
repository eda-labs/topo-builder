import type { InterfaceGenerator, InterfaceContext, ParsedInterface } from './types';

const PREFIX = 'ethernet-1';
const DEFAULT_INTERFACE = 'ethernet-1-1';

export class SrlInterfaceGenerator implements InterfaceGenerator {
  parse(iface: string): ParsedInterface | null {
    const match = iface.match(/^(ethernet-1)-(\d+)$/);
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
    const usedPorts = ctx.usedInterfaces
      .map(iface => this.extractPortNumber(iface))
      .filter(port => port > 0);

    const maxPort = usedPorts.length > 0 ? Math.max(...usedPorts) : 0;
    return `${PREFIX}-${maxPort + 1}`;
  }
}

export const srlGenerator = new SrlInterfaceGenerator();
