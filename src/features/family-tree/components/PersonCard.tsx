'use client';

// Family Tree — Person node card

import type { Person } from '../types';
import { NODE_HEIGHT, NODE_WIDTH } from '../layout';
import { Camera, Heart, MapPin } from 'lucide-react';

interface Props {
  person: Person;
  x: number;
  y: number;
  selected?: boolean;
  onClick?: () => void;
}

function initials(p: Person): string {
  const f = p.firstName?.[0] ?? '';
  const l = p.lastName?.[0] ?? '';
  return (f + l).toUpperCase() || '?';
}

export function PersonCard({ person, x, y, selected, onClick }: Props) {
  const gradient = `linear-gradient(135deg, ${person.avatarColors[0]}, ${person.avatarColors[1]})`;
  const lifespan =
    person.birthYear != null || person.deathYear != null
      ? `${person.birthYear ?? ''}–${person.deathYear ?? ''}`
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
      className="absolute cursor-pointer rounded-xl bg-white shadow-lg ring-1 transition-all hover:shadow-2xl hover:ring-2 focus:outline-none focus:ring-2 focus:ring-purple-400"
      style={{
        left: x,
        top: y,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        boxShadow: selected ? '0 0 0 3px #8b5cf6, 0 8px 24px rgba(139, 92, 246, 0.3)' : undefined,
        zIndex: selected ? 30 : 10,
      }}
    >
      <div className="flex h-full items-stretch">
        {/* Photo / Avatar */}
        <div
          className="flex w-16 shrink-0 items-center justify-center overflow-hidden rounded-l-xl"
          style={{ background: gradient }}
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
            <span className="text-2xl font-bold text-white drop-shadow">
              {initials(person)}
            </span>
          )}
        </div>

        {/* Info */}
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 px-3 py-2">
          <div className="truncate text-sm font-semibold text-slate-800">
            {person.firstName} {person.lastName ?? ''}
          </div>
          {lifespan && (
            <div className="text-[10px] font-medium text-slate-500">{lifespan}</div>
          )}
          {person.occupation && (
            <div className="flex items-center gap-1 truncate text-[10px] text-slate-500">
              <span className="truncate">{person.occupation}</span>
            </div>
          )}
          {person.birthPlace && (
            <div className="flex items-center gap-0.5 truncate text-[9px] text-slate-400">
              <MapPin className="h-2.5 w-2.5 shrink-0" />
              <span className="truncate">{person.birthPlace}</span>
            </div>
          )}
        </div>

        {/* Gender stripe */}
        <div
          className="w-1.5 shrink-0 rounded-r-xl"
          style={{
            background:
              person.gender === 'female'
                ? '#ec4899'
                : person.gender === 'male'
                  ? '#3b82f6'
                  : '#a855f7',
          }}
        />
      </div>

      {/* Floating icons for photo / marriage (decorative) */}
      {!person.photoUrl && (
        <div className="pointer-events-none absolute -right-1 -top-1 rounded-full bg-white p-1 shadow ring-1 ring-slate-200">
          <Camera className="h-2.5 w-2.5 text-slate-400" />
        </div>
      )}
      {person.deathYear != null && (
        <div className="pointer-events-none absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-slate-600 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wider text-white shadow">
          In memoriam
        </div>
      )}
    </div>
  );
}

export function MarriageBadge({ x, y, year }: { x: number; y: number; year?: number }) {
  return (
    <div
      className="pointer-events-none absolute flex items-center justify-center rounded-full bg-white shadow-md ring-1 ring-pink-200"
      style={{ left: x - 14, top: y - 14, width: 28, height: 28, zIndex: 20 }}
      title={year ? `Married ${year}` : 'Married'}
    >
      <Heart className="h-3.5 w-3.5 fill-pink-500 text-pink-500" />
      {year != null && (
        <span className="absolute -bottom-4 text-[9px] font-semibold text-pink-600">
          {year}
        </span>
      )}
    </div>
  );
}
