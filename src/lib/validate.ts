import Ajv from 'ajv';
import yaml from 'js-yaml';

import schemaJson from '../static/schema.json';
import type { ValidationError, ValidationResult } from '../types/ui';

let ajvInstance: Ajv | null = null;

function getSchema(): object {
  return schemaJson as object;
}

function getAjv(): Ajv {
  if (ajvInstance) return ajvInstance;

  ajvInstance = new Ajv({
    allErrors: true,
    strict: true,
    verbose: true,
  });

  ajvInstance.addKeyword('x-kubernetes-preserve-unknown-fields');

  return ajvInstance;
}

export function validateNetworkTopology(yamlString: string): ValidationResult {
  const errors: ValidationError[] = [];

  if (!yamlString || yamlString.trim() === '') {
    return {
      valid: false,
      errors: [{ path: '', message: 'YAML content is empty' }],
    };
  }

  let doc: unknown;
  try {
    doc = yaml.load(yamlString);
  } catch (e: unknown) {
    const yamlError = e as yaml.YAMLException;
    const mark = yamlError.mark;
    const location = mark ? ` at line ${mark.line + 1}, column ${mark.column + 1}` : '';
    return {
      valid: false,
      errors: [{ path: location, message: `YAML syntax error: ${yamlError.reason || yamlError.message}` }],
    };
  }

  if (!doc || typeof doc !== 'object') {
    return {
      valid: false,
      errors: [{ path: '', message: 'Invalid document: must be an object' }],
    };
  }

  try {
    const schema = getSchema();
    const ajv = getAjv();
    const validate = ajv.compile(schema);
    const valid = validate(doc);

    if (!valid && validate.errors) {
      for (const err of validate.errors) {
        errors.push({
          path: err.instancePath || '/',
          message: err.message || 'Validation error',
        });
      }
    }

    const semanticErrors = validateCrossReferences(doc as Record<string, unknown>);
    errors.push(...semanticErrors);

    return {
      valid: errors.length === 0,
      errors,
    };
  } catch (e: unknown) {
    const error = e as Error;
    return {
      valid: false,
      errors: [{ path: '', message: `Schema validation error: ${error.message}` }],
    };
  }
}

interface ParsedDoc {
  spec?: {
    nodes?: Array<{ name: string; template?: string }>;
    links?: Array<{
      name: string;
      template?: string;
      endpoints?: Array<{
        local?: { node: string; interface?: string };
        remote?: { node: string; interface?: string };
      }>;
    }>;
    nodeTemplates?: Array<{ name: string }>;
    linkTemplates?: Array<{ name: string }>;
    simulation?: {
      simNodes?: Array<{ name: string; template?: string }>;
      simNodeTemplates?: Array<{ name: string }>;
    };
  };
}

function validateCrossReferences(doc: Record<string, unknown>): ValidationError[] {
  const errors: ValidationError[] = [];
  const parsed = doc as ParsedDoc;
  const spec = parsed.spec;

  if (!spec) return errors;

  const nodeNames = new Set((spec.nodes || []).map(n => n.name));
  const nodeTemplateNames = new Set((spec.nodeTemplates || []).map(t => t.name));
  const linkTemplateNames = new Set((spec.linkTemplates || []).map(t => t.name));
  const simNodeNames = new Set((spec.simulation?.simNodes || []).map(n => n.name));
  const simNodeTemplateNames = new Set((spec.simulation?.simNodeTemplates || []).map(t => t.name));

  (spec.nodes || []).forEach((node, i) => {
    if (node.template && !nodeTemplateNames.has(node.template)) {
      errors.push({
        path: `/spec/nodes/${i}/template`,
        message: `Node "${node.name}" references undefined template "${node.template}"`,
      });
    }
  });

  (spec.links || []).forEach((link, i) => {
    if (link.template && !linkTemplateNames.has(link.template)) {
      errors.push({
        path: `/spec/links/${i}/template`,
        message: `Link "${link.name}" references undefined template "${link.template}"`,
      });
    }

    (link.endpoints || []).forEach((endpoint, j) => {
      if (endpoint.local?.node) {
        const localNode = endpoint.local.node;
        if (!nodeNames.has(localNode) && !simNodeNames.has(localNode)) {
          errors.push({
            path: `/spec/links/${i}/endpoints/${j}/local/node`,
            message: `Link "${link.name}" references undefined node "${localNode}"`,
          });
        }
      }
      if (endpoint.remote?.node) {
        const remoteNode = endpoint.remote.node;
        if (!nodeNames.has(remoteNode) && !simNodeNames.has(remoteNode)) {
          errors.push({
            path: `/spec/links/${i}/endpoints/${j}/remote/node`,
            message: `Link "${link.name}" references undefined node "${remoteNode}"`,
          });
        }
      }
    });
  });

  (spec.simulation?.simNodes || []).forEach((simNode, i) => {
    if (simNode.template && !simNodeTemplateNames.has(simNode.template)) {
      errors.push({
        path: `/spec/simulation/simNodes/${i}/template`,
        message: `SimNode "${simNode.name}" references undefined template "${simNode.template}"`,
      });
    }
  });

  const interfacesByNode = new Map<string, Map<string, { linkName: string; linkIndex: number; endpointIndex: number; side: string }[]>>();

  (spec.links || []).forEach((link, linkIndex) => {
    (link.endpoints || []).forEach((endpoint, endpointIndex) => {
      if (endpoint.local?.node && endpoint.local?.interface) {
        const node = endpoint.local.node;
        const iface = endpoint.local.interface;
        let nodeInterfaces = interfacesByNode.get(node);
        if (!nodeInterfaces) {
          nodeInterfaces = new Map();
          interfacesByNode.set(node, nodeInterfaces);
        }
        let ifaceList = nodeInterfaces.get(iface);
        if (!ifaceList) {
          ifaceList = [];
          nodeInterfaces.set(iface, ifaceList);
        }
        ifaceList.push({ linkName: link.name, linkIndex, endpointIndex, side: 'local' });
      }
      if (endpoint.remote?.node && endpoint.remote?.interface) {
        const node = endpoint.remote.node;
        const iface = endpoint.remote.interface;
        let nodeInterfaces = interfacesByNode.get(node);
        if (!nodeInterfaces) {
          nodeInterfaces = new Map();
          interfacesByNode.set(node, nodeInterfaces);
        }
        let ifaceList = nodeInterfaces.get(iface);
        if (!ifaceList) {
          ifaceList = [];
          nodeInterfaces.set(iface, ifaceList);
        }
        ifaceList.push({ linkName: link.name, linkIndex, endpointIndex, side: 'remote' });
      }
    });
  });

  for (const [nodeName, interfaces] of interfacesByNode) {
    for (const [ifaceName, usages] of interfaces) {
      if (usages.length > 1) {
        const linkNames = usages.map(u => u.linkName).join(', ');
        errors.push({
          path: '/spec/links',
          message: `Node "${nodeName}" has duplicate interface "${ifaceName}" used in links: ${linkNames}`,
        });
      }
    }
  }

  return errors;
}
