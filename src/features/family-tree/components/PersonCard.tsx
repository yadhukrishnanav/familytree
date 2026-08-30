'use client';

// Family Tree — Person node card (redesigned)
// Larger, glassmorphic card with circular avatar, ring, gradient border,
// refined selected/hover states, and elegant deceased indicator.

import type { Person } from '../types';
import { NODE_HEIGHT, NODE_WIDTH } from '../layout';
import { MapPin, Briefcase } from 'lucide-react';

interface Props {
  person: Person;
  x: number;
  y: number;
  selected?: boolean;
  generation?: number;
  onClick?: () => void;
}

function initials(p: Person): string {
  const f = p.firstName?.[0] ?? '';
  const l = p.lastName?.[0] ?? '';
  return (f + l).toUpperCase() || '?';
}

export function PersonCard({ person, x, y, selected, generation, onClick }: Props) {
  const gradient = `linear-gradient(135deg, ${person.avatarColors[0]}, ${person.avatarColors[1]})`;
  const isDeceased = person.deathYear != null;
  const lifespan =
    person.birthYear != null || person.deathYear != null
      ? `${person.birthYear ?? ''} – ${person.deathYear ?? 'present'}`
      : '';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
      className="group absolute cursor-pointer rounded-2xl transition-all duration-200"
      style={{
        left: x,
        top: y,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        zIndex: selected ? 30 : 10,
      }}
    >
      {/* Outer glow ring on selected */}
      {selected && (
        <div
          className="absolute -inset-1 rounded-2xl opacity-60 blur-md transition-opacity"
          style={{ background: gradient }}
          aria-hidden
        />
      )}

      {/* Card body */}
      <div
        className="relative h-full w-full overflow-hidden rounded-2xl bg-white/95 backdrop-blur-md transition-all duration-200"
        style={{
          boxShadow: selected
            ? '0 0 0 2px ' + person.avatarColors[0] + ', 0 12px 28px -6px rgba(15, 23, 42, 0.25)'
            : '0 1px 2px rgba(15, 23, 42, 0.06), 0 4px 12px -2px rgba(15, 23, 42, 0.08)',
          border: '1px solid rgba(226, 232, 240, 0.8)',
        }}
      >
        {/* Hover lift overlay */}
        <div
          className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.4), rgba(255,255,255,0))',
            mixBlendMode: 'overlay',
          }}
        />

        {/* Card content */}
        <div className="flex h-full items-center gap-3 px-3 pt-2">
          {/* Avatar */}
          <div className="relative shrink-0">
            <div
              className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full ring-2 ring-white"
              style={{
                background: gradient,
                boxShadow: '0 2px 8px rgba(15, 23, 42, 0.12)',
                filter: isDeceased ? 'grayscale(0.35)' : 'none',
              }}
            >
              {person.photoUrl ? (
                 
                <img
                  src={person.photoUrl}
                  alt={person.firstName}
                  className="h-full w-full object-cover"
                  crossOrigin="anonymous"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <span className="text-lg font-bold text-white drop-shadow-sm">
                  {initials(person)}
                </span>
              )}
            </div>
            {/* Gender dot at bottom-right of avatar */}
            <div
              className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-white"
              style={{
                background:
                  person.gender === 'female'
                    ? '#ec4899'
                    : person.gender === 'male'
                      ? '#3b82f6'
                      : '#a855f7',
              }}
              title={person.gender}
            />
          </div>

          {/* Info column */}
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
            <div className="flex items-center gap-1">
              <span className="truncate text-[15px] font-semibold leading-tight text-slate-800">
                {person.firstName}
              </span>
              {person.lastName && (
                <span className="truncate text-[13px] font-medium leading-tight text-slate-500">
                  {person.lastName}
                </span>
              )}
            </div>
            {lifespan && (
              <div
                className="inline-flex w-fit items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                style={{
                  // Always slate — no emerald accent on living persons (per user request).
                  // Deceased uses slightly darker slate for distinction.
                  background: isDeceased ? 'rgba(100, 116, 139, 0.14)' : 'rgba(148, 163, 184, 0.18)',
                  color: isDeceased ? '#475569' : '#64748b',
                }}
              >
                {lifespan}
              </div>
            )}
            {person.occupation && (
              <div className="flex items-center gap-1 truncate text-[11px] text-slate-600">
                <Briefcase className="h-2.5 w-2.5 shrink-0 text-slate-400" />
                <span className="truncate">{person.occupation}</span>
              </div>
            )}
            {person.birthPlace && (
              <div className="flex items-center gap-1 truncate text-[10px] text-slate-400">
                <MapPin className="h-2.5 w-2.5 shrink-0" />
                <span className="truncate">{person.birthPlace}</span>
              </div>
            )}
          </div>
        </div>

        {/* Deceased ribbon at bottom */}
        {isDeceased && (
          <div
            className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-1 py-0.5 text-[9px] font-medium uppercase tracking-wider text-slate-500"
            style={{
              background: 'linear-gradient(to right, transparent, rgba(100, 116, 139, 0.08), transparent)',
            }}
          >
            <span className="opacity-70">✦</span> In memoriam <span className="opacity-70">✦</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function MarriageBadge({ x, y, year }: { x: number; y: number; year?: number }) {
  return (
    <div
      className="pointer-events-none absolute flex flex-col items-center"
      style={{ left: x - 16, top: y - 16, width: 32, zIndex: 20 }}
    >
      <div
        className="flex h-7 w-7 items-center justify-center rounded-full shadow-md ring-2 ring-white"
        style={{
          background: 'linear-gradient(135deg, #ec4899, #f43f5e)',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
          <path d="M12 21s-7-4.35-9.5-8.5C.5 9 2 5 5.5 5c2 0 3.5 1.5 4.5 3 1-1.5 2.5-3 4.5-3C18 5 19.5 9 17.5 12.5 15 16.65 12 21 12 21z" />
        </svg>
      </div>
      {year != null && (
        <span
          className="mt-1 rounded-full bg-white/95 px-1.5 py-0.5 text-[9px] font-bold text-pink-600 shadow-sm ring-1 ring-pink-200"
        >
          {year}
        </span>
      )}
    </div>
  );
}
