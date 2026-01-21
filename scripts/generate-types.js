#!/usr/bin/env node

// generate typescript types from the NetworkTopology schema.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const schemaPath = path.join(__dirname, '../src/static/schema.json');
const outputPath = path.join(__dirname, '../src/types/topology.ts');

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

const output = `// DO NOT EDIT THIS GENERATED FILE.
// Run: node scripts/generate-types.js

export type Operation = ${operationEnum ? operationEnum.map(v => `'${v}'`).join(' | ') : 'string'};

export type LinkType = ${linkTypeEnum ? linkTypeEnum.map(v => `'${v}'`).join(' | ') : 'string'};

export type LinkSpeed = ${linkSpeedEnum ? linkSpeedEnum.map(v => `'${v}'`).join(' | ') : 'string'};

export type EncapType = ${encapTypeEnum ? encapTypeEnum.map(v => `'${v}'`).join(' | ') : 'string'};

export type SimNodeType = ${simNodeTypeEnum ? simNodeTypeEnum.map(v => `'${v}'`).join(' | ') : 'string'};

export interface TopologyNodeData {
  [key: string]: unknown;
  id: string;
  name: string;
  platform?: string;
  template?: string;
  nodeProfile?: string;
  labels?: Record<string, string>;
}

export interface MemberLink {
  name: string;
  template?: string;
  sourceInterface: string;
  targetInterface: string;
}

export interface TopologyEdgeData {
  [key: string]: unknown;
  id: string;
  sourceNode: string;
  targetNode: string;
  memberLinks?: MemberLink[];
}

export interface NodeTemplate {
  name: string;
  platform?: string;
  nodeProfile?: string;
  labels?: Record<string, string>;
}

export interface LinkTemplate {
  name: string;
  type?: LinkType;
  speed?: LinkSpeed;
  encapType?: EncapType;
  labels?: Record<string, string>;
}

export interface EdgeLinkEndpoint {
  local: {
    node: string;
    interface?: string;
  };
  remote?: {
    node: string;
    interface?: string;
  };
}

export interface EdgeLink {
  name: string;
  template?: string;
  endpoints: EdgeLinkEndpoint[];
}

export interface NetworkNode {
  name: string;
  platform?: string;
  template?: string;
  nodeProfile?: string;
  labels?: Record<string, string>;
}

export interface TopologyState {
  topologyName: string;
  namespace: string;
  operation: Operation;
  nodeTemplates: NodeTemplate[];
  linkTemplates: LinkTemplate[];
  nodes: import('@xyflow/react').Node<TopologyNodeData>[];
  edges: import('@xyflow/react').Edge<TopologyEdgeData>[];
  edgeLinks: EdgeLink[];
  simulation?: unknown;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  selectedEdgeLinkIndex: number | null;
  yamlRefreshCounter: number;
}
`;

const outputDir = path.dirname(outputPath);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

fs.writeFileSync(outputPath, output);
console.log(`Generated types at ${outputPath}`);
console.log('Extracted enums:');
console.log('--> Operation:', operationEnum);
console.log('--> LinkType:', linkTypeEnum);
console.log('--> LinkSpeed:', linkSpeedEnum);
console.log('--> EncapType:', encapTypeEnum);
console.log('--> SimNodeType:', simNodeTypeEnum);
