'use client';

// Family Tree — Empty state
// Shown when a family has no persons yet. Prompts the user to add the first person.

import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  onAdd: () => void;
}

export function EmptyState({ onAdd }: Props) {
  return (
    <div className="relative flex h-full items-center justify-center p-6">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-100 to-teal-100 shadow-lg shadow-emerald-500/10">
          <Plus className="h-10 w-10 text-emerald-600" />
        </div>
        <h2 className="mb-2 text-2xl font-bold text-slate-800">Start your family tree</h2>
        <p className="mb-6 text-sm text-slate-500">
          Add your first family member to begin building your tree.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button
            onClick={onAdd}
            className="rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-5 shadow-md shadow-emerald-500/25 hover:shadow-lg"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Add first person
          </Button>
        </div>
      </div>
    </div>
  );
}
