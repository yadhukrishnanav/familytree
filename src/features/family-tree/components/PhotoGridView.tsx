'use client';

// Family Tree — Photo grid view
// Alternative to the tree: masonry grid of all family photos with names.

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { LayoutGrid, Filter, User } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Person } from '../types';

interface Props {
  persons: Record<string, Person>;
  onSelectPerson?: (id: string) => void;
}

export function PhotoGridView({ persons, onSelectPerson }: Props) {
  const [filter, setFilter] = useState<'all' | 'photos' | 'no-photos' | 'living' | 'deceased'>('all');

  const sorted = useMemo(() => {
    const arr = Object.values(persons);
    const filtered = arr.filter((p) => {
      switch (filter) {
        case 'photos': return !!p.photoUrl;
        case 'no-photos': return !p.photoUrl;
        case 'living': return p.deathYear == null;
        case 'deceased': return p.deathYear != null;
        default: return true;
      }
    });
    // Sort: has photo first, then alphabetical
    return filtered.sort((a, b) => {
      const aPhoto = a.photoUrl ? 0 : 1;
      const bPhoto = b.photoUrl ? 0 : 1;
      if (aPhoto !== bPhoto) return aPhoto - bPhoto;
      return `${a.firstName} ${a.lastName ?? ''}`.localeCompare(`${b.firstName} ${b.lastName ?? ''}`);
    });
  }, [persons, filter]);

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b border-slate-200/80 bg-white/80 px-4 py-2 backdrop-blur-md">
        <LayoutGrid className="h-4 w-4 text-purple-500" />
        <span className="text-sm font-semibold text-slate-700">Photo grid</span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
          {sorted.length} {sorted.length === 1 ? 'person' : 'people'}
        </span>
        <div className="flex-1" />
        <Filter className="h-3.5 w-3.5 text-slate-400" />
        <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <SelectTrigger className="h-8 w-40 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="photos">With photos</SelectItem>
            <SelectItem value="no-photos">No photos</SelectItem>
            <SelectItem value="living">Living</SelectItem>
            <SelectItem value="deceased">In memoriam</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto bg-slate-50 p-4">
        {sorted.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <User className="mb-2 h-12 w-12 text-slate-300" />
            <p className="text-sm font-medium text-slate-500">No people to show</p>
            <p className="mt-1 text-xs text-slate-400">Try adjusting the filter.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {sorted.map((p) => {
              const gradient = `linear-gradient(135deg, ${p.avatarColors[0]}, ${p.avatarColors[1]})`;
              const isDeceased = p.deathYear != null;
              return (
                <button
                  key={p.id}
                  onClick={() => onSelectPerson?.(p.id)}
                  className="group relative overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-lg"
                >
                  {/* Photo or gradient avatar */}
                  <div
                    className="aspect-square w-full"
                    style={{
                      background: p.photoUrl ? undefined : gradient,
                      filter: isDeceased && !p.photoUrl ? 'grayscale(0.35)' : 'none',
                    }}
                  >
                    {p.photoUrl ? (
                       
                      <img
                        src={p.photoUrl}
                        alt={p.firstName}
                        className="h-full w-full object-cover transition group-hover:scale-105"
                        crossOrigin="anonymous"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = 'none';
                        }}
                        style={{ filter: isDeceased ? 'grayscale(0.35)' : 'none' }}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <span className="text-3xl font-bold text-white drop-shadow">
                          {(p.firstName[0] + (p.lastName?.[0] ?? '')).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Deceased badge */}
                  {isDeceased && (
                    <div className="absolute right-1.5 top-1.5 rounded-full bg-slate-700/80 px-1.5 py-0.5 text-[9px] font-semibold text-white backdrop-blur-sm">
                      ✦
                    </div>
                  )}

                  {/* Name strip */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-left">
                    <div className="truncate text-xs font-semibold text-white">
                      {p.firstName} {p.lastName ?? ''}
                    </div>
                    <div className="truncate text-[10px] text-white/80">
                      {p.birthYear ?? '?'}{p.deathYear ? `–${p.deathYear}` : ''}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
