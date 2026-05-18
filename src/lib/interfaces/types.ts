import type { UINode } from '../../types/ui';
import type { NodeTemplate, Component } from '../../types/schema';

export interface InterfaceContext {
  node: UINode | undefined;
  nodeTemplates: NodeTemplate[];
  usedInterfaces: string[];
}

export interface ParsedInterface {
  prefix: string;
  port: number;
  raw: string;
}

export interface InterfaceGenerator {
  generate(ctx: InterfaceContext): string;
  parse(iface: string): ParsedInterface | null;
  extractPortNumber(iface: string): number;
  getDefaultInterface(): string;
}

export type { Component };
