'use client';

// Family Tree — Person detail panel
// Slide-in panel showing a selected person's details: avatar, lifespan,
// occupation, birthplace, spouse, parents, children. Includes action
// buttons: Edit, Edit history, Delete.

import { X, Heart, Pencil, History, Trash2, Briefcase, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { FamilyTreeState, Person } from '../types';
import { BRAND } from '../constants';

interface Props {
  person: Person;
  state: FamilyTreeState;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onShowHistory: () => void;
}

export function DetailPanel({ person, state, onClose, onEdit, onDelete, onShowHistory }: Props) {
  const related = state.familyUnits.filter(
    (u) => u.partner1Id === person.id || u.partner2Id === person.id || u.childrenIds.includes(person.id),
  );
  const parents = state.familyUnits.find((u) => u.childrenIds.includes(person.id));
  const spouse = related.find((u) => u.partner1Id === person.id || u.partner2Id === person.id);
  const spouseId = spouse?.partner1Id === person.id ? spouse?.partner2Id : spouse?.partner1Id;
  const children = related.flatMap((u) =>
    (u.partner1Id === person.id || u.partner2Id === person.id) ? u.childrenIds : [],
  );
  const parentsList = parents ? [parents.partner1Id, parents.partner2Id].filter(Boolean) as string[] : [];

  const isDeceased = person.deathYear != null;

  return (
    <div className="ft-slide-panel ft-slide-panel--narrow">
      {/* Gradient header strip — uses person's avatar colors */}
      <div
        className="h-1.5"
        style={{ background: `linear-gradient(to right, ${person.avatarColors[0]}, ${person.avatarColors[1]})` }}
      />

      <div className="p-4">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div
              className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl shadow-md ring-2 ring-white"
              style={{ background: `linear-gradient(135deg, ${person.avatarColors[0]}, ${person.avatarColors[1]})` }}
            >
              {person.photoUrl ? (
                <img src={person.photoUrl} alt={person.firstName} className="h-full w-full object-cover" crossOrigin="anonymous" />
              ) : (
                <span className="text-xl font-bold text-white drop-shadow-sm">
                  {(person.firstName[0] + (person.lastName?.[0] ?? '')).toUpperCase()}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <div className="truncate text-base font-semibold text-slate-800">
                {person.firstName} {person.lastName ?? ''}
              </div>
              <div className={`ft-lifespan-pill mt-0.5 ${isDeceased ? 'ft-lifespan-pill--deceased' : ''}`}>
                {person.birthYear ?? '?'} – {person.deathYear ?? 'present'}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        <dl className="space-y-1.5 rounded-lg bg-slate-50/80 p-3 text-sm">
          {person.occupation && (
            <div className="flex justify-between gap-2">
              <dt className="flex items-center gap-1 text-slate-400"><Briefcase className="h-3 w-3" /> Occupation</dt>
              <dd className="text-right font-medium text-slate-700">{person.occupation}</dd>
            </div>
          )}
          {person.birthPlace && (
            <div className="flex justify-between gap-2">
              <dt className="flex items-center gap-1 text-slate-400"><MapPin className="h-3 w-3" /> Born in</dt>
              <dd className="text-right font-medium text-slate-700">{person.birthPlace}</dd>
            </div>
          )}
          {spouseId && state.persons[spouseId] && (
            <div className="flex justify-between gap-2">
              <dt className="flex items-center gap-1 text-slate-400">
                <Heart className="h-3 w-3" /> Spouse
              </dt>
              <dd className="text-right font-medium text-slate-700">
                {state.persons[spouseId].firstName} {state.persons[spouseId].lastName ?? ''}
              </dd>
            </div>
          )}
          {parentsList.length > 0 && (
            <div className="flex justify-between gap-2">
              <dt className="text-slate-400">Parents</dt>
              <dd className="text-right font-medium text-slate-700">
                {parentsList.map((pid) => state.persons[pid]).filter(Boolean).map((p) => `${p.firstName} ${p.lastName ?? ''}`).join(', ')}
              </dd>
            </div>
          )}
          {children.length > 0 && (
            <div className="flex justify-between gap-2">
              <dt className="text-slate-400">Children ({children.length})</dt>
              <dd className="text-right font-medium text-slate-700">
                {children.map((pid) => state.persons[pid]).filter(Boolean).map((p) => `${p.firstName} ${p.lastName ?? ''}`).join(', ')}
              </dd>
            </div>
          )}
        </dl>

        <div className="mt-3 flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onEdit}
            className="flex-1 rounded-lg border-slate-300 hover:bg-slate-50"
          >
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            Edit
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onShowHistory}
            title="Edit history"
            className="rounded-lg border-slate-300 hover:bg-slate-50"
          >
            <History className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onDelete}
            className="rounded-lg border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
