import type { Node, Edge } from '@xyflow/react';

import type { NodeTemplate, LinkTemplate } from '../types/schema';
import type { UINodeData, UIEdgeData, UIMemberLink, UILagGroup } from '../types/ui';

import {
  LABEL_POS_X,
  LABEL_POS_Y,
  LABEL_EDGE_ID,
  LABEL_MEMBER_INDEX,
} from './constants';

export function getNodeLabels(
  node: Node<UINodeData>,
  nodeTemplates: NodeTemplate[],
): Record<string, string> {
  const templateLabels = node.data.template
    ? nodeTemplates.find(t => t.name === node.data.template)?.labels
    : undefined;

  return {
    ...templateLabels,
    ...node.data.labels,
    [LABEL_POS_X]: String(Math.round(node.position.x)),
    [LABEL_POS_Y]: String(Math.round(node.position.y)),
  };
}

export function getInheritedNodeLabels(
  node: Node<UINodeData>,
  nodeTemplates: NodeTemplate[],
): Record<string, string> {
  if (!node.data.template) return {};
  const template = nodeTemplates.find(t => t.name === node.data.template);
  return template?.labels ?? {};
}

export function getLinkLabels(
  edge: Edge<UIEdgeData>,
  memberIndex: number,
  memberLink: UIMemberLink | undefined,
  linkTemplates: LinkTemplate[],
): Record<string, string> {
  const templateLabels = memberLink?.template
    ? linkTemplates.find(t => t.name === memberLink.template)?.labels
    : undefined;

  return {
    ...templateLabels,
    ...memberLink?.labels,
    [LABEL_EDGE_ID]: edge.id,
    [LABEL_MEMBER_INDEX]: String(memberIndex),
  };
}

export function getInheritedLinkLabels(
  memberLink: UIMemberLink | undefined,
  linkTemplates: LinkTemplate[],
): Record<string, string> {
  if (!memberLink?.template) return {};
  const template = linkTemplates.find(t => t.name === memberLink.template);
  return template?.labels ?? {};
}

export function getLagLabels(
  edge: Edge<UIEdgeData>,
  lagGroup: UILagGroup,
  linkTemplates: LinkTemplate[],
): Record<string, string> {
  const templateLabels = lagGroup.template
    ? linkTemplates.find(t => t.name === lagGroup.template)?.labels
    : undefined;

  const memberIndex = lagGroup.memberLinkIndices[0] ?? 0;

  return {
    ...templateLabels,
    ...lagGroup.labels,
    [LABEL_EDGE_ID]: edge.id,
    [LABEL_MEMBER_INDEX]: String(memberIndex),
  };
}

export function getInheritedLagLabels(
  lagGroup: UILagGroup,
  linkTemplates: LinkTemplate[],
): Record<string, string> {
  if (!lagGroup.template) return {};
  const template = linkTemplates.find(t => t.name === lagGroup.template);
  return template?.labels ?? {};
}
