import schema from '../static/schema.json';

const spec = schema.properties.spec.properties;

export const operations = spec.operation.enum;
export const linkTypes = spec.linkTemplates.items.properties.type.enum;
export const linkSpeeds = spec.linkTemplates.items.properties.speed.enum;
export const encapTypes = spec.linkTemplates.items.properties.encapType.enum;
export const simNodeTypes = spec.simulation.properties.simNodeTemplates.items.properties.type.enum;
export const componentKinds = spec.nodeTemplates.items.properties.components.items.properties.kind.enum;

export const defaultOperation = spec.operation.default ?? operations[0];
export const defaultLinkType = linkTypes[0];
export const edgeLinkType = linkTypes[1];
