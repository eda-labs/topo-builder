#!/usr/bin/env node

// generate typescript types from the NetworkTopology schema.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const schemaPath = path.join(__dirname, '../src/static/schema.json');
const outputPath = path.join(__dirname, '../src/types/schema.ts');

const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

function extractEnum(schemaObj, propertyPath) {
  const parts = propertyPath.split('.');
  let current = schemaObj;
  for (const part of parts) {
    if (part === 'items') {
      current = current.items;
    } else if (current.properties) {
      current = current.properties[part];
    } else {
      return null;
    }
    if (!current) return null;
  }
  return current.enum || null;
}

const specSchema = schema.properties?.spec;
const operationEnum = extractEnum(specSchema, 'operation');
const linkTypeEnum = extractEnum(specSchema, 'links.items.endpoints.items.type') ||
                     extractEnum(specSchema, 'linkTemplates.items.type');
const linkSpeedEnum = extractEnum(specSchema, 'links.items.endpoints.items.speed') ||
                      extractEnum(specSchema, 'linkTemplates.items.speed');
const encapTypeEnum = extractEnum(specSchema, 'links.items.encapType') ||
                      extractEnum(specSchema, 'linkTemplates.items.encapType');
const simNodeTypeEnum = extractEnum(specSchema, 'simulation.simNodes.items.type') ||
                        extractEnum(specSchema, 'simulation.simNodeTemplates.items.type');

const yamlOutput = `// DO NOT EDIT THIS GENERATED FILE.
// Run: node scripts/generate-types.js

export type Operation = ${operationEnum ? operationEnum.map(v => `'${v}'`).join(' | ') : 'string'};

export type LinkType = ${linkTypeEnum ? linkTypeEnum.map(v => `'${v}'`).join(' | ') : 'string'};

export type LinkSpeed = ${linkSpeedEnum ? linkSpeedEnum.map(v => `'${v}'`).join(' | ') : 'string'};

export type EncapType = ${encapTypeEnum ? encapTypeEnum.map(v => `'${v}'`).join(' | ') : 'string'};

export type SimNodeType = ${simNodeTypeEnum ? simNodeTypeEnum.map(v => `'${v}'`).join(' | ') : 'string'};

export interface NodeTemplate {
  name: string;
  platform?: string;
  nodeProfile?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface LinkTemplate {
  name: string;
  type?: LinkType;
  speed?: LinkSpeed;
  encapType?: EncapType;
  labels?: Record<string, string>;
}

export interface SimNodeTemplate {
  name: string;
  type?: SimNodeType;
  image?: string;
  imagePullSecret?: string;
  labels?: Record<string, string>;
}

export interface TopoNode {
  name: string;
  template?: string;
  serialNumber?: string;
  platform?: string;
  nodeProfile?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface SimNode {
  name: string;
  template?: string;
  type?: SimNodeType;
  image?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface EndpointLocal {
  node: string;
  interface?: string;
}

export interface EndpointRemote {
  node: string;
  interface?: string;
}

export interface EndpointSim {
  simNode?: string;
  simNodeInterface?: string;
  node?: string;
  interface?: string;
}

export interface Endpoint {
  local?: EndpointLocal;
  remote?: EndpointRemote;
  sim?: EndpointSim;
  type?: LinkType;
  speed?: LinkSpeed;
}

export interface Link {
  name?: string;
  template?: string;
  encapType?: EncapType;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  endpoints: Endpoint[];
}

export interface Simulation {
  simNodeTemplates?: SimNodeTemplate[];
  simNodes?: SimNode[];
  topology?: unknown[];
}

export interface TopologyMetadata {
  name: string;
  namespace?: string;
}

export interface TopologySpec {
  operation?: Operation;
  nodeTemplates?: NodeTemplate[];
  linkTemplates?: LinkTemplate[];
  nodes?: TopoNode[];
  links?: Link[];
  simulation?: Simulation;
}

export interface Topology {
  apiVersion: 'topologies.eda.nokia.com/v1alpha1';
  kind: 'NetworkTopology';
  metadata: TopologyMetadata;
  spec: TopologySpec;
}

export interface ParsedTopology {
  apiVersion?: string;
  kind?: string;
  metadata?: {
    name?: string;
    namespace?: string;
  };
  spec?: {
    operation?: string;
    nodeTemplates?: NodeTemplate[];
    linkTemplates?: LinkTemplate[];
    nodes?: TopoNode[];
    links?: Link[];
    simulation?: Simulation;
  };
}
`;

const outputDir = path.dirname(outputPath);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

fs.writeFileSync(outputPath, yamlOutput);
console.log(`Generated schema types at ${outputPath}`);
