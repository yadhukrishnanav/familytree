'use client';

// Family Tree — Relationship form
// Link two people as spouse (with marriage year) or parent→child.
// Validates: marriage year ≤ death year of both spouses,
//            marriage year ≤ birth year of any existing child of this couple (when adding child).

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
import { Heart, GitBranch, AlertCircle } from 'lucide-react';
import type { FamilyUnit, Person } from '../types';

type RelType = 'spouse' | 'parent-child';

interface Props {
  persons: Person[];
  familyUnits: FamilyUnit[];
  /** Optional anchor (e.g., when "Add relationship" is clicked from a person detail panel) */
  anchorPersonId?: string;
  onSubmit: (action: { type: 'spouse'; unit: FamilyUnit } | { type: 'parent-child'; parentId: string; childId: string }) => void | Promise<void>;
  onCancel: () => void;
  submitting?: boolean;
}

export function RelationshipForm({ persons, familyUnits, anchorPersonId, onSubmit, onCancel, submitting }: Props) {
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

  // ---- Validation helpers ----
  function validateSpouse(
    p1Id: string,
    p2Id: string,
    mYear: number | undefined,
  ): string | null {
    const p1 = persons.find((p) => p.id === p1Id);
    const p2 = persons.find((p) => p.id === p2Id);
    if (!p1 || !p2) return null;
    if (mYear == null) return null;

    // Marriage year must not be after either spouse's death year
    if (p1.deathYear != null && mYear > p1.deathYear) {
      return `${p1.firstName} ${p1.lastName ?? ''} passed away in ${p1.deathYear} — marriage year ${mYear} is later.`;
    }
    if (p2.deathYear != null && mYear > p2.deathYear) {
      return `${p2.firstName} ${p2.lastName ?? ''} passed away in ${p2.deathYear} — marriage year ${mYear} is later.`;
    }
    // Sanity: marriage year should be at least 14 years after each spouse's birth
    if (p1.birthYear != null && mYear < p1.birthYear + 14) {
      return `${p1.firstName} ${p1.lastName ?? ''} would be only ${mYear - p1.birthYear} years old at marriage (must be ≥ 14).`;
    }
    if (p2.birthYear != null && mYear < p2.birthYear + 14) {
      return `${p2.firstName} ${p2.lastName ?? ''} would be only ${mYear - p2.birthYear} years old at marriage (must be ≥ 14).`;
    }
    return null;
  }

  function validateChild(
    parentPersonId: string,
    childPersonId: string,
  ): string | null {
    const parent = persons.find((p) => p.id === parentPersonId);
    const child = persons.find((p) => p.id === childPersonId);
    if (!parent || !child) return null;

    // Find the parent's family unit (where they're a partner) — that's the marriage we care about
    const parentUnit = familyUnits.find(
      (u) => u.partner1Id === parentPersonId || u.partner2Id === parentPersonId,
    );

    if (parentUnit?.marriageYear != null && child.birthYear != null) {
      if (child.birthYear < parentUnit.marriageYear) {
        return `Child was born in ${child.birthYear}, but the parents married in ${parentUnit.marriageYear}. Marriage year must be on or before child's birth year.`;
      }
    }

    // Sanity: parent should be at least 12 years older than child
    if (parent.birthYear != null && child.birthYear != null) {
      const ageAtBirth = child.birthYear - parent.birthYear;
      if (ageAtBirth < 12) {
        return `${parent.firstName} would be only ${ageAtBirth} years old when ${child.firstName} was born (must be ≥ 12).`;
      }
      if (ageAtBirth > 90) {
        return `${parent.firstName} would be ${ageAtBirth} years old when ${child.firstName} was born — that seems unlikely.`;
      }
    }

    // If parent is deceased before child's birth, that's contradictory
    if (parent.deathYear != null && child.birthYear != null && child.birthYear > parent.deathYear) {
      return `${parent.firstName} passed away in ${parent.deathYear}, before ${child.firstName} was born in ${child.birthYear}.`;
    }
    return null;
  }

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
      const err = validateSpouse(partner1, partner2, my);
      if (err) {
        setError(err);
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
      const err = validateChild(parentId, childId);
      if (err) {
        setError(err);
        return;
      }
      await onSubmit({ type: 'parent-child', parentId, childId });
    }
  };

  const personLabel = (p: Person) =>
    `${p.firstName} ${p.lastName ?? ''}`.trim() + (p.birthYear ? ` (${p.birthYear})` : '');

  // Live validation hints (shown as warnings, not blockers)
  const spouseHint = relType === 'spouse' && partner1 && partner2 && marriageYear.trim()
    ? validateSpouse(partner1, partner2, Number(marriageYear))
    : null;
  const childHint = relType === 'parent-child' && parentId && childId
    ? validateChild(parentId, childId)
    : null;

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
            <p className="mt-1 text-xs text-slate-500">
              Validated against each partner&apos;s birth &amp; death years.
            </p>
          </div>
          {spouseHint && (
            <div className="flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{spouseHint}</span>
            </div>
          )}
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
      {childHint && (
        <div className="flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{childHint}</span>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
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
