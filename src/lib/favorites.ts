/**
 * User-pinned palette favorites.
 *
 * A favorite is a platform (plus fitted components, for configured chassis) the user starred in
 * the palette or the platform-details card. Favorites live outside the topology store because
 * they are a per-user preference, not part of any topology document; they persist in
 * localStorage and survive Clear All / imports.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { Component } from '../types/schema';

export interface FavoriteEntry {
  id: string;
  label: string;
  platform: string;
  components?: Component[];
}

/** Stable identity of a platform + component fit, so the same combo is starred only once. */
export function favoriteId(platform: string, components?: Component[]): string {
  const parts = (components ?? [])
    .map(c => `${c.kind}:${c.slot ?? ''}:${c.type}`)
    .sort((a, b) => a.localeCompare(b));
  return [platform.trim(), ...parts].join('|');
}

interface FavoritesState {
  favorites: FavoriteEntry[];
  toggleFavorite: (entry: Omit<FavoriteEntry, 'id'>) => void;
}

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      favorites: [],
      toggleFavorite: entry => {
        const id = favoriteId(entry.platform, entry.components);
        const { favorites } = get();
        set({
          favorites: favorites.some(f => f.id === id)
            ? favorites.filter(f => f.id !== id)
            : [...favorites, { id, ...entry }],
        });
      },
    }),
    { name: 'topology-palette-favorites' },
  ),
);
