import type { UINode } from '../../types/ui';
import type { NodeTemplate } from '../../types/schema';

import type { InterfaceGenerator } from './types';
import { srlGenerator } from './srl';
import { srosGenerator } from './sros';

export type { InterfaceGenerator, InterfaceContext, ParsedInterface } from './types';
export { SrlInterfaceGenerator, srlGenerator } from './srl';
export { SrosInterfaceGenerator, srosGenerator } from './sros';

export const isSrosNode = (
  node: UINode | undefined,
  nodeTemplates: NodeTemplate[],
): boolean => {
  if (!node?.data) return false;
  const nodeProfile = node.data.nodeProfile
    || nodeTemplates.find(t => t.name === node.data.template)?.nodeProfile;
  if (!nodeProfile) return false;
  return nodeProfile.toLowerCase().startsWith('sros');
};

export const getGeneratorForNode = (
  node: UINode | undefined,
  nodeTemplates: NodeTemplate[],
): InterfaceGenerator => {
  if (isSrosNode(node, nodeTemplates)) {
    return srosGenerator;
  }
  return srlGenerator;
};

export const generateInterface = (
  node: UINode | undefined,
  nodeTemplates: NodeTemplate[],
  usedInterfaces: string[],
): string => {
  const generator = getGeneratorForNode(node, nodeTemplates);
  return generator.generate({ node, nodeTemplates, usedInterfaces });
};

export const extractPortNumber = (iface: string): number => {
  const srosResult = srosGenerator.extractPortNumber(iface);
  if (srosResult > 0) return srosResult;

  const srlResult = srlGenerator.extractPortNumber(iface);
  if (srlResult > 0) return srlResult;

  const ethMatch = iface.match(/eth(\d+)/);
  if (ethMatch) return parseInt(ethMatch[1], 10);

  return 0;
};

export const getDefaultInterface = (
  node: UINode | undefined,
  nodeTemplates: NodeTemplate[],
): string => {
  const generator = getGeneratorForNode(node, nodeTemplates);
  return generator.getDefaultInterface();
};
