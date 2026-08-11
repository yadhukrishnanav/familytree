'use client';

// Family Tree — Activity panel (slide-in from right)
// Shows recent edits across the family with "revert" buttons.

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { X, History, RotateCcw, User, Clock } from 'lucide-react';
import {
  fetchRecentActivity,
  subscribeToActivity,
  describeActivity,
  timeAgo,
  type ActivityLogEntry,
} from '../activity';
import { useAuth } from '../auth';
import { toast } from 'sonner';
import type { Action, Person, TimelineEvent } from '../types';

interface Props {
  familyId: string;
  onClose: () => void;
  onRevert: (action: Action) => void;
}

const ACTION_VERB_COLOR: Record<string, string> = {
  insert: '#10b981',
  update: '#3b82f6',
  delete: '#ef4444',
  link: '#8b5cf6',
  unlink: '#f59e0b',
  revert: '#06b6d4',
  clear: '#dc2626',
};

export function ActivityPanel({ familyId, onClose, onRevert }: Props) {
  const auth = useAuth();
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [reverting, setReverting] = useState<string | null>(null);

  // Initial load + realtime subscription
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetchRecentActivity(familyId, 50).then((rows) => {
      if (mounted) {
        setEntries(rows);
        setLoading(false);
      }
    });
    const unsub = subscribeToActivity(familyId, (entry) => {
      setEntries((prev) => {
        // De-dupe by id
        if (prev.some((e) => e.id === entry.id)) return prev;
        return [entry, ...prev].slice(0, 50);
      });
    });
    return () => {
      mounted = false;
      unsub?.();
    };
  }, [familyId]);

  const handleRevert = async (entry: ActivityLogEntry) => {
    setReverting(entry.id);
    try {
      // Revert logic:
      // - For 'insert' → delete the entity
      // - For 'delete' → re-insert the "before" snapshot
      // - For 'update' → restore the "before" snapshot
      // - For 'link' (spouse/parent-child) → unlink (not implemented in this version; just toast)
      // - For 'clear' → too complex; show toast suggesting undo
      if (entry.action === 'update' || entry.action === 'delete') {
        if (entry.entity_type === 'person' && entry.before) {
          const before = entry.before as Person;
          onRevert({ type: 'UPDATE_PERSON', person: before });
          toast.success(`Reverted ${entry.entity_name}`, { description: 'Restored previous version' });
        } else if (entry.entity_type === 'timeline_event' && entry.before) {
          const before = entry.before as TimelineEvent;
          onRevert({ type: 'UPDATE_EVENT', event: before });
          toast.success(`Reverted ${entry.entity_name}`, { description: 'Restored previous version' });
        } else {
          toast.info('This revert type is not yet supported', { description: 'Use Ctrl/Cmd+Z to undo locally instead.' });
        }
      } else if (entry.action === 'insert') {
        if (entry.entity_type === 'person') {
          onRevert({ type: 'DELETE_PERSON', personId: entry.entity_id });
          toast.success(`Removed ${entry.entity_name}`, { description: 'Reverted the add' });
        } else if (entry.entity_type === 'timeline_event') {
          onRevert({ type: 'DELETE_EVENT', eventId: entry.entity_id });
          toast.success(`Removed ${entry.entity_name}`, { description: 'Reverted the add' });
        } else {
          toast.info('This revert type is not yet supported');
        }
      } else {
        toast.info('This revert type is not yet supported', { description: 'Use Ctrl/Cmd+Z to undo locally instead.' });
      }
    } finally {
      setReverting(null);
    }
  };

  // Only admin/owner can revert others' changes; anyone can revert their own
  const canRevert = (entry: ActivityLogEntry) => {
    if (!auth.user) return false;
    if (entry.user_id === auth.user.id) return true;
    const myFamily = auth.families.find((f) => f.id === familyId);
    return myFamily?.role === 'admin' || myFamily?.role === 'owner';
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* Panel */}
      <div className="relative h-full w-full max-w-md bg-white shadow-2xl ring-1 ring-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-purple-50 to-pink-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-sm">
              <History className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Recent activity</h2>
              <p className="text-[10px] text-slate-500">Last 50 changes across your family</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-3" style={{ maxHeight: 'calc(100vh - 64px)' }}>
          {loading ? (
            <div className="space-y-2">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-lg bg-slate-100" />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                <History className="h-6 w-6 text-slate-300" />
              </div>
              <p className="text-sm font-medium text-slate-600">No activity yet</p>
              <p className="mt-1 text-xs text-slate-400">Changes made by you and your family will appear here.</p>
            </div>
          ) : (
            <ol className="space-y-2">
              {entries.map((entry) => {
                const color = ACTION_VERB_COLOR[entry.action] ?? '#64748b';
                const isMine = entry.user_id === auth.user?.id;
                const canRev = canRevert(entry);
                return (
                  <li
                    key={entry.id}
                    className="relative rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition hover:shadow-md"
                  >
                    <div className="flex items-start gap-3">
                      {/* Color dot */}
                      <div
                        className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: color }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-slate-800">
                            {describeActivity(entry)}
                          </p>
                          {canRev && entry.action !== 'clear' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRevert(entry)}
                              disabled={reverting === entry.id}
                              className="h-7 shrink-0 px-2 text-[11px] text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                              title="Revert this change"
                            >
                              <RotateCcw className="mr-1 h-3 w-3" />
                              {reverting === entry.id ? 'Reverting…' : 'Revert'}
                            </Button>
                          )}
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
                          <span className="inline-flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {isMine ? 'You' : entry.user_email ?? 'Unknown'}
                          </span>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {timeAgo(entry.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
