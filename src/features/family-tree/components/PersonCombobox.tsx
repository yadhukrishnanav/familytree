'use client';

// PersonCombobox — searchable person picker for large families.
//
// Replaces the plain <Select> dropdowns that became tedious to scroll once
// the family grew past ~30 people. User types a few letters of a name and
// the list filters instantly. Built on the shadcn Popover + Command pattern.

import { useState } from 'react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Person } from '../types';

interface Props {
  /** All people to choose from. */
  persons: Person[];
  /** Currently selected person id (empty string = nothing selected). */
  value: string;
  /** Called with the selected person's id. */
  onChange: (id: string) => void;
  /** Placeholder text when nothing is selected. */
  placeholder?: string;
  /** Ids to hide from the list (e.g. the already-selected partner, or self). */
  excludeIds?: string[];
  /** Extra classes for the trigger button. */
  className?: string;
  /** HTML id for the trigger — lets a <Label htmlFor> point at it. */
  id?: string;
}

const personLabel = (p: Person) =>
  `${p.firstName} ${p.lastName ?? ''}`.trim() + (p.birthYear ? ` (${p.birthYear})` : '');

export function PersonCombobox({
  persons,
  value,
  onChange,
  placeholder = 'Select a person…',
  excludeIds = [],
  className,
  id,
}: Props) {
  const [open, setOpen] = useState(false);

  const sorted = [...persons].sort((a, b) =>
    `${a.firstName} ${a.lastName ?? ''}`.localeCompare(`${b.firstName} ${b.lastName ?? ''}`),
  );
  const visible = sorted.filter((p) => !excludeIds.includes(p.id));
  const selected = persons.find((p) => p.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          className={cn(
            'flex h-9 w-full items-center justify-between rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-1 focus:ring-slate-400',
            selected ? 'text-slate-700' : 'text-slate-400',
            className,
          )}
        >
          <span className="truncate">{selected ? personLabel(selected) : placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0"
        align="start"
        style={{ width: 'var(--radix-popover-trigger-width)' }}
      >
        <Command>
          <CommandInput placeholder="Search name…" />
          <CommandList>
            <CommandEmpty>No person found.</CommandEmpty>
            <CommandGroup>
              {visible.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`${personLabel(p)} ${p.id}`}
                  onSelect={() => {
                    onChange(p.id);
                    setOpen(false);
                  }}
                  className="justify-between"
                >
                  <span>{personLabel(p)}</span>
                  <Check
                    className={cn('h-4 w-4', value === p.id ? 'opacity-100' : 'opacity-0')}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
