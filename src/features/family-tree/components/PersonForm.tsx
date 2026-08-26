'use client';

// Family Tree — Add/Edit person form with photo upload (Supabase Storage when configured,
// data URL fallback in demo mode)

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Upload, X, User, Heart, GitBranch } from 'lucide-react';
import type { Gender, Person } from '../types';
import { MALE_PALETTES, FEMALE_PALETTES, pickAvatarColors } from '../data';
import { uploadPhoto, fileToDataUrl, deletePhoto } from '../supabase';

// Relationship that should be created after the person is added.
// `targetPersonId` is the ID of an existing person; the new person will be linked
// as their spouse or child (or parent, if `asParent` is true).
export type NewRelation =
  | { kind: 'spouse'; targetPersonId: string; marriageYear?: number }
  | { kind: 'child'; targetPersonId: string }    // new person is CHILD of targetPersonId
  | { kind: 'parent'; targetPersonId: string };  // new person is PARENT of targetPersonId

interface Props {
  initial?: Person;
  familyId: string;
  /** Other persons already in the tree. Used to populate the relationship picker when adding a new person. */
  existingPersons?: Person[];
  /** Called with the new person + optional relationship when the form is submitted. */
  onSubmit: (person: Person, photoChanged: boolean, oldPhotoUrl?: string, relation?: NewRelation) => void | Promise<void>;
  onCancel: () => void;
  submitting?: boolean;
}

export function PersonForm({ initial, familyId, existingPersons, onSubmit, onCancel, submitting }: Props) {
  const [firstName, setFirstName] = useState(initial?.firstName ?? '');
  const [lastName, setLastName] = useState(initial?.lastName ?? '');
  const [birthYear, setBirthYear] = useState<string>(
    initial?.birthYear != null ? String(initial.birthYear) : '',
  );
  const [deathYear, setDeathYear] = useState<string>(
    initial?.deathYear != null ? String(initial.deathYear) : '',
  );
  const [gender, setGender] = useState<Gender>(initial?.gender ?? 'male');
  const [occupation, setOccupation] = useState(initial?.occupation ?? '');
  const [birthPlace, setBirthPlace] = useState(initial?.birthPlace ?? '');
  const [paletteIdx, setPaletteIdx] = useState<number>(() => {
    if (!initial) return Math.floor(Math.random() * 8);
    const palettes = initial.gender === 'female' ? FEMALE_PALETTES : MALE_PALETTES;
    const idx = palettes.findIndex(
      ([a, b]) => a === initial.avatarColors[0] && b === initial.avatarColors[1],
    );
    return idx >= 0 ? idx : 0;
  });
  const [photoPreview, setPhotoPreview] = useState<string | undefined>(initial?.photoUrl);
  const [photoDirty, setPhotoDirty] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Relationship selection (only shown when adding a new person, not editing)
  // kind: 'none' | 'spouse' | 'child' | 'parent'
  const [relationKind, setRelationKind] = useState<'none' | 'spouse' | 'child' | 'parent'>('none');
  const [relationTargetId, setRelationTargetId] = useState('');
  const [relationMarriageYear, setRelationMarriageYear] = useState('');

  const isAddingNew = !initial;
  const showRelationSection = isAddingNew && (existingPersons?.length ?? 0) > 0;
  const sortedExisting = [...(existingPersons ?? [])].sort((a, b) =>
    `${a.firstName} ${a.lastName ?? ''}`.localeCompare(`${b.firstName} ${b.lastName ?? ''}`),
  );

  // Sync palette when gender changes
  useEffect(() => {
    setPaletteIdx((idx) => idx % 8);
  }, [gender]);

  const handlePhotoChange = async (file: File | null) => {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      setError('Photo must be under 8 MB');
      return;
    }
    setUploadingPhoto(true);
    setError(null);
    try {
      // In demo mode, uploadPhoto returns a data URL
      // In Supabase mode, it uploads and returns the public URL
      const url = await uploadPhoto(file, familyId, 'person');
      setPhotoPreview(url);
      setPhotoDirty(true);
    } catch (e: any) {
      setError(e.message ?? 'Photo upload failed');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = async () => {
    if (initial?.photoUrl && photoDirty && initial.photoUrl.startsWith('http')) {
      // Best-effort delete from Supabase storage (replacing it)
      try {
        await deletePhoto(initial.photoUrl);
      } catch {
        /* ignore */
      }
    }
    setPhotoPreview(undefined);
    setPhotoDirty(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!firstName.trim()) {
      setError('First name is required');
      return;
    }
    const by = birthYear.trim() ? Number(birthYear) : undefined;
    const dy = deathYear.trim() ? Number(deathYear) : undefined;
    if (by != null && (Number.isNaN(by) || by < 0 || by > 9999)) {
      setError('Birth year must be a valid year');
      return;
    }
    if (dy != null && (Number.isNaN(dy) || dy < 0 || dy > 9999)) {
      setError('Death year must be a valid year');
      return;
    }
    if (by != null && dy != null && dy < by) {
      setError('Death year cannot be before birth year');
      return;
    }
    const person: Person = {
      id: initial?.id ?? crypto.randomUUID(),
      firstName: firstName.trim(),
      lastName: lastName.trim() || undefined,
      birthYear: by,
      deathYear: dy,
      gender,
      avatarColors: pickAvatarColors(gender, paletteIdx),
      occupation: occupation.trim() || undefined,
      birthPlace: birthPlace.trim() || undefined,
      photoUrl: photoPreview,
    };

    // Validate + build the relation if user picked one
    let relation: NewRelation | undefined;
    if (relationKind !== 'none' && relationTargetId) {
      if (relationKind === 'spouse') {
        let my: number | undefined;
        if (relationMarriageYear.trim()) {
          my = Number(relationMarriageYear);
          if (Number.isNaN(my) || my < 0 || my > 9999) {
            setError('Marriage year must be a valid year');
            return;
          }
          // Sanity: marriage year shouldn't be after a deceased new person's death year
          if (dy != null && my > dy) {
            setError(`${firstName.trim()} passed away in ${dy} — marriage year ${my} is later.`);
            return;
          }
          // Sanity: marriage year shouldn't be after the target spouse's death year
          const target = existingPersons?.find((p) => p.id === relationTargetId);
          if (target?.deathYear != null && my > target.deathYear) {
            setError(`${target.firstName} ${target.lastName ?? ''} passed away in ${target.deathYear} — marriage year ${my} is later.`);
            return;
          }
        }
        relation = { kind: 'spouse', targetPersonId: relationTargetId, marriageYear: my };
      } else if (relationKind === 'child') {
        // New person is CHILD of targetPersonId
        // Sanity: parent shouldn't be younger than child by <12 yrs
        const target = existingPersons?.find((p) => p.id === relationTargetId);
        if (target?.birthYear != null && by != null && by < target.birthYear + 12) {
          setError(`${target.firstName} would be only ${by - target.birthYear} years old when ${firstName.trim()} was born (must be ≥ 12).`);
          return;
        }
        // Sanity: parent shouldn't be deceased before child's birth
        if (target?.deathYear != null && by != null && by > target.deathYear) {
          setError(`${target.firstName} passed away in ${target.deathYear}, before ${firstName.trim()} was born in ${by}.`);
          return;
        }
        relation = { kind: 'child', targetPersonId: relationTargetId };
      } else if (relationKind === 'parent') {
        // New person is PARENT of targetPersonId
        const target = existingPersons?.find((p) => p.id === relationTargetId);
        if (by != null && target?.birthYear != null && target.birthYear < by + 12) {
          setError(`${firstName.trim()} would be only ${target.birthYear - by} years old when ${target.firstName} was born (must be ≥ 12).`);
          return;
        }
        if (dy != null && target?.birthYear != null && dy < target.birthYear) {
          setError(`${firstName.trim()} passed away in ${dy}, before ${target.firstName} was born in ${target.birthYear}.`);
          return;
        }
        relation = { kind: 'parent', targetPersonId: relationTargetId };
      }
    }

    await onSubmit(person, photoDirty, initial?.photoUrl, relation);
  };

  const palettes = gender === 'female' ? FEMALE_PALETTES : MALE_PALETTES;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Photo upload */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <div
            className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full ring-2 ring-slate-200"
            style={{
              background: photoPreview
                ? undefined
                : `linear-gradient(135deg, ${palettes[paletteIdx][0]}, ${palettes[paletteIdx][1]})`,
            }}
          >
            {photoPreview ? (
               
              <img
                src={photoPreview}
                alt="Preview"
                className="h-full w-full object-cover"
                crossOrigin="anonymous"
              />
            ) : (
              <User className="h-8 w-8 text-white/80" />
            )}
          </div>
          {photoPreview && (
            <button
              type="button"
              onClick={handleRemovePhoto}
              className="absolute -right-1 -top-1 rounded-full bg-red-500 p-1 text-white shadow hover:bg-red-600"
              aria-label="Remove photo"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        <div className="flex-1 space-y-2">
          <Label htmlFor="photo" className="text-xs text-slate-500">
            Photo (optional)
          </Label>
          <label
            htmlFor="photo"
            className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <Upload className="h-3.5 w-3.5" />
            {uploadingPhoto ? 'Uploading...' : photoPreview ? 'Change photo' : 'Upload photo'}
          </label>
          <Input
            id="photo"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handlePhotoChange(e.target.files?.[0] ?? null)}
            disabled={uploadingPhoto}
          />
        </div>
      </div>

      {/* Names */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="firstName">First name *</Label>
          <Input
            id="firstName"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Raghavan"
            required
          />
        </div>
        <div>
          <Label htmlFor="lastName">Last name</Label>
          <Input
            id="lastName"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Nair"
          />
        </div>
      </div>

      {/* Years */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="birthYear">Birth year</Label>
          <Input
            id="birthYear"
            type="number"
            value={birthYear}
            onChange={(e) => setBirthYear(e.target.value)}
            placeholder="1940"
            min={0}
            max={9999}
          />
        </div>
        <div>
          <Label htmlFor="deathYear">Death year</Label>
          <Input
            id="deathYear"
            type="number"
            value={deathYear}
            onChange={(e) => setDeathYear(e.target.value)}
            placeholder="Leave empty if living"
            min={0}
            max={9999}
          />
        </div>
      </div>

      {/* Gender */}
      <div>
        <Label>Gender</Label>
        <Select value={gender} onValueChange={(v) => setGender(v as Gender)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="male">Male</SelectItem>
            <SelectItem value="female">Female</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Avatar palette */}
      <div>
        <Label className="mb-1.5 block">Avatar color</Label>
        <div className="flex flex-wrap gap-2">
          {palettes.map((p, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setPaletteIdx(i)}
              className="h-8 w-8 rounded-full ring-2 ring-offset-2 transition"
              style={{
                background: `linear-gradient(135deg, ${p[0]}, ${p[1]})`,
                outline: paletteIdx === i ? '2px solid #6366f1' : undefined,
                outlineOffset: 2,
              }}
              aria-label={`Palette ${i + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Occupation & birthplace */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="occupation">Occupation</Label>
          <Input
            id="occupation"
            value={occupation}
            onChange={(e) => setOccupation(e.target.value)}
            placeholder="Engineer"
          />
        </div>
        <div>
          <Label htmlFor="birthPlace">Birthplace</Label>
          <Input
            id="birthPlace"
            value={birthPlace}
            onChange={(e) => setBirthPlace(e.target.value)}
            placeholder="Kochi"
          />
        </div>
      </div>

      {/* Relationship picker — only shown when adding a new person, not the first one */}
      {showRelationSection && (
        <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
          <Label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">
            Link to family (optional)
          </Label>
          <div className="grid grid-cols-4 gap-1.5">
            <button
              type="button"
              onClick={() => { setRelationKind('none'); setRelationTargetId(''); setRelationMarriageYear(''); }}
              className={`flex flex-col items-center justify-center gap-1 rounded-md border px-2 py-2 text-[11px] font-medium transition ${
                relationKind === 'none'
                  ? 'border-slate-400 bg-white text-slate-700 ring-1 ring-slate-300'
                  : 'border-slate-200 bg-white/60 text-slate-500 hover:bg-white'
              }`}
            >
              <User className="h-3.5 w-3.5" />
              Standalone
            </button>
            <button
              type="button"
              onClick={() => setRelationKind('spouse')}
              className={`flex flex-col items-center justify-center gap-1 rounded-md border px-2 py-2 text-[11px] font-medium transition ${
                relationKind === 'spouse'
                  ? 'border-pink-300 bg-pink-50 text-pink-700 ring-1 ring-pink-300'
                  : 'border-slate-200 bg-white/60 text-slate-500 hover:bg-white'
              }`}
            >
              <Heart className="h-3.5 w-3.5" />
              Spouse of
            </button>
            <button
              type="button"
              onClick={() => setRelationKind('child')}
              className={`flex flex-col items-center justify-center gap-1 rounded-md border px-2 py-2 text-[11px] font-medium transition ${
                relationKind === 'child'
                  ? 'border-purple-300 bg-purple-50 text-purple-700 ring-1 ring-purple-300'
                  : 'border-slate-200 bg-white/60 text-slate-500 hover:bg-white'
              }`}
            >
              <GitBranch className="h-3.5 w-3.5" />
              Child of
            </button>
            <button
              type="button"
              onClick={() => setRelationKind('parent')}
              className={`flex flex-col items-center justify-center gap-1 rounded-md border px-2 py-2 text-[11px] font-medium transition ${
                relationKind === 'parent'
                  ? 'border-amber-300 bg-amber-50 text-amber-700 ring-1 ring-amber-300'
                  : 'border-slate-200 bg-white/60 text-slate-500 hover:bg-white'
              }`}
            >
              <GitBranch className="h-3.5 w-3.5 rotate-180" />
              Parent of
            </button>
          </div>

          {relationKind !== 'none' && (
            <div className="mt-3 space-y-2">
              <div>
                <Label htmlFor="relationTarget" className="text-xs text-slate-600">
                  {relationKind === 'spouse' && 'Marry which person?'}
                  {relationKind === 'child' && 'Who is the parent?'}
                  {relationKind === 'parent' && 'Who is the child?'}
                </Label>
                <Select value={relationTargetId} onValueChange={setRelationTargetId}>
                  <SelectTrigger id="relationTarget" className="bg-white">
                    <SelectValue placeholder="Select a person…" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortedExisting.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.firstName} {p.lastName ?? ''}{p.birthYear ? ` (${p.birthYear})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {relationKind === 'spouse' && (
                <div>
                  <Label htmlFor="relationMarriageYear" className="text-xs text-slate-600">
                    Marriage year (optional)
                  </Label>
                  <Input
                    id="relationMarriageYear"
                    type="number"
                    value={relationMarriageYear}
                    onChange={(e) => setRelationMarriageYear(e.target.value)}
                    placeholder="1995"
                    min={0}
                    max={9999}
                    className="bg-white"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting || uploadingPhoto}>
          {submitting ? 'Saving...' : initial ? 'Save changes' : 'Add person'}
        </Button>
      </div>
    </form>
  );
}
