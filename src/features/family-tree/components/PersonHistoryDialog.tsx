'use client';

// Family Tree — Person edit history dialog
// Shows the activity log entries for a specific person, with the ability to
// restore a previous version (revert).

import { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { History, RotateCcw } from 'lucide-react';
import type { Person } from '../types';
import {
  fetchEntityHistory,
  describeActivity,
  timeAgo,
  type ActivityLogEntry,
} from '../activity';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  familyId: string;
  person: Person;
  onRevert: (person: Person) => void;
}

export function PersonHistoryDialog({
  open,
  onOpenChange,
  familyId,
  person,
  onRevert,
}: Props) {
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    // Use a microtask to defer the setState, avoiding the synchronous-in-effect warning
    Promise.resolve().then(() => {
      if (!mounted || !open) return;
      setLoading(true);
      fetchEntityHistory(familyId, 'person', person.id, 30).then((rows) => {
        if (!mounted) return;
        setEntries(rows);
        setLoading(false);
      });
    });
    return () => { mounted = false; };
  }, [open, familyId, person.id]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit history · {person.firstName} {person.lastName ?? ''}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="py-8 text-center">
            <History className="mx-auto mb-2 h-8 w-8 text-slate-300" />
            <p className="text-sm text-slate-500">No edit history yet.</p>
            <p className="mt-1 text-xs text-slate-400">
              When you or a family member edits this person, the change will appear here.
            </p>
          </div>
        ) : (
          <ol className="space-y-2">
            {entries.map((entry) => (
              <li key={entry.id} className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800">
                      {describeActivity(entry)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {entry.user_email ?? 'Unknown'} · {timeAgo(entry.created_at)}
                    </p>
                    {(entry.action === 'update' || entry.action === 'delete') && entry.before && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-[11px] text-slate-400 hover:text-slate-600">
                          View previous version
                        </summary>
                        <pre className="mt-1 max-h-32 overflow-auto rounded bg-slate-50 p-2 text-[10px] text-slate-600">
{JSON.stringify(entry.before, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                  {(entry.action === 'update' || entry.action === 'delete') && entry.before && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onRevert(entry.before as Person)}
                      className="shrink-0 text-[11px]"
                    >
                      <RotateCcw className="mr-1 h-3 w-3" />
                      Restore
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  );
}
