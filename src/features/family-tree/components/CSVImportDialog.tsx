'use client';

// Family Tree — CSV import dialog
// Bulk-add persons from a CSV file.
// Expected CSV columns (header row required): firstName, lastName?, birthYear?, deathYear?, gender?, occupation?, birthPlace?

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Upload, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Person, Gender } from '../types';
import { pickAvatarColors } from '../data';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onImport: (persons: Person[]) => void;
}

interface ParsedRow {
  firstName: string;
  lastName?: string;
  birthYear?: number;
  deathYear?: number;
  gender: Gender;
  occupation?: string;
  birthPlace?: string;
  rowNumber: number;
  errors: string[];
}

const SAMPLE_CSV = `firstName,lastName,birthYear,deathYear,gender,occupation,birthPlace
Raghavan,Nair,1940,2018,male,Engineer,Kochi
Lakshmi,Nair,1945,,female,Teacher,Thrissur
Arun,Nair,1968,,male,Doctor,Kochi
Anita,Nair,1972,,female,Architect,Thiruvananthapuram`;

function parseCSV(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) throw new Error('CSV is empty');
  const header = lines[0].split(',').map((c) => c.trim().toLowerCase());
  const requiredCols = ['firstname'];
  for (const col of requiredCols) {
    if (!header.includes(col)) {
      throw new Error(`Missing required column: ${col}. Found: ${header.join(', ')}`);
    }
  }

  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(',').map((c) => c.trim());
    const row: ParsedRow = {
      firstName: '',
      gender: 'male',
      rowNumber: i + 1,
      errors: [],
    };
    for (let j = 0; j < header.length; j++) {
      const col = header[j];
      const val = cells[j] ?? '';
      switch (col) {
        case 'firstname': row.firstName = val; break;
        case 'lastname': row.lastName = val || undefined; break;
        case 'birthyear':
          if (val) {
            const n = Number(val);
            if (Number.isNaN(n) || n < 0 || n > 9999) row.errors.push(`Invalid birthYear "${val}"`);
            else row.birthYear = n;
          }
          break;
        case 'deathyear':
          if (val) {
            const n = Number(val);
            if (Number.isNaN(n) || n < 0 || n > 9999) row.errors.push(`Invalid deathYear "${val}"`);
            else row.deathYear = n;
          }
          break;
        case 'gender':
          if (val && ['male', 'female', 'other'].includes(val.toLowerCase())) {
            row.gender = val.toLowerCase() as Gender;
          } else if (val) {
            row.errors.push(`Invalid gender "${val}" (use male/female/other)`);
          }
          break;
        case 'occupation': row.occupation = val || undefined; break;
        case 'birthplace': row.birthPlace = val || undefined; break;
      }
    }
    if (!row.firstName) {
      row.errors.push('First name is required');
    }
    if (row.birthYear != null && row.deathYear != null && row.deathYear < row.birthYear) {
      row.errors.push('Death year cannot be before birth year');
    }
    rows.push(row);
  }
  return rows;
}

export function CSVImportDialog({ open, onOpenChange, onImport }: Props) {
  const [parsed, setParsed] = useState<ParsedRow[] | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setError(null);
    setParsed(null);
    setFileName(file.name);
    try {
      const text = await file.text();
      const rows = parseCSV(text);
      setParsed(rows);
    } catch (e: any) {
      setError(e.message ?? 'Failed to parse CSV');
    }
  };

  const handleImport = async () => {
    if (!parsed) return;
    const valid = parsed.filter((r) => r.errors.length === 0);
    if (valid.length === 0) {
      toast.error('No valid rows to import');
      return;
    }
    setImporting(true);
    const persons: Person[] = valid.map((r, idx) => ({
      id: crypto.randomUUID(),
      firstName: r.firstName,
      lastName: r.lastName,
      birthYear: r.birthYear,
      deathYear: r.deathYear,
      gender: r.gender,
      avatarColors: pickAvatarColors(r.gender, idx),
      occupation: r.occupation,
      birthPlace: r.birthPlace,
    }));
    onImport(persons);
    setImporting(false);
    setParsed(null);
    setFileName('');
    onOpenChange(false);
    toast.success(`Imported ${persons.length} ${persons.length === 1 ? 'person' : 'people'}`);
  };

  const handleDownloadTemplate = () => {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'family-tree-template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const validCount = parsed?.filter((r) => r.errors.length === 0).length ?? 0;
  const errorCount = parsed?.filter((r) => r.errors.length > 0).length ?? 0;

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setParsed(null); setError(null); setFileName(''); } }}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-4 w-4 text-purple-500" />
            Import from CSV
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Upload a CSV file with columns: <code className="font-mono text-[11px] bg-slate-100 px-1 rounded">firstName,lastName,birthYear,deathYear,gender,occupation,birthPlace</code>.
            Only <code className="font-mono text-[11px] bg-slate-100 px-1 rounded">firstName</code> is required.
          </p>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
              <FileText className="mr-1.5 h-3.5 w-3.5" />
              Download template
            </Button>
          </div>

          <div>
            <Input
              id="csv-file"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              className="cursor-pointer"
            />
            {fileName && (
              <p className="mt-1 text-xs text-slate-500">Loaded: {fileName}</p>
            )}
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {parsed && (
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-700">
                  <CheckCircle2 className="h-3 w-3" />
                  {validCount} valid
                </span>
                {errorCount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 font-semibold text-red-700">
                    <AlertCircle className="h-3 w-3" />
                    {errorCount} with errors
                  </span>
                )}
              </div>

              {/* Preview */}
              <div className="max-h-60 overflow-y-auto rounded-lg border border-slate-200">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-slate-50 text-left text-[10px] uppercase text-slate-500">
                    <tr>
                      <th className="px-2 py-1.5">#</th>
                      <th className="px-2 py-1.5">Name</th>
                      <th className="px-2 py-1.5">Years</th>
                      <th className="px-2 py-1.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsed.map((r) => (
                      <tr key={r.rowNumber} className={r.errors.length > 0 ? 'bg-red-50/50' : ''}>
                        <td className="px-2 py-1.5 text-slate-400">{r.rowNumber}</td>
                        <td className="px-2 py-1.5 font-medium text-slate-700">
                          {r.firstName} {r.lastName ?? ''}
                        </td>
                        <td className="px-2 py-1.5 text-slate-500">
                          {r.birthYear ?? '?'}{r.deathYear ? `–${r.deathYear}` : ''}
                        </td>
                        <td className="px-2 py-1.5">
                          {r.errors.length === 0 ? (
                            <span className="text-emerald-600">✓</span>
                          ) : (
                            <span className="text-red-500" title={r.errors.join('; ')}>⚠</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {errorCount > 0 && (
                <p className="mt-1 text-[11px] text-slate-500">
                  Hover the ⚠ icon to see error details. Valid rows will be imported; rows with errors will be skipped.
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={!parsed || validCount === 0 || importing}>
              {importing ? 'Importing…' : `Import ${validCount > 0 ? `${validCount} ` : ''}people`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
