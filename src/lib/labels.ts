import type { Node, Edge } from '@xyflow/react';

import type {
  TopologyNodeData,
  TopologyEdgeData,
  NodeTemplate,
  LinkTemplate,
  MemberLink,
  LagGroup,
} from '../types/topology';

import {
  LABEL_POS_X,
  LABEL_POS_Y,
  LABEL_SRC_HANDLE,
  LABEL_DST_HANDLE,
  LABEL_EDGE_ID,
  LABEL_MEMBER_INDEX,
} from './constants';

export function getNodeLabels(
  node: Node<TopologyNodeData>,
  nodeTemplates: NodeTemplate[]
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
  node: Node<TopologyNodeData>,
  nodeTemplates: NodeTemplate[]
): Record<string, string> {
  if (!node.data.template) return {};
  const template = nodeTemplates.find(t => t.name === node.data.template);
  return template?.labels ?? {};
}

export function getLinkLabels(
  edge: Edge<TopologyEdgeData>,
  memberIndex: number,
  memberLink: MemberLink | undefined,
  linkTemplates: LinkTemplate[]
): Record<string, string> {
  const templateLabels = memberLink?.template
    ? linkTemplates.find(t => t.name === memberLink.template)?.labels
    : undefined;

  return {
    ...templateLabels,
    ...memberLink?.labels,
    [LABEL_EDGE_ID]: edge.id,
    [LABEL_MEMBER_INDEX]: String(memberIndex),
    ...(edge.sourceHandle && { [LABEL_SRC_HANDLE]: edge.sourceHandle }),
    ...(edge.targetHandle && { [LABEL_DST_HANDLE]: edge.targetHandle }),
  };
}

export function getInheritedLinkLabels(
  memberLink: MemberLink | undefined,
  linkTemplates: LinkTemplate[]
): Record<string, string> {
  if (!memberLink?.template) return {};
  const template = linkTemplates.find(t => t.name === memberLink.template);
  return template?.labels ?? {};
}

export function getLagLabels(
  edge: Edge<TopologyEdgeData>,
  lagGroup: LagGroup,
  linkTemplates: LinkTemplate[]
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
    ...(edge.sourceHandle && { [LABEL_SRC_HANDLE]: edge.sourceHandle }),
    ...(edge.targetHandle && { [LABEL_DST_HANDLE]: edge.targetHandle }),
  };
}

export function getInheritedLagLabels(
  lagGroup: LagGroup,
  linkTemplates: LinkTemplate[]
): Record<string, string> {
  if (!lagGroup.template) return {};
  const template = linkTemplates.find(t => t.name === lagGroup.template);
  return template?.labels ?? {};
}
