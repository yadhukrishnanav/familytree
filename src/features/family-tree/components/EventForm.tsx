'use client';

// Family Tree — Timeline event form (add/edit)

import { useState } from 'react';
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
import { Upload, X } from 'lucide-react';
import type { Person, TimelineEvent, TimelineIcon } from '../types';
import { uploadPhoto, deletePhoto } from '../supabase';

interface Props {
  initial?: TimelineEvent;
  familyId: string;
  persons: Person[];
  onSubmit: (event: TimelineEvent, photoChanged: boolean, oldPhotoUrl?: string) => void | Promise<void>;
  onCancel: () => void;
  submitting?: boolean;
}

const ICON_OPTIONS: { value: TimelineIcon; label: string; color: string; emoji: string }[] = [
  { value: 'birth', label: 'Birth', color: '#10b981', emoji: '🎂' },
  { value: 'death', label: 'Death', color: '#64748b', emoji: '🕯️' },
  { value: 'marriage', label: 'Marriage', color: '#ec4899', emoji: '💍' },
  { value: 'graduation', label: 'Graduation', color: '#8b5cf6', emoji: '🎓' },
  { value: 'job', label: 'Career', color: '#f59e0b', emoji: '💼' },
  { value: 'move', label: 'Move', color: '#06b6d4', emoji: '🏠' },
  { value: 'milestone', label: 'Milestone', color: '#eab308', emoji: '⭐' },
  { value: 'travel', label: 'Travel', color: '#0ea5e9', emoji: '✈️' },
  { value: 'custom', label: 'Custom', color: '#a855f7', emoji: '📌' },
];

export function EventForm({ initial, familyId, persons, onSubmit, onCancel, submitting }: Props) {
  const [year, setYear] = useState(initial?.year != null ? String(initial.year) : '');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [icon, setIcon] = useState<TimelineIcon>(initial?.icon ?? 'milestone');
  const [personIds, setPersonIds] = useState<string[]>(initial?.personIds ?? []);
  const [photoPreview, setPhotoPreview] = useState<string | undefined>(initial?.photoUrl);
  const [photoDirty, setPhotoDirty] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Color is derived from the icon — the user never picks it manually.
  const color = ICON_OPTIONS.find((o) => o.value === icon)?.color ?? '#eab308';

  const handlePhotoChange = async (file: File | null) => {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      setError('Photo must be under 8 MB');
      return;
    }
    setUploading(true);
    try {
      const url = await uploadPhoto(file, familyId, 'event');
      setPhotoPreview(url);
      setPhotoDirty(true);
    } catch (e: any) {
      setError(e.message ?? 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const togglePerson = (id: string) => {
    setPersonIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    const y = year.trim() ? Number(year) : undefined;
    if (y == null || Number.isNaN(y) || y < 0 || y > 9999) {
      setError('Year is required and must be valid');
      return;
    }
    const event: TimelineEvent = {
      id: initial?.id ?? crypto.randomUUID(),
      year: y,
      title: title.trim(),
      description: description.trim() || undefined,
      photoUrl: photoPreview,
      personIds,
      icon,
      color,
    };
    await onSubmit(event, photoDirty, initial?.photoUrl);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-1">
          <Label htmlFor="year">Year *</Label>
          <Input
            id="year"
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder="2020"
            min={0}
            max={9999}
            required
          />
        </div>
        <div className="col-span-2">
          <Label htmlFor="title">Title *</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Family reunion in Goa"
            required
          />
        </div>
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Notes about this event..."
          rows={2}
        />
      </div>

      {/* Icon (color is derived automatically from the icon) */}
      <div>
        <Label>Icon</Label>
        <Select value={icon} onValueChange={(v) => setIcon(v as TimelineIcon)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ICON_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                <span className="mr-1.5">{o.emoji}</span>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Photo — compact: only show a thumbnail when a photo exists */}
      <div className="flex items-center gap-3">
        {photoPreview && (
          <div className="relative h-12 w-16 overflow-hidden rounded-md ring-1 ring-slate-200">
            <img src={photoPreview} alt="" className="h-full w-full object-cover" crossOrigin="anonymous" />
            <button
              type="button"
              onClick={async () => {
                if (initial?.photoUrl && photoDirty && initial.photoUrl.startsWith('http')) {
                  try { await deletePhoto(initial.photoUrl); } catch { /* ignore */ }
                }
                setPhotoPreview(undefined);
                setPhotoDirty(true);
              }}
              className="absolute right-0 top-0 rounded-bl-md bg-red-500 p-0.5 text-white"
              aria-label="Remove"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
        <label
          htmlFor="event-photo"
          className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          <Upload className="h-3.5 w-3.5" />
          {uploading ? 'Uploading...' : photoPreview ? 'Change photo' : 'Upload photo'}
        </label>
        <Input
          id="event-photo"
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handlePhotoChange(e.target.files?.[0] ?? null)}
          disabled={uploading}
        />
      </div>

      {/* Related people */}
      <div>
        <Label className="mb-1.5 block">Related people ({personIds.length})</Label>
        <div className="max-h-32 overflow-y-auto rounded-md border border-slate-200 p-2">
          {persons.length === 0 ? (
            <p className="py-2 text-center text-xs text-slate-400">No persons yet</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {persons.map((p) => {
                const active = personIds.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => togglePerson(p.id)}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                      active
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {p.firstName} {p.lastName ?? ''}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting || uploading}>
          {submitting ? 'Saving...' : initial ? 'Save event' : 'Add event'}
        </Button>
      </div>
    </form>
  );
}
