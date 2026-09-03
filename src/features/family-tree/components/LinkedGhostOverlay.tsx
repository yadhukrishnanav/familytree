'use client';

// Family Tree — Linked-family ghost overlay
// Renders a READ-ONLY, dimmed preview of a linked family's tree next to the
// active tree on the canvas. Positioned inside the pan/zoom container, to the
// right of the active tree, connected by a dashed "linked" line.
//
// Everything is pointer-events-none except the badge's switch button — the
// ghost is context, not an editing surface. To edit the other tree, switch
// to it (chips bar, badge button, or the family switcher).

import { NODE_HEIGHT, NODE_WIDTH } from '../layout';
import type { GhostTree } from '../useLinkedFamilies';
import { useI18n } from '../i18n';
import { TreePine, ArrowRightCircle } from 'lucide-react';

export interface GhostOrigin {
  x: number;
  y: number;
}

interface Props {
  ghost: GhostTree;
  origin: GhostOrigin;
  onSwitch: (familyId: string) => void;
}

export function LinkedGhostOverlay({ ghost, origin, onSwitch }: Props) {
  const { t } = useI18n();
  const { layout, persons, family } = ghost;
  const pad = 28; // breathing room inside the dashed frame

  return (
    <div
      className="absolute"
      style={{ left: origin.x, top: origin.y, width: layout.width + pad * 2, height: layout.height + pad * 2 }}
    >
      {/* Dashed frame + faint tint — signals "another tree lives here" */}
      <div
        className="absolute inset-0 rounded-3xl border-2 border-dashed border-indigo-300/70 bg-indigo-50/40"
        aria-hidden
      />

      {/* Ghost connections (self-contained SVG; unique gradient ids so they
          never clash with the main tree's defs) */}
      <svg
        className="pointer-events-none absolute left-0 top-0"
        width={layout.width + pad * 2}
        height={layout.height + pad * 2}
        aria-hidden
      >
        <defs>
          <linearGradient id="ghost-grad-marriage" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f9a8d4" />
            <stop offset="100%" stopColor="#fda4af" />
          </linearGradient>
          <linearGradient id="ghost-grad-parent" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#c7d2fe" />
            <stop offset="100%" stopColor="#a5b4fc" />
          </linearGradient>
        </defs>
        {layout.connections.map((c, i) => {
          if (c.type === 'marriage') {
            return (
              <line
                key={i}
                x1={c.fromX + pad}
                y1={c.fromY + pad}
                x2={c.toX + pad}
                y2={c.toY + pad}
                stroke="url(#ghost-grad-marriage)"
                strokeWidth={2.5}
                strokeDasharray="6 4"
                strokeLinecap="round"
              />
            );
          }
          if (c.type === 'junction') {
            return (
              <line
                key={i}
                x1={c.fromX + pad}
                y1={c.fromY + pad}
                x2={c.toX + pad}
                y2={c.toY + pad}
                stroke="#a5b4fc"
                strokeWidth={2}
                strokeLinecap="round"
              />
            );
          }
          const midY = (c.fromY + c.toY) / 2;
          return (
            <path
              key={i}
              d={`M ${c.fromX + pad} ${c.fromY + pad} C ${c.fromX + pad} ${midY + pad}, ${c.toX + pad} ${midY + pad}, ${c.toX + pad} ${c.toY + pad}`}
              fill="none"
              stroke="url(#ghost-grad-parent)"
              strokeWidth={2}
              strokeLinecap="round"
            />
          );
        })}
      </svg>

      {/* Ghost person mini-cards — same coordinates as a real layout, dimmed */}
      <div className="pointer-events-none absolute inset-0 opacity-70 select-none">
        {layout.nodes.map((node) => {
          if (!node.personId) return null;
          const p = persons[node.personId];
          if (!p) return null;
          const gradient = `linear-gradient(135deg, ${p.avatarColors[0]}, ${p.avatarColors[1]})`;
          return (
            <div
              key={`ghost-${node.id}`}
              className="absolute"
              style={{ left: node.x + pad, top: node.y + pad, width: NODE_WIDTH, height: NODE_HEIGHT }}
            >
              <div
                className="flex h-full w-full flex-col justify-center gap-1 overflow-hidden rounded-2xl border border-white/60 bg-white/90 px-3 shadow-sm backdrop-blur-sm"
                style={{ transform: 'scale(0.82)', transformOrigin: 'top left', width: NODE_WIDTH, height: NODE_HEIGHT }}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="h-6 w-6 shrink-0 rounded-full shadow-sm"
                    style={{ background: gradient }}
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <div className="truncate text-[12px] font-semibold text-slate-700">
                      {p.firstName} {p.lastName ?? ''}
                    </div>
                    {(p.birthYear != null || p.deathYear != null) && (
                      <div className="text-[10px] text-slate-400">
                        {p.birthYear ?? '?'} – {p.deathYear ?? 'present'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Badge + switch button — the only interactive part */}
      <div
        className="absolute -top-5 left-4 z-10 flex items-center gap-2 rounded-full border border-indigo-200 bg-white/95 py-1 pl-2 pr-1 shadow-md backdrop-blur"
        style={{ pointerEvents: 'auto' }}
      >
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-white">
          <TreePine className="h-3 w-3" />
        </div>
        <span className="max-w-[180px] truncate text-[11px] font-semibold text-slate-700">
          {family.name}
        </span>
        <span className="font-mono text-[10px] font-bold text-indigo-400">{family.shareCode}</span>
        <button
          onClick={() => onSwitch(family.familyId)}
          title={t('canvas.switchToTree')}
          className="flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-600 transition hover:bg-indigo-100"
        >
          {t('canvas.viewTree')}
          <ArrowRightCircle className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
