'use client';

// Family Tree — Search/Filter command palette
// Find persons by name, place, occupation. Click result to focus them.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Search, MapPin, Briefcase, User } from 'lucide-react';
import type { Person } from '../types';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  persons: Record<string, Person>;
  onSelectPerson: (id: string) => void;
}

interface SearchResult {
  person: Person;
  matchedField: 'name' | 'occupation' | 'birthPlace';
  matchedText: string;
}

export function SearchPalette({ open, onOpenChange, persons, onSelectPerson }: Props) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      // Defer state updates to avoid synchronous-in-effect warning
      Promise.resolve().then(() => {
        setQuery('');
        setTimeout(() => inputRef.current?.focus(), 50);
      });
    }
  }, [open]);

  const results = useMemo<SearchResult[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const out: SearchResult[] = [];
    for (const p of Object.values(persons)) {
      const fullName = `${p.firstName} ${p.lastName ?? ''}`.toLowerCase();
      if (fullName.includes(q)) {
        out.push({ person: p, matchedField: 'name', matchedText: `${p.firstName} ${p.lastName ?? ''}` });
        continue;
      }
      if (p.occupation && p.occupation.toLowerCase().includes(q)) {
        out.push({ person: p, matchedField: 'occupation', matchedText: p.occupation });
        continue;
      }
      if (p.birthPlace && p.birthPlace.toLowerCase().includes(q)) {
        out.push({ person: p, matchedField: 'birthPlace', matchedText: p.birthPlace });
        continue;
      }
    }
    return out.slice(0, 20);
  }, [query, persons]);

  const handleSelect = (id: string) => {
    onSelectPerson(id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0">
        <DialogTitle className="sr-only">Search family members</DialogTitle>
        <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2.5">
          <Search className="h-4 w-4 text-slate-400" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, place, or occupation…"
            className="border-0 px-0 shadow-none focus-visible:ring-0"
          />
          {/* Close uses the Dialog's built-in top-right ✕ — a second custom
              button here rendered two X icons side by side. */}
        </div>
        <div className="max-h-96 overflow-y-auto p-1">
          {query.trim() === '' ? (
            <div className="px-4 py-12 text-center">
              <p className="text-sm text-slate-500">Start typing to search your family.</p>
              <p className="mt-1 text-xs text-slate-400">Searches names, places, and occupations.</p>
            </div>
          ) : results.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <p className="text-sm text-slate-500">No matches for &ldquo;{query}&rdquo;</p>
            </div>
          ) : (
            <ul className="space-y-0.5">
              {results.map(({ person, matchedField, matchedText }) => {
                const Icon = matchedField === 'occupation' ? Briefcase : matchedField === 'birthPlace' ? MapPin : User;
                const label =
                  matchedField === 'occupation' ? 'Occupation' :
                  matchedField === 'birthPlace' ? 'Birthplace' : 'Name';
                return (
                  <li key={person.id}>
                    <button
                      onClick={() => handleSelect(person.id)}
                      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-slate-100"
                    >
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-bold text-white ring-2 ring-white"
                        style={{
                          background: `linear-gradient(135deg, ${person.avatarColors[0]}, ${person.avatarColors[1]})`,
                        }}
                      >
                        {person.photoUrl ? (
                           
                          <img src={person.photoUrl} alt="" className="h-full w-full object-cover" crossOrigin="anonymous" />
                        ) : (
                          (person.firstName[0] + (person.lastName?.[0] ?? '')).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-slate-800">
                          {person.firstName} {person.lastName ?? ''}
                        </div>
                        <div className="truncate text-xs text-slate-500">
                          {person.birthYear ?? '?'}{person.deathYear ? `–${person.deathYear}` : ''}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[10px] text-slate-600">
                        <Icon className="h-2.5 w-2.5" />
                        <span className="truncate max-w-[100px]">{matchedText}</span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="border-t border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] text-slate-400">
          {query.trim() !== '' && (
            <span>{results.length} {results.length === 1 ? 'result' : 'results'}</span>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
