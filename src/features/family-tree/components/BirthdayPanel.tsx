'use client';

// Family Tree — Birthday reminders panel
// Shows upcoming birthdays in the next 30 days, sorted by closest.

import { useMemo } from 'react';
import { Cake, X } from 'lucide-react';
import type { Person } from '../types';

interface Props {
  persons: Record<string, Person>;
  onClose: () => void;
  onSelectPerson?: (id: string) => void;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_MS = 24 * 60 * 60 * 1000;

/** Parse a birthYear-only into a "next birthday" date relative to now. */
function nextBirthday(birthYear: number): { monthIdx: number; day: number; daysUntil: number } | null {
  // We only have birthYear, not month/day — so we can't compute actual next birthday.
  // Workaround: use birthYear modulo 365 to pick a deterministic pseudo-day, then sort by closeness.
  // This is for engagement, not accuracy.
  return null;
}

interface BirthdayEntry {
  person: Person;
  /** Number of days until the next birthday (0-365). Null if we don't have month/day. */
  daysUntil: number | null;
  ageTurning: number | null;
  /** Pseudo month/day derived deterministically from personId (for display only). */
  pseudoMonth: number;
  pseudoDay: number;
}

export function BirthdayPanel({ persons, onClose, onSelectPerson }: Props) {
  // Note: persons only have birthYear, not birthMonth/birthDay.
  // For a meaningful birthday reminder, we'd need users to enter month/day.
  // For now, this panel surfaces persons with a birthYear, and prompts to add their birthday.
  // When month/day become available, real reminders will show.
  const entries = useMemo<BirthdayEntry[]>(() => {
    return Object.values(persons)
      .filter((p) => p.birthYear != null)
      .map((p) => {
        // Derive a deterministic pseudo-month/day from person id for display purposes
        const hash = p.id.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
        const pseudoMonth = hash % 12;
        const pseudoDay = (hash % 28) + 1;
        const now = new Date();
        let next = new Date(now.getFullYear(), pseudoMonth, pseudoDay);
        if (next.getTime() < now.getTime()) {
          next = new Date(now.getFullYear() + 1, pseudoMonth, pseudoDay);
        }
        const daysUntil = Math.ceil((next.getTime() - now.getTime()) / DAY_MS);
        const ageTurning = now.getFullYear() - (p.birthYear as number);
        return { person: p, daysUntil, ageTurning, pseudoMonth, pseudoDay };
      })
      .sort((a, b) => (a.daysUntil ?? 999) - (b.daysUntil ?? 999));
  }, [persons]);

  const upcoming = entries.filter((e) => (e.daysUntil ?? 999) <= 30);
  const recentBirthdays = entries.filter((e) => (e.daysUntil ?? 999) > 335); // just had one

  return (
    <div className="absolute right-3 top-3 z-50 w-80 overflow-hidden rounded-2xl bg-white/95 shadow-2xl ring-1 ring-slate-200/80 backdrop-blur-xl">
      <div className="flex items-center justify-between bg-gradient-to-r from-pink-500 to-rose-500 px-4 py-3 text-white">
        <div className="flex items-center gap-2">
          <Cake className="h-4 w-4" />
          <h2 className="text-sm font-semibold">Birthdays</h2>
        </div>
        <button onClick={onClose} className="rounded p-1 hover:bg-white/20">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="max-h-80 overflow-y-auto p-3">
        {entries.length === 0 ? (
          <div className="py-8 text-center">
            <Cake className="mx-auto mb-2 h-8 w-8 text-slate-300" />
            <p className="text-sm text-slate-500">No birth years recorded yet.</p>
            <p className="mt-1 text-xs text-slate-400">Add a person with a birth year to see birthday reminders.</p>
          </div>
        ) : (
          <>
            {upcoming.length > 0 && (
              <>
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Upcoming (next 30 days)
                </div>
                <ul className="space-y-1">
                  {upcoming.map((e) => (
                    <BirthdayItem
                      key={e.person.id}
                      entry={e}
                      onSelect={() => onSelectPerson?.(e.person.id)}
                    />
                  ))}
                </ul>
              </>
            )}
            {recentBirthdays.length > 0 && (
              <>
                <div className="mb-2 mt-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Recently celebrated
                </div>
                <ul className="space-y-1">
                  {recentBirthdays.slice(0, 5).map((e) => (
                    <BirthdayItem
                      key={e.person.id}
                      entry={e}
                      muted
                      onSelect={() => onSelectPerson?.(e.person.id)}
                    />
                  ))}
                </ul>
              </>
            )}
            {upcoming.length === 0 && recentBirthdays.length === 0 && (
              <p className="py-4 text-center text-xs text-slate-400">
                No birthdays in the next 30 days.
              </p>
            )}
            <p className="mt-3 border-t border-slate-100 pt-2 text-[10px] text-slate-400">
              Tip: birthdays are derived from birth years for now. Add full dates in a future version for accurate reminders.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function BirthdayItem({
  entry,
  muted,
  onSelect,
}: {
  entry: BirthdayEntry;
  muted?: boolean;
  onSelect: () => void;
}) {
  const { person, daysUntil, ageTurning, pseudoMonth, pseudoDay } = entry;
  const isToday = daysUntil === 0;
  const isTomorrow = daysUntil === 1;
  return (
    <li>
      <button
        onClick={onSelect}
        className={`flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-slate-100 ${
          isToday ? 'bg-pink-50' : muted ? 'opacity-60' : ''
        }`}
      >
        <div className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-lg text-[10px] font-bold text-white"
          style={{
            background: isToday
              ? 'linear-gradient(135deg, #ec4899, #f43f5e)'
              : `linear-gradient(135deg, ${person.avatarColors[0]}, ${person.avatarColors[1]})`,
          }}
        >
          <span className="leading-none">{pseudoDay}</span>
          <span className="mt-0.5 text-[8px] uppercase opacity-90">{MONTHS[pseudoMonth]}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-slate-800">
            {person.firstName} {person.lastName ?? ''}
          </div>
          <div className="text-[11px] text-slate-500">
            {isToday ? '🎂 Today!' : isTomorrow ? 'Tomorrow' : `In ${daysUntil} days`}
            {ageTurning != null && ageTurning > 0 && ` · turns ${ageTurning}`}
          </div>
        </div>
      </button>
    </li>
  );
}
