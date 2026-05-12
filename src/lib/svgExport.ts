import { getBezierPath, Position } from '@xyflow/react';
import { Bezier } from 'bezier-js';

import leafIcon from '../static/icons/leaf.svg?raw';
import spineIcon from '../static/icons/spine.svg?raw';
import superspineIcon from '../static/icons/superspine.svg?raw';
import type { NodeTemplate, SimNodeTemplate } from '../types/schema';
import type {
  AnnotationStrokeStyle,
  UIAnnotation,
  UIEdge,
  UIEsiLeaf,
  UILagGroup,
  UINode,
  UIShapeAnnotation,
  UITextAnnotation,
} from '../types/ui';

import {
  DEFAULT_NODE_HEIGHT,
  DEFAULT_NODE_WIDTH,
  ESI_LAG_STEM_LENGTH,
} from './constants';
import { downloadTextFile } from './download';
import {
  calculateLinkOffsets,
  createFannedBezierPath,
  getControlPoint,
  getFloatingEdgeParams,
  getNodeCenter,
  parseHandlePosition,
} from './edgeUtils';

const DEFAULT_EXPORT_PADDING = 100;
const MIN_EXPORT_SIZE = 400;
const NODE_ICON_SIZE = 28;
const NODE_ICON_X = (DEFAULT_NODE_WIDTH - NODE_ICON_SIZE) / 2;
const NODE_ICON_Y = 17;
const NODE_LABEL_Y_WITH_ICON = 58;
const NODE_LABEL_Y_WITHOUT_ICON = 45;
const NODE_LABEL_MAX_CHARS = 11;
const FONT_FAMILY = 'NokiaPureText, Roboto, Helvetica, Arial, sans-serif';
const SIM_ICON_COLOR = '#888';

const ROLE_ICONS: Record<string, string> = {
  spine: spineIcon,
  leaf: leafIcon,
  borderleaf: leafIcon,
  superspine: superspineIcon,
};

const SPEED_ICON_PATH =
  'm20.38 8.57-1.23 1.85a8 8 0 0 1-.22 7.58H5.07A8 8 0 0 1 15.58 6.85l1.85-1.23A10 10 0 0 0 3.35 19a2 2 0 0 0 1.72 1h13.85a2 2 0 0 0 1.74-1 10 10 0 0 0-.27-10.44zm-9.79 6.84a2 2 0 0 0 2.83 0l5.66-8.49-8.49 5.66a2 2 0 0 0 0 2.83';
const CONTAINER_ICON_PATH =
  'm18.25 7.6-5.5-3.18c-.46-.27-1.04-.27-1.5 0L5.75 7.6c-.46.27-.75.76-.75 1.3v6.35c0 .54.29 1.03.75 1.3l5.5 3.18c.46.27 1.04.27 1.5 0l5.5-3.18c.46-.27.75-.76.75-1.3V8.9c0-.54-.29-1.03-.75-1.3M7 14.96v-4.62l4 2.32v4.61zm5-4.03L8 8.61l4-2.31 4 2.31zm1 6.34v-4.61l4-2.32v4.62zM7 2H3.5C2.67 2 2 2.67 2 3.5V7h2V4h3zm10 0h3.5c.83 0 1.5.67 1.5 1.5V7h-2V4h-3zM7 22H3.5c-.83 0-1.5-.67-1.5-1.5V17h2v3h3zm10 0h3.5c.83 0 1.5-.67 1.5-1.5V17h-2v3h-3z';

interface SvgTheme {
  background: string;
  dotColor: string;
  linkStroke: string;
  nodeBorder: string;
  nodeBackground: string;
  nodeText: string;
  iconBackground: string;
  iconForeground: string;
}

interface ExportBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

interface NodeInfo {
  id: string;
  position: { x: number; y: number };
  measured: { width: number; height: number };
  data: UINode['data'];
}

interface EdgePointData {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: Position;
  targetPosition: Position;
}

export interface TopologySvgExportInput {
  nodes: UINode[];
  edges: UIEdge[];
  annotations: UIAnnotation[];
  nodeTemplates: NodeTemplate[];
  simNodeTemplates: SimNodeTemplate[];
  expandedEdges: Set<string>;
  showSimNodes: boolean;
  container?: HTMLElement | null;
  backgroundColor?: string;
  transparentBackground?: boolean;
  includeBackgroundGrid?: boolean;
  paddingPx?: number;
  zoomPercent?: number;
}

function escapeXml(value: unknown): string {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function middleEllipsis(text: string, max: number): string {
  if (text.length <= max) return text;
  const left = Math.ceil((max - 1) / 2);
  const right = Math.floor((max - 1) / 2);
  return `${text.slice(0, left)}...${text.slice(-right)}`;
}

function resolveCssVariable(element: Element | null | undefined, name: string, fallback: string): string {
  if (typeof window === 'undefined' || !element) return fallback;
  const value = window.getComputedStyle(element).getPropertyValue(name).trim();
  return value || fallback;
}

function resolveSvgTheme(container?: HTMLElement | null): SvgTheme {
  const fallbackElement = typeof document === 'undefined' ? null : document.documentElement;
  const flowElement = container?.querySelector('.react-flow') ?? container ?? fallbackElement;
  const background = resolveCssVariable(
    flowElement,
    '--xy-background-color',
    resolveCssVariable(container, '--tb-flow-bg', '#101824'),
  );
  const nodeBorder = resolveCssVariable(container, '--color-node-border', '#8994a37f');

  return {
    background,
    dotColor: nodeBorder,
    linkStroke: resolveCssVariable(container, '--color-link-stroke', '#8994a37f'),
    nodeBorder,
    nodeBackground: resolveCssVariable(container, '--color-node-bg', '#000000'),
    nodeText: resolveCssVariable(container, '--color-node-text', '#ffffff'),
    iconBackground: resolveCssVariable(container, '--color-icon-bg', '#707070'),
    iconForeground: resolveCssVariable(container, '--color-icon-fg', '#ffffff'),
  };
}

function isVisibleNode(node: UINode, showSimNodes: boolean): boolean {
  return showSimNodes || node.data.nodeType !== 'simnode';
}

function isVisibleEdge(edge: UIEdge, visibleNodeIds: Set<string>): boolean {
  return visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target);
}

function estimateTextAnnotationBounds(annotation: UITextAnnotation): { width: number; height: number } {
  const lines = (annotation.text || 'Text').split('\n');
  const longestLine = lines.reduce((max, line) => Math.max(max, line.length), 0);
  return {
    width: Math.max(40, Math.ceil(longestLine * annotation.fontSize * 0.6) + 16),
    height: Math.max(20, Math.ceil(lines.length * annotation.fontSize * 1.25) + 8),
  };
}

function includeRect(bounds: ExportBounds, rect: { x: number; y: number; width: number; height: number }): void {
  bounds.minX = Math.min(bounds.minX, rect.x);
  bounds.minY = Math.min(bounds.minY, rect.y);
  bounds.maxX = Math.max(bounds.maxX, rect.x + rect.width);
  bounds.maxY = Math.max(bounds.maxY, rect.y + rect.height);
}

function calculateBounds(nodes: UINode[], annotations: UIAnnotation[]): ExportBounds | null {
  if (nodes.length === 0) return null;

  const bounds: ExportBounds = {
    minX: Number.POSITIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
  };

  for (const node of nodes) {
    includeRect(bounds, {
      x: node.position.x,
      y: node.position.y,
      width: DEFAULT_NODE_WIDTH,
      height: DEFAULT_NODE_HEIGHT,
    });
  }

  for (const annotation of annotations) {
    if (annotation.type === 'shape') {
      includeRect(bounds, {
        x: annotation.position.x,
        y: annotation.position.y,
        width: annotation.width,
        height: annotation.height,
      });
    } else {
      const size = estimateTextAnnotationBounds(annotation);
      includeRect(bounds, {
        x: annotation.position.x,
        y: annotation.position.y,
        width: size.width,
        height: size.height,
      });
    }
  }

  return bounds;
}

function shiftNode(node: UINode, offsetX: number, offsetY: number): NodeInfo {
  return {
    id: node.id,
    position: {
      x: node.position.x + offsetX,
      y: node.position.y + offsetY,
    },
    measured: {
      width: DEFAULT_NODE_WIDTH,
      height: DEFAULT_NODE_HEIGHT,
    },
    data: node.data,
  };
}

function getHandleCoordinates(
  node: NodeInfo,
  handle: string | null | undefined,
): { x: number; y: number; position: Position } {
  const position = parseHandlePosition(handle);
  let x = node.position.x + DEFAULT_NODE_WIDTH / 2;
  let y = node.position.y + DEFAULT_NODE_HEIGHT / 2;

  switch (position) {
    case Position.Top:
      y = node.position.y;
      break;
    case Position.Bottom:
      y = node.position.y + DEFAULT_NODE_HEIGHT;
      break;
    case Position.Left:
      x = node.position.x;
      break;
    case Position.Right:
      x = node.position.x + DEFAULT_NODE_WIDTH;
      break;
  }

  return { x, y, position };
}

function getStandardEdgePath(points: EdgePointData): { path: string; midpoint: { x: number; y: number } } {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition } = points;

  if (sourcePosition === targetPosition) {
    const distance = Math.sqrt((targetX - sourceX) ** 2 + (targetY - sourceY) ** 2);
    const curvature = Math.max(50, distance * 0.5);
    const c1 = getControlPoint(sourceX, sourceY, sourcePosition, curvature);
    const c2 = getControlPoint(targetX, targetY, targetPosition, curvature);
    const bezier = new Bezier(
      sourceX,
      sourceY,
      c1.x,
      c1.y,
      c2.x,
      c2.y,
      targetX,
      targetY,
    );
    const mid = bezier.get(0.5);
    return { path: bezier.toSVG(), midpoint: { x: mid.x, y: mid.y } };
  }

  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });
  return { path, midpoint: { x: labelX, y: labelY } };
}

function resolveEdgePoints(edge: UIEdge, nodesById: Map<string, NodeInfo>): EdgePointData | null {
  const sourceNode = nodesById.get(edge.source);
  const targetNode = nodesById.get(edge.target);
  if (!sourceNode || !targetNode) return null;

  if (!edge.sourceHandle && !edge.targetHandle) {
    const floating = getFloatingEdgeParams(sourceNode, targetNode);
    return {
      sourceX: floating.sx,
      sourceY: floating.sy,
      targetX: floating.tx,
      targetY: floating.ty,
      sourcePosition: floating.sourcePos,
      targetPosition: floating.targetPos,
    };
  }

  const sourceCoords = getHandleCoordinates(sourceNode, edge.sourceHandle ?? 'bottom');
  const targetCoords = getHandleCoordinates(targetNode, edge.targetHandle ?? 'bottom');
  return {
    sourceX: sourceCoords.x,
    sourceY: sourceCoords.y,
    targetX: targetCoords.x,
    targetY: targetCoords.y,
    sourcePosition: sourceCoords.position,
    targetPosition: targetCoords.position,
  };
}

function isSimNodeEdge(edge: UIEdge, nodesById: Map<string, NodeInfo>): boolean {
  return nodesById.get(edge.source)?.data.nodeType === 'simnode'
    || nodesById.get(edge.target)?.data.nodeType === 'simnode';
}

function getStrokeDashArray(strokeStyle: AnnotationStrokeStyle, strokeWidth: number): string | undefined {
  switch (strokeStyle) {
    case 'dashed':
      return `${strokeWidth * 4} ${strokeWidth * 3}`;
    case 'dotted':
      return `${strokeWidth} ${strokeWidth * 2}`;
    default:
      return undefined;
  }
}

function renderShapeAnnotation(annotation: UIShapeAnnotation, offsetX: number, offsetY: number): string {
  const x = annotation.position.x + offsetX;
  const y = annotation.position.y + offsetY;
  const dashArray = getStrokeDashArray(annotation.strokeStyle, annotation.strokeWidth);
  const dashAttr = dashArray ? ` stroke-dasharray="${escapeXml(dashArray)}"` : '';

  if (annotation.shapeType === 'circle') {
    return `<ellipse cx="${x + annotation.width / 2}" cy="${y + annotation.height / 2}" rx="${(annotation.width - annotation.strokeWidth) / 2}" ry="${(annotation.height - annotation.strokeWidth) / 2}" fill="${escapeXml(annotation.fillColor)}" stroke="${escapeXml(annotation.strokeColor)}" stroke-width="${annotation.strokeWidth}"${dashAttr}/>`;
  }

  const halfStroke = annotation.strokeWidth / 2;
  return `<rect x="${x + halfStroke}" y="${y + halfStroke}" width="${annotation.width - annotation.strokeWidth}" height="${annotation.height - annotation.strokeWidth}" rx="10" fill="${escapeXml(annotation.fillColor)}" stroke="${escapeXml(annotation.strokeColor)}" stroke-width="${annotation.strokeWidth}"${dashAttr}/>`;
}

function renderTextAnnotation(annotation: UITextAnnotation, offsetX: number, offsetY: number): string {
  const x = annotation.position.x + offsetX + 8;
  const y = annotation.position.y + offsetY + 4 + annotation.fontSize;
  const lineHeight = annotation.fontSize * 1.25;
  const lines = (annotation.text || 'Text').split('\n');
  const tspans = lines
    .map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`)
    .join('');
  return `<text y="${y}" font-family="${FONT_FAMILY}" font-size="${annotation.fontSize}" fill="${escapeXml(annotation.fontColor)}">${tspans}</text>`;
}

function renderAnnotations(
  annotations: UIAnnotation[],
  offsetX: number,
  offsetY: number,
): { shapes: string; texts: string } {
  const shapes: string[] = [];
  const texts: string[] = [];

  for (const annotation of annotations) {
    if (annotation.type === 'shape') {
      shapes.push(renderShapeAnnotation(annotation, offsetX, offsetY));
    } else {
      texts.push(renderTextAnnotation(annotation, offsetX, offsetY));
    }
  }

  return {
    shapes: shapes.join(''),
    texts: texts.join(''),
  };
}

function renderBadge(
  x: number,
  y: number,
  label: string,
  theme: SvgTheme,
  minWidth = 14,
): string {
  const width = Math.max(minWidth, label.length * 5 + 8);
  const height = 14;
  return `<g class="export-edge-badge" transform="translate(${x - width / 2} ${y - height / 2})">`
    + `<rect width="${width}" height="${height}" rx="7" fill="${escapeXml(theme.nodeBackground)}" stroke="${escapeXml(theme.linkStroke)}" stroke-width="1"/>`
    + `<text x="${width / 2}" y="10" text-anchor="middle" font-family="${FONT_FAMILY}" font-size="8" font-weight="400" fill="${escapeXml(theme.nodeText)}">${escapeXml(label)}</text>`
    + '</g>';
}

function renderPath(path: string, theme: SvgTheme, strokeWidth: number, dashed: boolean): string {
  const dashAttr = dashed ? ' stroke-dasharray="5 5"' : '';
  return `<path d="${escapeXml(path)}" fill="none" stroke="${escapeXml(theme.linkStroke)}" stroke-width="${strokeWidth}"${dashAttr}/>`;
}

function renderStandardEdge(edge: UIEdge, points: EdgePointData, theme: SvgTheme, dashed: boolean): string {
  const { path, midpoint } = getStandardEdgePath(points);
  const linkCount = edge.data?.memberLinks?.length ?? 0;
  const badge = linkCount > 1 ? renderBadge(midpoint.x, midpoint.y, String(linkCount), theme) : '';
  return `<g class="export-edge" data-id="${escapeXml(edge.id)}">${renderPath(path, theme, 1, dashed)}${badge}</g>`;
}

function renderExpandedEdge(edge: UIEdge, points: EdgePointData, theme: SvgTheme, dashed: boolean): string {
  const memberLinks = edge.data?.memberLinks ?? [];
  const lagGroups = edge.data?.lagGroups ?? [];

  const indicesInLags = new Set<number>();
  for (const lag of lagGroups) {
    for (const index of lag.memberLinkIndices) {
      indicesInLags.add(index);
    }
  }

  const visualItems: Array<{ type: 'link'; index: number } | { type: 'lag'; lag: UILagGroup }> = [];
  memberLinks.forEach((_, index) => {
    if (!indicesInLags.has(index)) visualItems.push({ type: 'link', index });
  });
  for (const lag of lagGroups) {
    visualItems.push({ type: 'lag', lag });
  }

  if (visualItems.length === 0) return renderStandardEdge(edge, points, theme, dashed);

  const offsets = calculateLinkOffsets(visualItems.length);
  const paths = visualItems.map((item, visualIndex) => {
    const { path, midpoint } = createFannedBezierPath(
      points.sourceX,
      points.sourceY,
      points.targetX,
      points.targetY,
      points.sourcePosition,
      points.targetPosition,
      offsets[visualIndex],
    );
    const badge = item.type === 'lag' ? renderBadge(midpoint.x, midpoint.y, 'LAG', theme, 22) : '';
    return renderPath(path, theme, 1, dashed) + badge;
  });

  return `<g class="export-edge export-edge-expanded" data-id="${escapeXml(edge.id)}">${paths.join('')}</g>`;
}

function renderEsiLagEdge(
  edge: UIEdge,
  esiLeaves: UIEsiLeaf[],
  nodesById: Map<string, NodeInfo>,
  theme: SvgTheme,
  dashed: boolean,
): string {
  const sourceNode = nodesById.get(edge.source);
  if (!sourceNode) return '';

  const leafNodes = esiLeaves
    .map(leaf => nodesById.get(leaf.nodeId))
    .filter((node): node is NodeInfo => node !== undefined);
  if (leafNodes.length === 0) return '';

  const sourceCenter = getNodeCenter(sourceNode);
  const avgTargetCenter = {
    x: leafNodes.reduce((sum, node) => sum + getNodeCenter(node).x, 0) / leafNodes.length,
    y: leafNodes.reduce((sum, node) => sum + getNodeCenter(node).y, 0) / leafNodes.length,
  };

  const horizontalDiff = Math.abs(sourceCenter.x - avgTargetCenter.x);
  const verticalDiff = Math.abs(sourceCenter.y - avgTargetCenter.y);
  let sourcePosition: Position;
  if (horizontalDiff > verticalDiff) {
    sourcePosition = sourceCenter.x > avgTargetCenter.x ? Position.Left : Position.Right;
  } else {
    sourcePosition = sourceCenter.y > avgTargetCenter.y ? Position.Top : Position.Bottom;
  }

  const sourceCoords = getHandleCoordinates(sourceNode, sourcePosition);
  const stemDeltas: Record<Position, { dx: number; dy: number }> = {
    [Position.Top]: { dx: 0, dy: -ESI_LAG_STEM_LENGTH },
    [Position.Bottom]: { dx: 0, dy: ESI_LAG_STEM_LENGTH },
    [Position.Left]: { dx: -ESI_LAG_STEM_LENGTH, dy: 0 },
    [Position.Right]: { dx: ESI_LAG_STEM_LENGTH, dy: 0 },
  };
  const stemDelta = stemDeltas[sourcePosition];
  const stemX = sourceCoords.x + stemDelta.dx;
  const stemY = sourceCoords.y + stemDelta.dy;

  const paths: string[] = [];
  for (const leafNode of leafNodes) {
    const { tx, ty, targetPos } = getFloatingEdgeParams(sourceNode, leafNode);
    const distance = Math.sqrt((tx - stemX) ** 2 + (ty - stemY) ** 2);
    const curvature = Math.max(50, distance * 0.3);
    const c1 = getControlPoint(stemX, stemY, sourcePosition, curvature);
    const c2 = getControlPoint(tx, ty, targetPos, curvature);
    paths.push(`M ${sourceCoords.x} ${sourceCoords.y} L ${stemX} ${stemY} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${tx} ${ty}`);
  }

  return `<g class="export-edge export-edge-esi-lag" data-id="${escapeXml(edge.id)}">`
    + paths.map(path => renderPath(path, theme, 2, dashed)).join('')
    + '</g>';
}

function renderEdges(
  edges: UIEdge[],
  nodesById: Map<string, NodeInfo>,
  expandedEdges: Set<string>,
  theme: SvgTheme,
): string {
  return edges
    .map(edge => {
      const dashed = isSimNodeEdge(edge, nodesById);
      if (edge.data?.edgeType === 'esilag' && edge.data.esiLeaves?.length) {
        return renderEsiLagEdge(edge, edge.data.esiLeaves, nodesById, theme, dashed);
      }

      const points = resolveEdgePoints(edge, nodesById);
      if (!points) return '';

      if (expandedEdges.has(edge.id) && (edge.data?.memberLinks?.length ?? 0) > 0) {
        return renderExpandedEdge(edge, points, theme, dashed);
      }

      return renderStandardEdge(edge, points, theme, dashed);
    })
    .join('');
}

function getNodeRole(node: UINode, nodeTemplates: NodeTemplate[]): string | undefined {
  const template = node.data.template
    ? nodeTemplates.find(candidate => candidate.name === node.data.template)
    : undefined;
  return node.data.role
    || node.data.labels?.['eda.nokia.com/role']
    || template?.labels?.['eda.nokia.com/role'];
}

function renderRoleIcon(role: string | undefined, x: number, y: number, theme: SvgTheme): string {
  const icon = role ? ROLE_ICONS[role] : undefined;
  if (!icon) return '';

  return icon
    .replace('<svg ', `<svg x="${x}" y="${y}" `)
    .replaceAll('var(--color-icon-bg)', escapeXml(theme.iconBackground))
    .replaceAll('var(--color-icon-fg)', escapeXml(theme.iconForeground));
}

function renderSimNodeIcon(node: UINode, simNodeTemplates: SimNodeTemplate[], x: number, y: number): string {
  const template = node.data.template
    ? simNodeTemplates.find(candidate => candidate.name === node.data.template)
    : undefined;
  const simNodeType = node.data.simNodeType || template?.type || 'Linux';
  const path = simNodeType === 'TestMan' ? SPEED_ICON_PATH : CONTAINER_ICON_PATH;
  const scale = NODE_ICON_SIZE / 24;

  return `<g transform="translate(${x} ${y}) scale(${scale})" fill="${SIM_ICON_COLOR}"><path d="${escapeXml(path)}"/></g>`;
}

function renderEdgeLinkIcon(x: number, y: number): string {
  return `<g class="export-edge-link-icon" transform="translate(${x} ${y})">`
    + '<rect width="14" height="14" rx="3" fill="#919191"/>'
    + '<g transform="translate(2.8 2.8) scale(0.7)" fill="white">'
    + '<path d="M1.23219 7.76802C0.255937 6.79165 0.255937 5.20865 1.23219 4.23228C2.20844 3.25591 3.79126 3.25591 4.76751 4.23228C5.74376 5.20865 5.74376 6.79166 4.76751 7.76803C3.79126 8.7444 2.20844 8.7444 1.23219 7.76802Z"/>'
    + '<path d="M11.375 5.99982C11.375 6.10074 11.3343 6.19741 11.2622 6.26796L9.47216 8.01796C9.32407 8.16274 9.08665 8.16006 8.94187 8.01197C8.79708 7.86388 8.79977 7.62645 8.94786 7.48167L10.08 6.37482L6.875 6.37482C6.6679 6.37482 6.5 6.20692 6.5 5.99982C6.5 5.79271 6.6679 5.62482 6.875 5.62482H10.08L8.94786 4.51796C8.79977 4.37318 8.79708 4.13575 8.94187 3.98766C9.08665 3.83957 9.32407 3.83689 9.47216 3.98167L11.2622 5.73167C11.3343 5.80223 11.375 5.89889 11.375 5.99982Z"/>'
    + '</g>'
    + '</g>';
}

function renderNode(
  node: UINode,
  shiftedNode: NodeInfo,
  nodeTemplates: NodeTemplate[],
  simNodeTemplates: SimNodeTemplate[],
  theme: SvgTheme,
): string {
  const x = shiftedNode.position.x;
  const y = shiftedNode.position.y;
  const name = node.data.name || 'Unknown';
  const isSimNode = node.data.nodeType === 'simnode';
  const role = getNodeRole(node, nodeTemplates);
  const hasRoleIcon = !isSimNode && Boolean(role && ROLE_ICONS[role]);
  const hasSimIcon = isSimNode;
  const hasIcon = hasRoleIcon || hasSimIcon;
  const borderDash = isSimNode ? ' stroke-dasharray="4 4"' : '';
  const icon = isSimNode
    ? renderSimNodeIcon(node, simNodeTemplates, x + NODE_ICON_X, y + NODE_ICON_Y)
    : renderRoleIcon(role, x + NODE_ICON_X, y + NODE_ICON_Y, theme);
  const edgeLinkIcon = role === 'leaf'
    ? renderEdgeLinkIcon(x + NODE_ICON_X + NODE_ICON_SIZE + 2, y + NODE_ICON_Y + NODE_ICON_SIZE / 2 - 7)
    : '';
  const labelY = y + (hasIcon ? NODE_LABEL_Y_WITH_ICON : NODE_LABEL_Y_WITHOUT_ICON);

  return `<g class="export-node topology-node" data-id="${escapeXml(node.id)}">`
    + `<rect x="${x}" y="${y}" width="${DEFAULT_NODE_WIDTH}" height="${DEFAULT_NODE_HEIGHT}" rx="8" fill="${escapeXml(theme.nodeBackground)}" stroke="${escapeXml(theme.nodeBorder)}" stroke-width="1"${borderDash}/>`
    + icon
    + edgeLinkIcon
    + `<text x="${x + DEFAULT_NODE_WIDTH / 2}" y="${labelY}" text-anchor="middle" font-family="${FONT_FAMILY}" font-size="12" font-weight="700" fill="${escapeXml(theme.nodeText)}">${escapeXml(middleEllipsis(name, NODE_LABEL_MAX_CHARS))}</text>`
    + '</g>';
}

function renderNodes(
  nodes: UINode[],
  nodesById: Map<string, NodeInfo>,
  nodeTemplates: NodeTemplate[],
  simNodeTemplates: SimNodeTemplate[],
  theme: SvgTheme,
): string {
  return nodes
    .map(node => {
      const shiftedNode = nodesById.get(node.id);
      if (!shiftedNode) return '';
      return renderNode(node, shiftedNode, nodeTemplates, simNodeTemplates, theme);
    })
    .join('');
}

function renderBackground(width: number, height: number, theme: SvgTheme, includeGrid: boolean): string {
  const grid = includeGrid
    ? `<defs><pattern id="topobuilder-dot-grid" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="${escapeXml(theme.dotColor)}" opacity="0.45"/></pattern></defs>`
      + `<rect width="${width}" height="${height}" fill="url(#topobuilder-dot-grid)"/>`
    : '';

  return `<rect width="${width}" height="${height}" fill="${escapeXml(theme.background)}"/>${grid}`;
}

function renderTransparentBackground(width: number, height: number, theme: SvgTheme, includeGrid: boolean): string {
  if (!includeGrid) return '';

  return `<defs><pattern id="topobuilder-dot-grid" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="${escapeXml(theme.dotColor)}" opacity="0.45"/></pattern></defs>`
    + `<rect width="${width}" height="${height}" fill="url(#topobuilder-dot-grid)"/>`;
}

export function buildTopologySvgExport(input: TopologySvgExportInput): string | null {
  const visibleNodes = input.nodes.filter(node => isVisibleNode(node, input.showSimNodes));
  const visibleNodeIds = new Set(visibleNodes.map(node => node.id));
  const visibleEdges = input.edges.filter(edge => isVisibleEdge(edge, visibleNodeIds));
  const bounds = calculateBounds(visibleNodes, input.annotations);
  if (!bounds) return null;

  const padding = Math.max(0, input.paddingPx ?? DEFAULT_EXPORT_PADDING);
  const zoomFactor = Math.max(0.1, Math.min(3, (input.zoomPercent ?? 100) / 100));
  const contentWidth = bounds.maxX - bounds.minX;
  const contentHeight = bounds.maxY - bounds.minY;
  const baseWidth = Math.max(MIN_EXPORT_SIZE, Math.ceil(contentWidth + padding * 2));
  const baseHeight = Math.max(MIN_EXPORT_SIZE, Math.ceil(contentHeight + padding * 2));
  const width = Math.max(1, Math.round(baseWidth * zoomFactor));
  const height = Math.max(1, Math.round(baseHeight * zoomFactor));
  const offsetX = -bounds.minX + (baseWidth - contentWidth) / 2;
  const offsetY = -bounds.minY + (baseHeight - contentHeight) / 2;
  const theme = {
    ...resolveSvgTheme(input.container),
    ...(input.backgroundColor && !input.transparentBackground ? { background: input.backgroundColor } : {}),
  };
  const nodesById = new Map(visibleNodes.map(node => [node.id, shiftNode(node, offsetX, offsetY)]));
  const annotations = renderAnnotations(input.annotations, offsetX, offsetY);
  const includeGrid = input.includeBackgroundGrid !== false;
  const background = input.transparentBackground
    ? renderTransparentBackground(width, height, theme, includeGrid)
    : renderBackground(width, height, theme, includeGrid);
  const graphTransform = zoomFactor === 1 ? '' : ` transform="scale(${zoomFactor})"`;

  return '<?xml version="1.0" encoding="UTF-8"?>\n'
    + `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`
    + background
    + `<g id="graph"${graphTransform}>`
    + `<g id="annotations-shapes">${annotations.shapes}</g>`
    + `<g id="edges">${renderEdges(visibleEdges, nodesById, input.expandedEdges, theme)}</g>`
    + `<g id="nodes">${renderNodes(visibleNodes, nodesById, input.nodeTemplates, input.simNodeTemplates, theme)}</g>`
    + `<g id="annotations-text">${annotations.texts}</g>`
    + '</g>'
    + '</svg>';
}

export function downloadSvg(svgContent: string, filename: string): void {
  downloadTextFile(svgContent, filename, 'image/svg+xml');
}
