'use client';

// Family Tree — Linked-families chips bar
// Floating row of pills at the top of the canvas: one per linked family,
// click to switch to it. Ends with a "+" chip that opens the federation
// panel (link / unlink management). Hidden when there are no links.

import { TreePine, Plus, Link2Off, Loader2 } from 'lucide-react';
import type { LinkedFamilyInfo } from '../linkedFamilies';
import { useI18n } from '../i18n';

interface Props {
  links: LinkedFamilyInfo[];
  loading: boolean;
  onSwitch: (familyId: string) => void;
  onManage: () => void;
}

export function LinkedFamiliesBar({ links, loading, onSwitch, onManage }: Props) {
  const { t } = useI18n();
  if (loading && links.length === 0) {
    return (
      <div className="pointer-events-none absolute left-1/2 top-2 z-20 -translate-x-1/2">
        <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/90 px-3 py-1 shadow-sm backdrop-blur">
          <Loader2 className="h-3 w-3 animate-spin text-indigo-400" />
          <span className="text-[11px] text-slate-400">{t('canvas.linkedFamilies')}…</span>
        </div>
      </div>
    );
  }
  if (links.length === 0) return null;

  return (
    <div className="absolute left-1/2 top-2 z-20 flex max-w-[calc(100%-6rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-1.5">
      <span className="hidden items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 sm:flex">
        <Link2Off className="h-3 w-3" />
        {t('canvas.linkedFamilies')}
      </span>
      {links.map((l) => (
        <button
          key={l.linkId}
          onClick={() => onSwitch(l.familyId)}
          title={t('canvas.switchToTree') + ` — ${l.name}`}
          className="flex items-center gap-1.5 rounded-full border border-indigo-200 bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 shadow-sm backdrop-blur transition hover:border-indigo-300 hover:bg-indigo-50"
        >
          <TreePine className="h-3 w-3 text-indigo-500" />
          <span className="max-w-[140px] truncate">{l.name}</span>
        </button>
      ))}
      <button
        onClick={onManage}
        title={t('toolbar.linkedFamilies')}
        className="flex items-center gap-1 rounded-full border border-dashed border-slate-300 bg-white/90 px-2 py-1 text-[11px] font-semibold text-slate-500 shadow-sm backdrop-blur transition hover:border-slate-400 hover:text-slate-700"
      >
        <Plus className="h-3 w-3" />
      </button>
    </div>
  );
}
