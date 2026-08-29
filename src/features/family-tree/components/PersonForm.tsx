'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, X, User, Heart, GitBranch } from 'lucide-react';
import type { Gender, Person } from '../types';
import { uploadPhoto, deletePhoto } from '../supabase';

export type NewRelation =
  | { kind: 'spouse'; targetPersonId: string; marriageYear?: number }
  | { kind: 'child'; targetPersonId: string }
  | { kind: 'parent'; targetPersonId: string };

interface Props {
  initial?: Person;
  familyId: string;
  existingPersons?: Person[];
  onSubmit: (person: Person, photoChanged: boolean, oldPhotoUrl?: string, relation?: NewRelation) => void | Promise<void>;
  onCancel: () => void;
  submitting?: boolean;
}

const SOCIAL_PLATFORMS = [
  { value: 'instagram', label: 'Instagram', placeholder: '@username' },
  { value: 'facebook', label: 'Facebook', placeholder: 'profile name or URL' },
  { value: 'twitter', label: 'Twitter / X', placeholder: '@username' },
  { value: 'linkedin', label: 'LinkedIn', placeholder: 'profile name or URL' },
];

export function PersonForm({ initial, familyId, existingPersons, onSubmit, onCancel, submitting }: Props) {
  const [firstName, setFirstName] = useState(initial?.firstName ?? '');
  const [lastName, setLastName] = useState(initial?.lastName ?? '');
  const [birthYear, setBirthYear] = useState(initial?.birthYear != null ? String(initial.birthYear) : '');
  const [deathYear, setDeathYear] = useState(initial?.deathYear != null ? String(initial.deathYear) : '');
  const [gender, setGender] = useState<Gender>(initial?.gender ?? 'male');
  const [occupation, setOccupation] = useState(initial?.occupation ?? '');
  const [birthPlace, setBirthPlace] = useState(initial?.birthPlace ?? '');
  const [phone, setPhone] = useState((initial as any)?.phone ?? '');
  const [email, setEmail] = useState((initial as any)?.email ?? '');
  const [socials, setSocials] = useState<{ platform: string; handle: string }[]>(() => {
    const list: { platform: string; handle: string }[] = [];
    if ((initial as any)?.instagram) list.push({ platform: 'instagram', handle: (initial as any).instagram });
    if ((initial as any)?.facebook) list.push({ platform: 'facebook', handle: (initial as any).facebook });
    if ((initial as any)?.twitter) list.push({ platform: 'twitter', handle: (initial as any).twitter });
    if ((initial as any)?.linkedin) list.push({ platform: 'linkedin', handle: (initial as any).linkedin });
    return list;
  });
  const [photoPreview, setPhotoPreview] = useState<string | undefined>(initial?.photoUrl);
  const [photoDirty, setPhotoDirty] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [relationKind, setRelationKind] = useState<'none' | 'spouse' | 'child' | 'parent'>('none');
  const [relationTargetId, setRelationTargetId] = useState('');
  const [relationMarriageYear, setRelationMarriageYear] = useState('');

  const isAddingNew = !initial;
  const showRelationSection = isAddingNew && (existingPersons?.length ?? 0) > 0;
  const sortedExisting = [...(existingPersons ?? [])].sort((a, b) => `${a.firstName} ${a.lastName ?? ''}`.localeCompare(`${b.firstName} ${b.lastName ?? ''}`));

  const handlePhotoChange = async (file: File | null) => {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { setError('Photo must be under 8 MB'); return; }
    setUploadingPhoto(true); setError(null);
    try { const url = await uploadPhoto(file, familyId, 'person'); setPhotoPreview(url); setPhotoDirty(true); }
    catch (e: any) { setError(e.message ?? 'Photo upload failed'); }
    finally { setUploadingPhoto(false); }
  };

  const handleRemovePhoto = async () => {
    if (initial?.photoUrl && photoDirty && initial.photoUrl.startsWith('http')) { try { await deletePhoto(initial.photoUrl); } catch {} }
    setPhotoPreview(undefined); setPhotoDirty(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null);
    if (!firstName.trim()) { setError('First name is required'); return; }
    if (!birthYear.trim()) { setError('Birth year is required'); return; }
    const by = Number(birthYear); const dy = deathYear.trim() ? Number(deathYear) : undefined;
    if (isNaN(by) || by < 0 || by > 9999) { setError('Birth year must be valid'); return; }
    if (dy != null && (isNaN(dy) || dy < 0 || dy > 9999)) { setError('Death year must be valid'); return; }
    if (dy != null && dy < by) { setError('Death year cannot be before birth year'); return; }

    const person: Person = {
      id: initial?.id ?? crypto.randomUUID(),
      firstName: firstName.trim(), lastName: lastName.trim() || undefined,
      birthYear: by, deathYear: dy, gender,
      avatarColors: ['#10b981', '#14b8a6'] as [string, string],
      occupation: occupation.trim() || undefined, birthPlace: birthPlace.trim() || undefined,
      photoUrl: photoPreview,
      phone: phone.trim() || undefined, email: email.trim() || undefined,
      instagram: socials.find(s => s.platform === 'instagram')?.handle.trim() || undefined,
      facebook: socials.find(s => s.platform === 'facebook')?.handle.trim() || undefined,
      twitter: socials.find(s => s.platform === 'twitter')?.handle.trim() || undefined,
      linkedin: socials.find(s => s.platform === 'linkedin')?.handle.trim() || undefined,
    } as Person;

    let relation: NewRelation | undefined;
    if (relationKind !== 'none') {
      if (!relationTargetId) { setError('Please select a person to link to.'); return; }
      if (relationKind === 'spouse') {
        if (!relationMarriageYear.trim()) { setError('Marriage year is required for spouse.'); return; }
        const my = Number(relationMarriageYear);
        if (isNaN(my) || my < 0 || my > 9999) { setError('Marriage year must be valid'); return; }
        relation = { kind: 'spouse', targetPersonId: relationTargetId, marriageYear: my };
      } else if (relationKind === 'child') { relation = { kind: 'child', targetPersonId: relationTargetId }; }
      else if (relationKind === 'parent') { relation = { kind: 'parent', targetPersonId: relationTargetId }; }
    }
    await onSubmit(person, photoDirty, initial?.photoUrl, relation);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="flex items-center gap-4">
        <div className="relative">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full ring-2 ring-slate-200" style={{ background: photoPreview ? undefined : 'linear-gradient(135deg, #10b981, #14b8a6)' }}>
            {photoPreview ? <img src={photoPreview} alt="Preview" className="h-full w-full object-cover" crossOrigin="anonymous" /> : <User className="h-8 w-8 text-white/80" />}
          </div>
          {photoPreview && <button type="button" onClick={handleRemovePhoto} className="absolute -right-1 -top-1 rounded-full bg-red-500 p-1 text-white shadow hover:bg-red-600"><X className="h-3 w-3" /></button>}
        </div>
        <div className="flex-1 space-y-2">
          <Label htmlFor="photo" className="text-xs text-slate-500">Photo (optional)</Label>
          <label htmlFor="photo" className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"><Upload className="h-3.5 w-3.5" />{uploadingPhoto ? 'Uploading...' : photoPreview ? 'Change photo' : 'Upload photo'}</label>
          <Input id="photo" type="file" accept="image/*" className="hidden" onChange={(e) => handlePhotoChange(e.target.files?.[0] ?? null)} disabled={uploadingPhoto} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div><Label htmlFor="firstName">First name *</Label><Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Raghavan" /></div>
        <div><Label htmlFor="lastName">Last name</Label><Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Nair" /></div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div><Label htmlFor="birthYear">Birth year *</Label><Input id="birthYear" type="number" value={birthYear} onChange={(e) => setBirthYear(e.target.value)} placeholder="1940" min={0} max={9999} /></div>
        <div><Label htmlFor="deathYear">Death year</Label><Input id="deathYear" type="number" value={deathYear} onChange={(e) => setDeathYear(e.target.value)} placeholder="Leave empty if living" min={0} max={9999} /></div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div><Label htmlFor="gender">Gender</Label><Select value={gender} onValueChange={(v) => setGender(v as Gender)}><SelectTrigger id="gender"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="male">Male</SelectItem><SelectItem value="female">Female</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></div>
        <div><Label htmlFor="occupation">Occupation</Label><Input id="occupation" value={occupation} onChange={(e) => setOccupation(e.target.value)} placeholder="Engineer" /></div>
        <div><Label htmlFor="birthPlace">Birthplace</Label><Input id="birthPlace" value={birthPlace} onChange={(e) => setBirthPlace(e.target.value)} placeholder="Kochi" /></div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div><Label htmlFor="phone">Phone</Label><Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" type="tel" /></div>
        <div><Label htmlFor="email">Email</Label><Input id="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="raghavan@example.com" type="email" /></div>
      </div>

      <div>
        <Label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">Social media (optional)</Label>
        {socials.length === 0 && <p className="mb-2 text-xs text-slate-400">No social media added yet.</p>}
        {socials.map((social, idx) => (
          <div key={idx} className="mb-2 flex items-center gap-2">
            <Select value={social.platform} onValueChange={(v) => setSocials(prev => prev.map((s, i) => i === idx ? { ...s, platform: v } : s))}><SelectTrigger className="w-36 shrink-0"><SelectValue /></SelectTrigger><SelectContent>{SOCIAL_PLATFORMS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent></Select>
            <Input value={social.handle} onChange={(e) => setSocials(prev => prev.map((s, i) => i === idx ? { ...s, handle: e.target.value } : s))} placeholder={SOCIAL_PLATFORMS.find(p => p.value === social.platform)?.placeholder ?? '@username'} className="flex-1" />
            <button type="button" onClick={() => setSocials(prev => prev.filter((_, i) => i !== idx))} className="shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"><X className="h-3.5 w-3.5" /></button>
          </div>
        ))}
        {socials.length < 4 && <button type="button" onClick={() => { const used = new Set(socials.map(s => s.platform)); const next = SOCIAL_PLATFORMS.find(p => !used.has(p.value)); setSocials(prev => [...prev, { platform: next?.value ?? 'instagram', handle: '' }]); }} className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700">+ Add social media</button>}
      </div>

      {showRelationSection && (
        <div className="rounded-lg border border-slate-200 bg-stone-50/50 p-3">
          <Label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">Link to family</Label>
          <div className="grid grid-cols-4 gap-1.5">
            <button type="button" onClick={() => { setRelationKind('none'); setRelationTargetId(''); setRelationMarriageYear(''); }} className={`flex flex-col items-center justify-center gap-1 rounded-md border px-2 py-2 text-[11px] font-medium transition ${relationKind === 'none' ? 'border-slate-400 bg-white text-slate-700 ring-1 ring-slate-300' : 'border-slate-200 bg-white/60 text-slate-500 hover:bg-white'}`}><User className="h-3.5 w-3.5" />Standalone</button>
            <button type="button" onClick={() => setRelationKind('spouse')} className={`flex flex-col items-center justify-center gap-1 rounded-md border px-2 py-2 text-[11px] font-medium transition ${relationKind === 'spouse' ? 'border-emerald-300 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-300' : 'border-slate-200 bg-white/60 text-slate-500 hover:bg-white'}`}><Heart className="h-3.5 w-3.5" />Spouse of</button>
            <button type="button" onClick={() => setRelationKind('child')} className={`flex flex-col items-center justify-center gap-1 rounded-md border px-2 py-2 text-[11px] font-medium transition ${relationKind === 'child' ? 'border-emerald-300 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-300' : 'border-slate-200 bg-white/60 text-slate-500 hover:bg-white'}`}><GitBranch className="h-3.5 w-3.5" />Child of</button>
            <button type="button" onClick={() => setRelationKind('parent')} className={`flex flex-col items-center justify-center gap-1 rounded-md border px-2 py-2 text-[11px] font-medium transition ${relationKind === 'parent' ? 'border-teal-300 bg-teal-50 text-teal-700 ring-1 ring-teal-300' : 'border-slate-200 bg-white/60 text-slate-500 hover:bg-white'}`}><GitBranch className="h-3.5 w-3.5 rotate-180" />Parent of</button>
          </div>
          {relationKind !== 'none' && (
            <div className="mt-3 space-y-2">
              <div>
                <Label htmlFor="relationTarget" className="text-xs text-slate-600">{relationKind === 'spouse' ? 'Marry which person?' : relationKind === 'child' ? 'Who is the parent?' : 'Who is the child?'}</Label>
                <Select value={relationTargetId} onValueChange={setRelationTargetId}><SelectTrigger id="relationTarget" className="bg-white"><SelectValue placeholder="Select a person…" /></SelectTrigger><SelectContent>{sortedExisting.map((p) => <SelectItem key={p.id} value={p.id}>{p.firstName} {p.lastName ?? ''}{p.birthYear ? ` (${p.birthYear})` : ''}</SelectItem>)}</SelectContent></Select>
              </div>
              {relationKind === 'spouse' && <div><Label htmlFor="relationMarriageYear" className="text-xs text-red-600">Marriage year *</Label><Input id="relationMarriageYear" type="number" value={relationMarriageYear} onChange={(e) => setRelationMarriageYear(e.target.value)} placeholder="1995" min={0} max={9999} className="bg-white" /></div>}
            </div>
          )}
        </div>
      )}

      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>Cancel</Button>
        <Button type="submit" disabled={submitting || uploadingPhoto}>{submitting ? 'Saving...' : initial ? 'Save changes' : 'Add person'}</Button>
      </div>
    </form>
  );
}
