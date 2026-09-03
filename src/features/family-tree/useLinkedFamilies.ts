'use client';

// Family Tree — Linked-families state for the canvas
// Loads the link list (for the chips bar) and each linked family's tree
// (for the ghost overlay), recomputing the ghost layout with the same
// computeLayout used for the main tree. Re-fetches when the active family
// changes. All failures degrade gracefully (empty lists / missing ghosts).

import { useEffect, useState } from 'react';
import { computeLayout } from './layout';
import { fetchLinkedFamilies, fetchLinkedTree } from './linkedFamilies';
import type { LinkedFamilyInfo, LinkedTree } from './linkedFamilies';
import type { LayoutResult } from './types';

export interface GhostTree {
  family: LinkedFamilyInfo;
  layout: LayoutResult;
  persons: LinkedTree['persons'];
}

export function useLinkedFamilies(activeFamilyId: string | null, enabled: boolean) {
  const [links, setLinks] = useState<LinkedFamilyInfo[]>([]);
  const [ghosts, setGhosts] = useState<Record<string, GhostTree>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Yield a microtask first — keeps every setState below out of the
      // synchronous effect body (react-hooks/set-state-in-effect).
      await Promise.resolve();
      if (cancelled) return;

      if (!enabled || !activeFamilyId) {
        setLinks([]);
        setGhosts({});
        setLoading(false);
        return;
      }
      setLoading(true);

      const linkedList = await fetchLinkedFamilies(activeFamilyId);
      if (cancelled) return;
      setLinks(linkedList);

      // Fetch each linked tree in parallel and lay it out for the ghost view.
      const entries = await Promise.all(
        linkedList.map(async (l): Promise<[string, GhostTree | null]> => {
          const tree = await fetchLinkedTree(l.familyId);
          if (!tree) return [l.familyId, null];
          const hasAny =
            Object.keys(tree.persons).length > 0 || tree.familyUnits.length > 0;
          if (!hasAny) return [l.familyId, null];
          return [
            l.familyId,
            {
              family: l,
              persons: tree.persons,
              layout: computeLayout(tree.persons, tree.familyUnits),
            },
          ];
        }),
      );
      if (cancelled) return;
      const next: Record<string, GhostTree> = {};
      for (const [id, g] of entries) if (g) next[id] = g;
      setGhosts(next);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [activeFamilyId, enabled]);

  return { links, ghosts, loading };
}
