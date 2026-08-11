'use client';

// Family Tree — Relationship form
// Link two people as spouse (with marriage year) or parent→child.

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Heart, GitBranch } from 'lucide-react';
import type { FamilyUnit, Person } from '../types';

type RelType = 'spouse' | 'parent-child';

interface Props {
  persons: Person[];
  /** Optional anchor (e.g., when "Add relationship" is clicked from a person detail panel) */
  anchorPersonId?: string;
  onSubmit: (action: { type: 'spouse'; unit: FamilyUnit } | { type: 'parent-child'; parentId: string; childId: string }) => void | Promise<void>;
  onCancel: () => void;
  submitting?: boolean;
}

export function RelationshipForm({ persons, anchorPersonId, onSubmit, onCancel, submitting }: Props) {
  const [relType, setRelType] = useState<RelType>('spouse');
  const sortedPersons = useMemo(
    () => [...persons].sort((a, b) =>
      `${a.firstName} ${a.lastName ?? ''}`.localeCompare(`${b.firstName} ${b.lastName ?? ''}`),
    ),
    [persons],
  );

  // For spouse
  const [partner1, setPartner1] = useState(anchorPersonId ?? '');
  const [partner2, setPartner2] = useState('');
  const [marriageYear, setMarriageYear] = useState('');

  // For parent-child
  const [parentId, setParentId] = useState(anchorPersonId ?? '');
  const [childId, setChildId] = useState('');

  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (relType === 'spouse') {
      if (!partner1 || !partner2) {
        setError('Pick both partners');
        return;
      }
      if (partner1 === partner2) {
        setError('A person cannot be their own spouse');
        return;
      }
      const my = marriageYear.trim() ? Number(marriageYear) : undefined;
      if (my != null && (Number.isNaN(my) || my < 0 || my > 9999)) {
        setError('Marriage year must be a valid year');
        return;
      }
      await onSubmit({
        type: 'spouse',
        unit: {
          id: crypto.randomUUID(),
          partner1Id: partner1,
          partner2Id: partner2,
          childrenIds: [],
          marriageYear: my,
        },
      });
    } else {
      if (!parentId || !childId) {
        setError('Pick both parent and child');
        return;
      }
      if (parentId === childId) {
        setError('A person cannot be their own parent');
        return;
      }
      await onSubmit({ type: 'parent-child', parentId, childId });
    }
  };

  const personLabel = (p: Person) =>
    `${p.firstName} ${p.lastName ?? ''}`.trim() + (p.birthYear ? ` (${p.birthYear})` : '');

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Type selector */}
      <div>
        <Label className="mb-1.5 block">Relationship type</Label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setRelType('spouse')}
            className={`flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition ${
              relType === 'spouse'
                ? 'border-pink-300 bg-pink-50 text-pink-700 ring-1 ring-pink-300'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Heart className="h-4 w-4" /> Spouse
          </button>
          <button
            type="button"
            onClick={() => setRelType('parent-child')}
            className={`flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition ${
              relType === 'parent-child'
                ? 'border-purple-300 bg-purple-50 text-purple-700 ring-1 ring-purple-300'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <GitBranch className="h-4 w-4" /> Parent → Child
          </button>
        </div>
      </div>

      {relType === 'spouse' ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="p1">Partner 1</Label>
              <Select value={partner1} onValueChange={setPartner1}>
                <SelectTrigger id="p1">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {sortedPersons.map((p) => (
                    <SelectItem key={p.id} value={p.id} disabled={p.id === partner2}>
                      {personLabel(p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="p2">Partner 2</Label>
              <Select value={partner2} onValueChange={setPartner2}>
                <SelectTrigger id="p2">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {sortedPersons.map((p) => (
                    <SelectItem key={p.id} value={p.id} disabled={p.id === partner1}>
                      {personLabel(p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="marriageYear">Marriage year (optional)</Label>
            <Input
              id="marriageYear"
              type="number"
              value={marriageYear}
              onChange={(e) => setMarriageYear(e.target.value)}
              placeholder="1995"
              min={0}
              max={9999}
            />
          </div>
        </>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="parent">Parent</Label>
            <Select value={parentId} onValueChange={setParentId}>
              <SelectTrigger id="parent">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {sortedPersons.map((p) => (
                  <SelectItem key={p.id} value={p.id} disabled={p.id === childId}>
                    {personLabel(p)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="child">Child</Label>
            <Select value={childId} onValueChange={setChildId}>
              <SelectTrigger id="child">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {sortedPersons.map((p) => (
                  <SelectItem key={p.id} value={p.id} disabled={p.id === parentId}>
                    {personLabel(p)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Linking...' : 'Link'}
        </Button>
      </div>
    </form>
  );
}
