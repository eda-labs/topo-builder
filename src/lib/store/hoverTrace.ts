/**
 * Hover trace — which cable/port the pointer is on, and what to say about it.
 *
 * Modelled on cable-map's trace store: hovering a cable or either of its ports lights the
 * cable, both endpoint ports and a HUD readout, while every other cable dims. The state lives
 * outside the topology store so a hover never re-renders the editor — only the cables and
 * ports that subscribe to their own membership react, via cheap string comparisons.
 *
 * Keys are `${edgeId}#${memberIndex}` for member cables (both ports of a member share the
 * cable's key, which is what makes the trace bidirectional for free) and `edge:${node}:${iface}`
 * for edge-links, which highlight only locally.
 */
import { create } from 'zustand';

export type HoverMode = 'idle' | 'on' | 'dim';

export interface HoverHudInfo {
  nodeA: string;
  ifaceA: string;
  nodeB: string;
  ifaceB?: string;
  kind: 'link' | 'sim' | 'edge' | 'free';
  linkName?: string;
  lagName?: string;
  /** per-channel/cage speed in Gb/s when known */
  speedGbps?: number;
}

interface HoverTraceState {
  key: string | null;
  /** true only for cable traces — free ports and edge-links must not dim the canvas */
  dimming: boolean;
  hud: HoverHudInfo | null;
  setHover: (key: string, hud: HoverHudInfo | null, dim?: boolean) => void;
  /** clears only while `key` is still the active one, so racing mouseleaves don't clobber */
  clearHover: (key: string) => void;
}

export const useHoverTrace = create<HoverTraceState>((set, get) => ({
  key: null,
  dimming: false,
  hud: null,
  setHover: (key, hud, dim = true) => { set({ key, dimming: dim, hud }); },
  clearHover: key => {
    if (get().key === key) set({ key: null, dimming: false, hud: null });
  },
}));

export const memberHoverKey = (edgeId: string, memberIndex: number): string =>
  `${edgeId}#${memberIndex}`;

/** Display mode of the element identified by `key` (null -> element never lights, only dims). */
export function useHoverMode(key: string | null): HoverMode {
  return useHoverTrace(state => {
    if (!state.dimming) return 'idle';
    return key !== null && state.key === key ? 'on' : 'dim';
  });
}

/** Whether this element's key is the actively hovered one (ports light without dimming peers). */
export function useHoverHot(key: string | null): boolean {
  return useHoverTrace(state => key !== null && state.key === key);
}
