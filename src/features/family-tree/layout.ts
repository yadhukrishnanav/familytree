// Family Tree — Auto-layout algorithm
// Positions persons/couples on a grid with parents above their children.

import type { FamilyUnit, LayoutConnection, LayoutNode, LayoutResult, Person } from './types';
import { NIL_UUID } from './types';

export const NODE_WIDTH = 220;
export const NODE_HEIGHT = 110;
export const SPOUSE_GAP = 40; // gap between partners in a couple
export const SIBLING_GAP = 50; // gap between sibling subtrees
export const GENERATION_GAP = 160; // vertical gap between generations

interface SubtreeInfo {
  width: number;
}

export function computeLayout(
  persons: Record<string, Person>,
  familyUnits: FamilyUnit[],
): LayoutResult {
  const nodes: LayoutNode[] = [];
  const connections: LayoutConnection[] = [];

  if (familyUnits.length === 0 && Object.keys(persons).length === 0) {
    return { nodes, connections, width: 0, height: 0 };
  }

  // Index: childId -> unitId (which unit treats this person as a child)
  const childToParentUnit = new Map<string, string>();
  for (const u of familyUnits) {
    for (const c of u.childrenIds) childToParentUnit.set(c, u.id);
  }

  // Root units = units where neither partner is a child of another unit.
  // Sibling groups (partner1Id === NIL_UUID) are always root units.
  const rootUnits = familyUnits.filter((u) => {
    if (u.partner1Id === NIL_UUID) return true; // sibling group — always root
    const p1Child = childToParentUnit.has(u.partner1Id);
    const p2Child = u.partner2Id ? childToParentUnit.has(u.partner2Id) : false;
    return !p1Child && !p2Child;
  });

  // Compute width of each subtree bottom-up
  const subtreeWidthCache = new Map<string, number>();
  function computeSubtreeWidth(unitId: string): number {
    if (subtreeWidthCache.has(unitId)) return subtreeWidthCache.get(unitId)!;
    const unit = familyUnits.find((u) => u.id === unitId);
    if (!unit) return 0;

    // Sibling group: no partner nodes, just siblings (in childrenIds) laid
    // out side-by-side. coupleWidth = 0 (no partners to render).
    const isSiblingGroup = unit.partner1Id === NIL_UUID;
    const coupleWidth = isSiblingGroup
      ? 0
      : unit.partner2Id
          ? NODE_WIDTH * 2 + SPOUSE_GAP
          : NODE_WIDTH;

    if (unit.childrenIds.length === 0) {
      subtreeWidthCache.set(unitId, coupleWidth);
      return coupleWidth;
    }

    const childrenTotal = unit.childrenIds.reduce((sum, childId) => {
      const childUnit = familyUnits.find(
        (u) => u.partner1Id === childId || u.partner2Id === childId,
      );
      const w = childUnit ? computeSubtreeWidth(childUnit.id) : NODE_WIDTH;
      return sum + w + SIBLING_GAP;
    }, -SIBLING_GAP);

    // For sibling groups, there's no couple to take the max with — the width
    // is purely the children (siblings) total.
    const width = isSiblingGroup ? childrenTotal : Math.max(coupleWidth, childrenTotal);
    subtreeWidthCache.set(unitId, width);
    return width;
  }

  // Position units top-down
  let cursorX = 0;
  let maxX = 0;
  let maxY = 0;

  function positionUnit(
    unitId: string,
    centerX: number,
    topY: number,
    generation: number = 0,
  ): void {
    const unit = familyUnits.find((u) => u.id === unitId);
    if (!unit) return;

    // ---- Sibling group (partner1Id === NIL_UUID) ----
    // No parents to render. The "children" of this unit are the siblings
    // themselves, laid out side-by-side at the SAME Y (same generation).
    // A thin horizontal connector between adjacent siblings signals they're
    // a sibling group even when their parents haven't been added yet.
    if (unit.partner1Id === NIL_UUID) {
      if (unit.childrenIds.length === 0) {
        // Empty sibling group — shouldn't normally happen, but be safe.
        return;
      }

      // Compute each sibling's subtree width (they may have their own
      // spouse + descendants below them).
      const siblingWidths = unit.childrenIds.map((childId) => {
        const childUnit = familyUnits.find(
          (u) => u.partner1Id === childId || u.partner2Id === childId,
        );
        return {
          childId,
          width: childUnit ? computeSubtreeWidth(childUnit.id) : NODE_WIDTH,
          childUnitId: childUnit?.id,
        };
      });

      const totalWidth =
        siblingWidths.reduce((sum, c) => sum + c.width, 0) +
        SIBLING_GAP * (siblingWidths.length - 1);

      let siblingCursorX = centerX - totalWidth / 2;
      const connectorY = topY + NODE_HEIGHT / 2;
      let prevRightEdge: number | null = null;

      for (const sw of siblingWidths) {
        const siblingCenterX = siblingCursorX + sw.width / 2;

        // Thin horizontal connector between adjacent siblings — signals
        // "we're siblings" without a full parent-drop-down junction.
        if (prevRightEdge !== null) {
          connections.push({
            type: 'junction',
            fromX: prevRightEdge,
            fromY: connectorY,
            toX: siblingCenterX - NODE_WIDTH / 2,
            toY: connectorY,
          });
        }

        if (sw.childUnitId) {
          // Sibling has their own family unit (spouse + maybe kids).
          // Position it at the SAME Y and generation — siblings stay level.
          positionUnit(sw.childUnitId, siblingCenterX, topY, generation);
        } else {
          // Standalone sibling.
          nodes.push({
            id: `node-sg-${unit.id}-${sw.childId}`,
            x: siblingCenterX - NODE_WIDTH / 2,
            y: topY,
            type: 'person',
            personId: sw.childId,
            generation,
          });
          maxX = Math.max(maxX, siblingCenterX + NODE_WIDTH / 2);
          maxY = Math.max(maxY, topY + NODE_HEIGHT);
        }
        prevRightEdge = siblingCenterX + NODE_WIDTH / 2;
        siblingCursorX += sw.width + SIBLING_GAP;
      }
      return;
    }

    // ---- Regular couple / single-parent unit ----
    const coupleWidth = unit.partner2Id
      ? NODE_WIDTH * 2 + SPOUSE_GAP
      : NODE_WIDTH;

    // Center the couple at centerX
    const coupleLeftX = centerX - coupleWidth / 2;
    const partner1X = coupleLeftX;
    const partner2X = unit.partner2Id ? coupleLeftX + NODE_WIDTH + SPOUSE_GAP : null;

    // Person nodes — IDs are unique per unit-appearance so that the SAME person
    // can be rendered at multiple positions when they're a partner in more than
    // one family unit (remarriage). React keys stay unique because we embed the
    // unitId in the node id.
    nodes.push({
      id: `node-${unit.id}-${unit.partner1Id}`,
      x: partner1X,
      y: topY,
      type: 'person',
      personId: unit.partner1Id,
      generation,
    });
    if (partner2X !== null && unit.partner2Id) {
      nodes.push({
        id: `node-${unit.id}-${unit.partner2Id}`,
        x: partner2X,
        y: topY,
        type: 'person',
        personId: unit.partner2Id,
        generation,
      });
      // Marriage line
      connections.push({
        type: 'marriage',
        fromX: partner1X + NODE_WIDTH,
        fromY: topY + NODE_HEIGHT / 2,
        toX: partner2X,
        toY: topY + NODE_HEIGHT / 2,
        marriageYear: unit.marriageYear,
      });
    }

    // Children
    if (unit.childrenIds.length === 0) {
      maxX = Math.max(maxX, partner1X + NODE_WIDTH, partner2X !== null ? partner2X + NODE_WIDTH : 0);
      maxY = Math.max(maxY, topY + NODE_HEIGHT);
      return;
    }

    // Compute each child subtree width
    const childWidths = unit.childrenIds.map((childId) => {
      const childUnit = familyUnits.find(
        (u) => u.partner1Id === childId || u.partner2Id === childId,
      );
      return {
        childId,
        width: childUnit ? computeSubtreeWidth(childUnit.id) : NODE_WIDTH,
        childUnitId: childUnit?.id,
      };
    });

    const totalChildrenWidth = childWidths.reduce(
      (sum, c) => sum + c.width,
      0,
    ) + SIBLING_GAP * (childWidths.length - 1);

    // Layout children centered under couple
    let childCursorX = centerX - totalChildrenWidth / 2;
    const junctionY = topY + NODE_HEIGHT + GENERATION_GAP / 2;
    const coupleCenterX = unit.partner2Id
      ? partner1X + NODE_WIDTH + SPOUSE_GAP / 2
      : partner1X + NODE_WIDTH / 2;

    // Junction bar (parent line down to children level)
    connections.push({
      type: 'junction',
      fromX: coupleCenterX,
      fromY: topY + NODE_HEIGHT,
      toX: coupleCenterX,
      toY: junctionY,
    });

    const firstChildCenterX = childCursorX + childWidths[0].width / 2;
    const lastChildCenterX =
      childCursorX +
      childWidths.slice(0, -1).reduce((s, c) => s + c.width + SIBLING_GAP, 0) +
      childWidths[childWidths.length - 1].width / 2;

    // Horizontal bar spanning all children centers
    if (childWidths.length > 1) {
      connections.push({
        type: 'junction',
        fromX: firstChildCenterX,
        fromY: junctionY,
        toX: lastChildCenterX,
        toY: junctionY,
      });
    }

    for (const cw of childWidths) {
      const childCenterX = childCursorX + cw.width / 2;
      // Junction-to-child vertical — extend all the way to the CHILD CARD TOP
      // (was stopping NODE_HEIGHT/2 above the child, leaving the line floating
      // in mid-air). Now the connector goes parent-card-bottom → junction →
      // child-card-top, fully card-to-card.
      connections.push({
        type: 'parent-child',
        fromX: childCenterX,
        fromY: junctionY,
        toX: childCenterX,
        toY: topY + NODE_HEIGHT + GENERATION_GAP, // child card top
      });

      if (cw.childUnitId) {
        positionUnit(cw.childUnitId, childCenterX, topY + NODE_HEIGHT + GENERATION_GAP, generation + 1);
      } else {
        // Standalone child (no own family unit) — use child's own id (not in any
        // unit as a partner, so the bare id is unique here).
        nodes.push({
          id: `node-${cw.childId}`,
          x: childCenterX - NODE_WIDTH / 2,
          y: topY + NODE_HEIGHT + GENERATION_GAP,
          type: 'person',
          personId: cw.childId,
          generation: generation + 1,
        });
        maxX = Math.max(maxX, childCenterX + NODE_WIDTH / 2);
        maxY = Math.max(maxY, topY + NODE_HEIGHT + GENERATION_GAP + NODE_HEIGHT);
      }
      childCursorX += cw.width + SIBLING_GAP;
    }
  }

  for (const root of rootUnits) {
    const w = computeSubtreeWidth(root.id);
    const centerX = cursorX + w / 2;
    positionUnit(root.id, centerX, 0, 0);
    cursorX = cursorX + w + SIBLING_GAP * 2;
  }

  // Isolated persons (not in any unit at all)
  const inAnyUnit = new Set<string>();
  for (const u of familyUnits) {
    inAnyUnit.add(u.partner1Id);
    if (u.partner2Id) inAnyUnit.add(u.partner2Id);
    for (const c of u.childrenIds) inAnyUnit.add(c);
  }
  const isolated = Object.values(persons).filter((p) => !inAnyUnit.has(p.id));
  if (isolated.length > 0) {
    if (cursorX > 0) cursorX += SIBLING_GAP * 2;
    const isoY = maxY + GENERATION_GAP;
    for (const p of isolated) {
      nodes.push({
        id: `node-iso-${p.id}`,
        x: cursorX,
        y: isoY,
        type: 'person',
        personId: p.id,
        generation: 0,
      });
      cursorX += NODE_WIDTH + SIBLING_GAP;
    }
    maxX = Math.max(maxX, cursorX);
    maxY = Math.max(maxY, isoY + NODE_HEIGHT);
  }

  // NOTE: We no longer deduplicate nodes by personId. A person who is a partner
  // in more than one family unit (remarriage) now renders at BOTH positions on
  // the canvas, which is the standard genealogy visualization. The node IDs are
  // unique per-appearance (via the unitId), so React doesn't warn about dup keys.

  return {
    nodes,
    connections,
    width: Math.max(maxX, 0),
    height: Math.max(maxY, 0),
  };
}
