import type { Node, Edge } from '@xyflow/react';

import type {
  Operation,
  NodeTemplate,
  LinkTemplate,
  SimNodeTemplate,
  SimNodeType,
} from './schema';

export type UINodeType = 'node' | 'simnode';

export interface UINodeData {
  [key: string]: unknown;
  id: string;
  name: string;
  nodeType?: UINodeType;
  template?: string;
  serialNumber?: string;
  labels?: Record<string, string>;
  isNew?: boolean;
  platform?: string;
  nodeProfile?: string;
  role?: string;
  simNodeType?: SimNodeType;
  image?: string;
}

export type UINode = Node<UINodeData>;

export interface UILagGroup {
  id: string;
  name: string;
  template?: string;
  memberLinkIndices: number[];
  labels?: Record<string, string>;
}

export interface UIEsiLeaf {
  nodeId: string;
  nodeName: string;
}

export type UIEdgeType = 'normal' | 'lag' | 'esilag';

export interface UIMemberLink {
  name: string;
  template?: string;
  sourceInterface: string;
  targetInterface: string;
  labels?: Record<string, string>;
}

export interface UIEdgeData {
  [key: string]: unknown;
  id: string;
  sourceNode: string;
  targetNode: string;
  edgeType?: UIEdgeType;
  memberLinks?: UIMemberLink[];
  lagGroups?: UILagGroup[];
  esiLeaves?: UIEsiLeaf[];
  esiLagName?: string;
}

export type UIEdge = Edge<UIEdgeData>;

export interface UISimNode {
  id: string;
  name: string;
  template?: string;
  type?: SimNodeType;
  image?: string;
  labels?: Record<string, string>;
  position?: { x: number; y: number };
  isNew?: boolean;
}

export interface UISelection {
  nodeIds: string[];
  edgeIds: string[];
  memberLinkIndices: number[];
  lagId: string | null;
}

export interface SelectionState {
  selectedNodeId: string | null;
  selectedNodeIds: string[];
  selectedEdgeId: string | null;
  selectedEdgeIds: string[];
  selectedSimNodeName: string | null;
  selectedSimNodeNames: Set<string>;
  selectedMemberLinkIndices: number[];
  selectedLagId: string | null;
}

export interface UISimulation {
  simNodeTemplates: SimNodeTemplate[];
  simNodes: UISimNode[];
  topology?: unknown;
}

export interface UIClipboard {
  nodes: UINode[];
  edges: UIEdge[];
  simNodes: UISimNode[];
  annotations?: UIAnnotation[];
  copiedLink?: {
    edgeId: string;
    template?: string;
  };
}

export interface ValidationError {
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export type AnnotationShapeType = 'rectangle' | 'circle';
export type AnnotationStrokeStyle = 'solid' | 'dashed' | 'dotted';

interface UIAnnotationBase {
  id: string;
  position: { x: number; y: number };
}

export interface UITextAnnotation extends UIAnnotationBase {
  type: 'text';
  text: string;
  fontSize: number;
  fontColor: string;
}

export interface UIShapeAnnotation extends UIAnnotationBase {
  type: 'shape';
  shapeType: AnnotationShapeType;
  width: number;
  height: number;
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  strokeStyle: AnnotationStrokeStyle;
}

export type UIAnnotation = UITextAnnotation | UIShapeAnnotation;
export type UIAnnotationInput = Omit<UITextAnnotation, 'id'> | Omit<UIShapeAnnotation, 'id'>;

export interface UIState {
  topologyName: string;
  namespace: string;
  operation: Operation;
  nodeTemplates: NodeTemplate[];
  linkTemplates: LinkTemplate[];
  nodes: UINode[];
  edges: UIEdge[];
  simulation: UISimulation;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  selectedEdgeIds: string[];
  selectedSimNodeName: string | null;
  selectedSimNodeNames: Set<string>;
  selectedMemberLinkIndices: number[];
  selectedLagId: string | null;
  expandedEdges: Set<string>;
  showSimNodes: boolean;
  yamlRefreshCounter: number;
  layoutVersion: number;
  error: string | null;
  clipboard: UIClipboard;
}
