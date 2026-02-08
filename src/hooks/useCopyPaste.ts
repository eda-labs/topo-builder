import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { useReactFlow, type Node, type Edge } from '@xyflow/react';

import { useTopologyStore } from '../lib/store';
import { generateAnnotationId } from '../lib/store/annotations';
import type { UINodeData, UIEdgeData, UIClipboard, UIAnnotation } from '../types/ui';

// Use UIClipboard but with React Flow node types for the nodes/edges arrays
type ClipboardData = Omit<UIClipboard, 'nodes' | 'edges'> & {
  nodes: Node<UINodeData>[];
  edges: Edge<UIEdgeData>[];
  annotations?: UIAnnotation[];
};

// Module-level clipboard for context menu fallback
// This allows copy/paste to work within the same tab even when execCommand fails
let moduleClipboard: ClipboardData | null = null;

interface UseCopyPasteOptions {
  isPastingRef?: RefObject<boolean>;
  mousePositionRef?: RefObject<{ x: number; y: number }>;
  contextMenuPosition?: { x: number; y: number } | null;
}

export function useCopyPaste(options: UseCopyPasteOptions = {}) {
  const { isPastingRef, mousePositionRef, contextMenuPosition } = options;
  const { getNodes, getEdges, screenToFlowPosition } = useReactFlow();
  const {
    saveToUndoHistory,
    triggerYamlRefresh,
    pasteSelection,
    addMemberLink,
  } = useTopologyStore();

  // Keep track of last context menu position for paste operations
  const lastContextMenuPositionRef = useRef<{ x: number; y: number } | null>(null);

  // Internal mouse position tracking - always tracks current mouse position
  const internalMousePositionRef = useRef<{ x: number; y: number }>({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

  // Track mouse position globally for paste operations
  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      internalMousePositionRef.current = { x: event.clientX, y: event.clientY };
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => { window.removeEventListener('mousemove', handleMouseMove); };
  }, []);

  // Update the ref when contextMenuPosition changes (including clearing it when menu closes)
  useEffect(() => {
    lastContextMenuPositionRef.current = contextMenuPosition ?? null;
  }, [contextMenuPosition]);

  const buildClipboardData = useCallback((): ClipboardData | null => {
    const allNodes = getNodes() as Node<UINodeData>[];
    const allEdges = getEdges() as Edge<UIEdgeData>[];
    const selectedNodes = allNodes.filter(n => n.selected && !n.id.startsWith('a'));
    const selectedEdges = allEdges.filter(e => e.selected);
    const selectedRegularNodes = selectedNodes.filter(n => n.data.nodeType !== 'simnode');
    const selectedSimNodes = selectedNodes.filter(n => n.data.nodeType === 'simnode');

    const { annotations, selectedAnnotationIds } = useTopologyStore.getState();
    const selectedAnnotations = annotations.filter(a => selectedAnnotationIds.has(a.id));

    // Special case: copying a single link copies its template for pasting into other links
    if (selectedEdges.length === 1 && selectedNodes.length === 0) {
      const edge = selectedEdges[0];
      if (edge && edge.data?.edgeType !== 'esilag') {
        const memberLinks = edge.data?.memberLinks || [];
        if (memberLinks.length > 0) {
          return {
            nodes: [],
            edges: [],
            simNodes: [],
            copiedLink: {
              edgeId: edge.id,
              template: memberLinks[0].template,
            },
          };
        }
      }
    }

    if (selectedNodes.length > 0 || selectedEdges.length > 0 || selectedAnnotations.length > 0) {
      return {
        nodes: selectedRegularNodes.map(n => ({
          ...n,
          position: { ...n.position },
          data: { ...n.data },
        })),
        edges: selectedEdges.map(e => ({
          ...e,
          data: e.data ? {
            ...e.data,
            memberLinks: e.data.memberLinks?.map(ml => ({
              ...ml,
              labels: ml.labels ? { ...ml.labels } : undefined,
            })),
            lagGroups: e.data.lagGroups?.map(lg => ({
              ...lg,
              memberLinkIndices: [...lg.memberLinkIndices],
              labels: lg.labels ? { ...lg.labels } : undefined,
            })),
          } : undefined,
        })),
        simNodes: selectedSimNodes.map(n => ({
          id: n.id,
          name: n.data.name,
          template: n.data.template,
          type: n.data.simNodeType,
          image: n.data.image,
          labels: n.data.labels,
          position: n.position ? { x: n.position.x, y: n.position.y } : undefined,
        })),
        annotations: selectedAnnotations.map(a => ({ ...a, position: { ...a.position } })),
      };
    }

    return null;
  }, [getNodes, getEdges]);

  const pasteCopiedLinkTemplate = useCallback((copiedLink: NonNullable<ClipboardData['copiedLink']>) => {
    const currentState = useTopologyStore.getState();
    const targetEdgeId = currentState.selectedEdgeId || copiedLink.edgeId;
    const edge = currentState.edges.find(e => e.id === targetEdgeId);
    if (!edge?.data) return;

    const sourceIsSimNode = edge.source.startsWith('sim-');
    const targetIsSimNode = edge.target.startsWith('sim-');

    const extractPortNumber = (iface: string): number => {
      const ethernetMatch = iface.match(/ethernet-1-(\d+)/);
      if (ethernetMatch) return parseInt(ethernetMatch[1], 10);

      const ethMatch = iface.match(/eth(\d+)/);
      if (ethMatch) return parseInt(ethMatch[1], 10);

      return 0;
    };

    const nextPortForNode = (nodeId: string): number => {
      const portNumbers = currentState.edges.flatMap(e => {
        if (e.source === nodeId) return e.data?.memberLinks?.map(ml => extractPortNumber(ml.sourceInterface)) || [];
        if (e.target === nodeId) return e.data?.memberLinks?.map(ml => extractPortNumber(ml.targetInterface)) || [];
        return [];
      });

      return Math.max(0, ...portNumbers) + 1;
    };

    const nextSourcePort = nextPortForNode(edge.source);
    const nextTargetPort = nextPortForNode(edge.target);

    const sourceInterface = sourceIsSimNode ? `eth${nextSourcePort}` : `ethernet-1-${nextSourcePort}`;
    const targetInterface = targetIsSimNode ? `eth${nextTargetPort}` : `ethernet-1-${nextTargetPort}`;

    const memberLinks = edge.data.memberLinks || [];
    const nextLinkNumber = memberLinks.length + 1;

    addMemberLink(edge.id, {
      name: `${edge.data.targetNode}-${edge.data.sourceNode}-${nextLinkNumber}`,
      template: copiedLink.template,
      sourceInterface,
      targetInterface,
    });
    triggerYamlRefresh();
  }, [addMemberLink, triggerYamlRefresh]);

  const performPaste = useCallback((clipboardData: ClipboardData, cursorPos: { x: number; y: number }) => {
    const { nodes: copiedNodes, edges: copiedEdges, simNodes: copiedSimNodes, annotations: copiedAnnotations, copiedLink } = clipboardData;

    // Handle pasting a copied link template
    if (copiedLink) {
      pasteCopiedLinkTemplate(copiedLink);
      return;
    }

    const hasAnnotations = copiedAnnotations && copiedAnnotations.length > 0;
    if (!copiedNodes?.length && !copiedSimNodes?.length && !hasAnnotations) return;

    // Set pasting flag to prevent selection sync during paste
    if (isPastingRef) isPastingRef.current = true;

    saveToUndoHistory();

    const allPositions = [
      ...copiedNodes.map(n => n.position),
      ...copiedSimNodes.map(sn => sn.position).filter((p): p is { x: number; y: number } => !!p),
      ...(copiedAnnotations || []).map(a => a.position),
    ];
    const centerX = allPositions.length > 0
      ? allPositions.reduce((sum, p) => sum + p.x, 0) / allPositions.length
      : 0;
    const centerY = allPositions.length > 0
      ? allPositions.reduce((sum, p) => sum + p.y, 0) / allPositions.length
      : 0;

    const offset = {
      x: cursorPos.x - centerX,
      y: cursorPos.y - centerY,
    };

    pasteSelection(copiedNodes, copiedEdges, offset, copiedSimNodes, cursorPos);

    if (hasAnnotations) {
      const newAnnotations: UIAnnotation[] = copiedAnnotations.map(ann => {
        const id = generateAnnotationId();
        const offsetPos = { x: ann.position.x + offset.x, y: ann.position.y + offset.y };
        if (ann.type === 'text') {
          return { id, type: ann.type, position: offsetPos, text: ann.text, fontSize: ann.fontSize, fontColor: ann.fontColor } as UIAnnotation;
        }
        return { id, type: ann.type, position: offsetPos, shapeType: ann.shapeType, width: ann.width, height: ann.height, strokeColor: ann.strokeColor, fillColor: ann.fillColor, strokeWidth: ann.strokeWidth, strokeStyle: ann.strokeStyle } as UIAnnotation;
      });
      const newIds = new Set(newAnnotations.map(a => a.id));
      const currentAnnotations = useTopologyStore.getState().annotations;
      useTopologyStore.setState({
        annotations: [...currentAnnotations, ...newAnnotations],
        selectedAnnotationId: newAnnotations[newAnnotations.length - 1]?.id ?? null,
        selectedAnnotationIds: newIds,
      });
      triggerYamlRefresh();
    }

    // Clear pasting flag after a tick to allow React state to settle
    if (isPastingRef) {
      setTimeout(() => {
        isPastingRef.current = false;
      }, 0);
    }
  }, [pasteCopiedLinkTemplate, saveToUndoHistory, pasteSelection, isPastingRef, triggerYamlRefresh]);

  const onCopy = useCallback((event: ClipboardEvent) => {
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

    event.preventDefault();

    const data = buildClipboardData();
    if (data) {
      // Store in module-level clipboard for context menu fallback
      moduleClipboard = data;
      // Also try to set native clipboard data
      event.clipboardData?.setData('topology:data', JSON.stringify(data));
    }
  }, [buildClipboardData]);

  const onPaste = useCallback((event: ClipboardEvent) => {
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

    event.preventDefault();

    // Try to get data from native clipboard first
    const raw = event.clipboardData?.getData('topology:data');
    let clipboardData: ClipboardData | null = null;

    if (raw) {
      try {
        clipboardData = JSON.parse(raw) as ClipboardData;
      } catch {
        // Invalid JSON, fall through
      }
    }

    // Fall back to module clipboard if native clipboard didn't have our data
    if (!clipboardData) {
      clipboardData = moduleClipboard;
    }

    if (!clipboardData) return;

    // Get cursor position - prefer context menu position, then mouse position
    let cursorPos: { x: number; y: number };
    if (lastContextMenuPositionRef.current) {
      cursorPos = lastContextMenuPositionRef.current;
      // Clear it after use so keyboard paste doesn't use stale context menu position
      lastContextMenuPositionRef.current = null;
    } else {
      // Use external mouse position ref if provided, otherwise use internal tracking
      const mousePos = mousePositionRef?.current ?? internalMousePositionRef.current;
      cursorPos = screenToFlowPosition(mousePos);
    }

    performPaste(clipboardData, cursorPos);
  }, [performPaste, screenToFlowPosition, mousePositionRef]);

  // Imperative copy handler for context menu
  const handleCopy = useCallback(() => {
    const data = buildClipboardData();
    if (data) {
      moduleClipboard = data;
      // Try to use native clipboard API
      try {
        void navigator.clipboard.writeText(JSON.stringify(data));
      } catch {
        // Clipboard API not available, module clipboard will still work
      }
    }
  }, [buildClipboardData]);

  // Imperative paste handler for context menu
  const handlePaste = useCallback(() => {
    // Get cursor position for paste
    let cursorPos: { x: number; y: number };
    if (lastContextMenuPositionRef.current) {
      cursorPos = lastContextMenuPositionRef.current;
      lastContextMenuPositionRef.current = null;
    } else {
      // Use external mouse position ref if provided, otherwise use internal tracking
      const mousePos = mousePositionRef?.current ?? internalMousePositionRef.current;
      cursorPos = screenToFlowPosition(mousePos);
    }

    // Use module clipboard directly for context menu paste
    if (moduleClipboard) {
      performPaste(moduleClipboard, cursorPos);
    }
  }, [performPaste, screenToFlowPosition, mousePositionRef]);

  useEffect(() => {
    document.addEventListener('copy', onCopy);
    document.addEventListener('paste', onPaste);
    return () => {
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('paste', onPaste);
    };
  }, [onCopy, onPaste]);

  // Return handlers for context menu use
  return { handleCopy, handlePaste, hasClipboardData: () => moduleClipboard !== null };
}
