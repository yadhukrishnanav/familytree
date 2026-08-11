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
import { Upload, X, User } from 'lucide-react';
import type { Gender, Person } from '../types';
import { MALE_PALETTES, FEMALE_PALETTES, pickAvatarColors } from '../data';
import { uploadPhoto, fileToDataUrl, deletePhoto } from '../supabase';

interface Props {
  initial?: Person;
  familyId: string;
  onSubmit: (person: Person, photoChanged: boolean, oldPhotoUrl?: string) => void | Promise<void>;
  onCancel: () => void;
  submitting?: boolean;
}

export function PersonForm({ initial, familyId, onSubmit, onCancel, submitting }: Props) {
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
    await onSubmit(person, photoDirty, initial?.photoUrl);
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
