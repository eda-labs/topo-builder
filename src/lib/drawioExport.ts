import type { UINode, UIEdge, UIAnnotation, UINodeData } from '../types/ui';
import type { NodeTemplate } from '../types/schema';
import spineIcon from '../static/icons/spine.svg?raw';
import leafIcon from '../static/icons/leaf.svg?raw';
import superspineIcon from '../static/icons/superspine.svg?raw';

const NODE_WIDTH = 80;
const NODE_HEIGHT = 80;

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const ROLE_ICONS: Record<string, string> = {
  spine: spineIcon,
  leaf: leafIcon,
  borderleaf: leafIcon,
  superspine: superspineIcon,
};

// MUI icon SVG paths for simnodes (Speed = TestMan, ViewInAr = Linux)
const SPEED_ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="28" height="28"><path d="m20.38 8.57-1.23 1.85a8 8 0 0 1-.22 7.58H5.07A8 8 0 0 1 15.58 6.85l1.85-1.23A10 10 0 0 0 3.35 19a2 2 0 0 0 1.72 1h13.85a2 2 0 0 0 1.74-1 10 10 0 0 0-.27-10.44zm-9.79 6.84a2 2 0 0 0 2.83 0l5.66-8.49-8.49 5.66a2 2 0 0 0 0 2.83" fill="#888888"/></svg>';
const CONTAINER_ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="28" height="28"><path d="m18.25 7.6-5.5-3.18c-.46-.27-1.04-.27-1.5 0L5.75 7.6c-.46.27-.75.76-.75 1.3v6.35c0 .54.29 1.03.75 1.3l5.5 3.18c.46.27 1.04.27 1.5 0l5.5-3.18c.46-.27.75-.76.75-1.3V8.9c0-.54-.29-1.03-.75-1.3M7 14.96v-4.62l4 2.32v4.61zm5-4.03L8 8.61l4-2.31 4 2.31zm1 6.34v-4.61l4-2.32v4.62zM7 2H3.5C2.67 2 2 2.67 2 3.5V7h2V4h3zm10 0h3.5c.83 0 1.5.67 1.5 1.5V7h-2V4h-3zM7 22H3.5c-.83 0-1.5-.67-1.5-1.5V17h2v3h3zm10 0h3.5c.83 0 1.5-.67 1.5-1.5V17h-2v3h-3z" fill="#888888"/></svg>';

function svgToDataUri(svg: string): string {
  return 'data:image/svg+xml;base64,' + btoa(svg);
}

function getNodeRole(node: UINodeData, nodeTemplates: NodeTemplate[]): string | undefined {
  if (node.role) return node.role;
  if (node.labels?.['eda.nokia.com/role']) return node.labels['eda.nokia.com/role'];
  if (node.template) {
    const tmpl = nodeTemplates.find(t => t.name === node.template);
    if (tmpl?.labels?.['eda.nokia.com/role']) return tmpl.labels['eda.nokia.com/role'];
  }
  return undefined;
}

function getNodeIcon(node: UINodeData, nodeTemplates: NodeTemplate[]): string | undefined {
  if (node.nodeType === 'simnode') {
    return node.simNodeType === 'TestMan' ? SPEED_ICON_SVG : CONTAINER_ICON_SVG;
  }
  const role = getNodeRole(node, nodeTemplates);
  if (!role) return undefined;
  const rawSvg = ROLE_ICONS[role];
  if (!rawSvg) return undefined;
  const fill = '#1e1e1e';
  return rawSvg
    .replace(/var\(--color-icon-bg\)/g, fill)
    .replace(/var\(--color-icon-fg\)/g, '#ffffff');
}

function nodeStyle(node: UINodeData, nodeTemplates: NodeTemplate[]): string {
  const isSimnode = node.nodeType === 'simnode';
  const fill = isSimnode ? '#2d2d2d' : '#1e1e1e';
  const stroke = isSimnode ? '#666666' : '#555555';
  const iconSvg = getNodeIcon(node, nodeTemplates);

  const parts = [
    'rounded=1',
    'whiteSpace=wrap',
    'html=1',
    `fillColor=${fill}`,
    `strokeColor=${stroke}`,
    'fontColor=#ffffff',
    'fontSize=11',
    'fontStyle=1',
  ];

  if (iconSvg) {
    parts.unshift('shape=label', 'perimeter=rectanglePerimeter');
    parts.push(
      'imageWidth=28',
      'imageHeight=28',
      'imageAlign=center',
      'imageVerticalAlign=top',
      'verticalAlign=bottom',
      'spacingTop=5',
      `image=${svgToDataUri(iconSvg)}`,
    );
  }

  if (isSimnode) {
    parts.push('dashed=1');
  }

  return parts.join(';') + ';';
}

function edgeStyle(): string {
  return [
    'edgeStyle=orthogonalEdgeStyle',
    'rounded=1',
    'orthogonalLoop=1',
    'jettySize=auto',
    'html=1',
    'endArrow=none',
    'startArrow=none',
    'strokeColor=#888888',
  ].join(';') + ';';
}

function shapeStyle(ann: UIAnnotation & { type: 'shape' }): string {
  const parts: string[] = [];
  if (ann.shapeType === 'circle') {
    parts.push('ellipse');
  } else {
    parts.push('rounded=0');
  }
  parts.push('whiteSpace=wrap', 'html=1');
  parts.push(`fillColor=${ann.fillColor === 'none' ? 'none' : ann.fillColor}`);
  parts.push(`strokeColor=${ann.strokeColor}`);
  parts.push(`strokeWidth=${ann.strokeWidth}`);
  if (ann.strokeStyle === 'dashed') parts.push('dashed=1', 'dashPattern=8 8');
  if (ann.strokeStyle === 'dotted') parts.push('dashed=1', 'dashPattern=2 4');
  return parts.join(';') + ';';
}

function textStyle(ann: UIAnnotation & { type: 'text' }): string {
  return [
    'text',
    'html=1',
    'resizable=0',
    'autosize=1',
    `fontSize=${ann.fontSize}`,
    `fontColor=${ann.fontColor}`,
    'align=left',
    'verticalAlign=top',
    'fillColor=none',
    'strokeColor=none',
  ].join(';') + ';';
}

interface DrawioExportOptions {
  nodes: UINode[];
  edges: UIEdge[];
  annotations: UIAnnotation[];
  nodeTemplates: NodeTemplate[];
  topologyName: string;
}

export function exportToDrawio({ nodes, edges, annotations, nodeTemplates, topologyName }: DrawioExportOptions): string {
  const cells: string[] = [];
  let cellId = 2; // 0 and 1 are reserved

  // Annotations first (rendered behind everything)
  for (const ann of annotations) {
    if (ann.type === 'shape') {
      const style = shapeStyle(ann);
      cells.push(
        `<mxCell id="${ann.id}" value="" style="${style}" vertex="1" parent="1">` +
        `<mxGeometry x="${ann.position.x}" y="${ann.position.y}" width="${ann.width}" height="${ann.height}" as="geometry"/>` +
        '</mxCell>',
      );
    } else {
      const style = textStyle(ann);
      const label = escapeXml(ann.text);
      cells.push(
        `<mxCell id="${ann.id}" value="${label}" style="${style}" vertex="1" parent="1">` +
        `<mxGeometry x="${ann.position.x}" y="${ann.position.y}" width="120" height="30" as="geometry"/>` +
        '</mxCell>',
      );
    }
  }

  // Topology nodes
  const nodeIdMap = new Map<string, string>();
  for (const node of nodes) {
    const id = String(cellId++);
    nodeIdMap.set(node.id, id);
    const style = nodeStyle(node.data, nodeTemplates);
    const label = escapeXml(node.data.name);
    const x = node.position?.x ?? 0;
    const y = node.position?.y ?? 0;
    cells.push(
      `<mxCell id="${id}" value="${label}" style="${style}" vertex="1" parent="1">` +
      `<mxGeometry x="${x}" y="${y}" width="${NODE_WIDTH}" height="${NODE_HEIGHT}" as="geometry"/>` +
      '</mxCell>',
    );
  }

  // Edges
  for (const edge of edges) {
    const id = String(cellId++);
    const src = nodeIdMap.get(edge.source) ?? edge.source;
    const tgt = nodeIdMap.get(edge.target) ?? edge.target;
    const style = edgeStyle();
    cells.push(
      `<mxCell id="${id}" style="${style}" edge="1" parent="1" source="${src}" target="${tgt}">` +
      '<mxGeometry relative="1" as="geometry"/>' +
      '</mxCell>',
    );
  }

  const name = escapeXml(topologyName);

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<mxfile host="ntwfui">',
    `  <diagram name="${name}">`,
    '    <mxGraphModel>',
    '      <root>',
    '        <mxCell id="0"/>',
    '        <mxCell id="1" parent="0"/>',
    ...cells.map(c => `        ${c}`),
    '      </root>',
    '    </mxGraphModel>',
    '  </diagram>',
    '</mxfile>',
  ].join('\n');
}
