'use client';

// Family Tree — Store provider
// Wraps useReducer + Context with:
// - localStorage persistence (always-on, for offline/demo)
// - Supabase sync (when configured): debounced writes + initial load
// - Realtime subscriptions (when configured): apply incoming changes
// - Undo/redo history (with keyboard shortcuts Ctrl/Cmd+Z, Shift+Z)

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { initialState, reducer } from './reducer';
import type { Action, FamilyTreeState } from './types';
import { isSupabaseConfigured } from './supabase';
import {
  applyRealtimeChange,
  loadTreeFromSupabase,
  saveTreeToSupabase,
  subscribeToTreeChanges,
  type RealtimeChange,
} from './sync';
import { deriveActivityFromAction, logActivity } from './activity';
import { syncPersonAutoEvents, syncMarriageAutoEvent } from './reducer';
import { STORAGE_KEYS, TIMING } from './constants';

interface StoreContextValue {
  state: FamilyTreeState;
  dispatch: (action: Action) => void;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  loading: boolean;
  syncing: boolean;
  isDemo: boolean;
}

const StoreContext = createContext<StoreContextValue | null>(null);

// ---- Auto-event regeneration helper ----
// Auto events (auto_birth_X, auto_death_X, auto_marriage_X_Y) are DERIVED from
// person + family-unit data. They have string IDs that don't fit the
// timeline_events table's `id uuid` column, so we never persist them to Supabase.
// On every load (local or remote), we drop any stale auto events from the
// loaded state and regenerate fresh ones from the current persons + units.
// This keeps the timeline in sync with person data without ever relying on
// the DB to store derived rows.
function regenerateAutoEvents(state: FamilyTreeState): FamilyTreeState {
  // Start with only the manual events (drop any stale auto events that might
  // have been persisted in an older localStorage snapshot).
  let events = state.timelineEvents.filter((e) => !e.id.startsWith('auto_'));

  // Regenerate birth + death auto events for every person.
  for (const person of Object.values(state.persons)) {
    events = syncPersonAutoEvents(events, person);
  }

  // Regenerate marriage auto events for every couple.
  for (const unit of state.familyUnits) {
    if (unit.partner2Id && unit.marriageYear != null) {
      const p1 = state.persons[unit.partner1Id];
      const p2 = state.persons[unit.partner2Id];
      if (p1 && p2) {
        events = syncMarriageAutoEvent(events, p1, p2, unit.marriageYear);
      }
    }
  }

  return { ...state, timelineEvents: events };
}

// ---- localStorage helpers ----
const LS_PREFIX = STORAGE_KEYS.TREE_DATA_PREFIX;
function loadLocal(familyId: string): FamilyTreeState | null {
  try {
    const raw = localStorage.getItem(LS_PREFIX + familyId);
    if (!raw) return null;
    return JSON.parse(raw) as FamilyTreeState;
  } catch {
    return null;
  }
}
function saveLocal(familyId: string, state: FamilyTreeState) {
  try {
    localStorage.setItem(LS_PREFIX + familyId, JSON.stringify(state));
  } catch (e) {
    console.warn('localStorage save failed', e);
  }
}

// ---- History (undo/redo) ----
// We keep snapshots of state before each committed action.
const MAX_HISTORY = 50;
interface History {
  past: FamilyTreeState[];
  future: FamilyTreeState[];
}

export function StoreProvider({
  familyId,
  actor,
  children,
}: {
  familyId: string | null;
  actor: { id: string; email: string } | null;
  children: ReactNode;
}) {
  const [state, rawDispatch] = useReducer(reducer, initialState);
  const [history, setHistory] = useState<History>({ past: [], future: [] });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const skipNextSync = useRef(false); // set true when applying remote changes (don't echo back)
  const lastSavedState = useRef<string>('');
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- Initial load: localStorage first, then Supabase if configured ----
  useEffect(() => {
    if (!familyId) {
      setLoading(false);
      return;
    }
    let mounted = true;
    setLoading(true);
    (async () => {
      // 1. Try localStorage for instant paint
      const local = loadLocal(familyId);
      if (local && mounted) {
        rawDispatch({ type: 'LOAD_STATE', state: regenerateAutoEvents(local) });
      }
      // 2. Try Supabase
      if (isSupabaseConfigured) {
        try {
          const remote = await loadTreeFromSupabase(familyId);
          if (mounted) {
            const withAutoEvents = regenerateAutoEvents(remote);
            rawDispatch({ type: 'LOAD_STATE', state: withAutoEvents });
            saveLocal(familyId, withAutoEvents);
            lastSavedState.current = JSON.stringify(withAutoEvents);
          }
        } catch (e) {
          console.warn('Supabase load failed; using local fallback', e);
        }
      }
      if (mounted) setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [familyId]);

  // ---- Realtime subscription ----
  useEffect(() => {
    if (!familyId || !isSupabaseConfigured) return;
    const unsub = subscribeToTreeChanges(familyId, (change: RealtimeChange) => {
      skipNextSync.current = true;
      setHistory((h) => ({ past: [], future: [] })); // remote changes invalidate history
      const next = applyRealtimeChange(stateRef.current, change);
      // Realtime changes bring raw rows from Supabase (which doesn't store
      // auto events) — regenerate them so the timeline stays in sync.
      rawDispatch({ type: 'LOAD_STATE', state: regenerateAutoEvents(next) });
    });
    return () => {
      unsub?.();
    };
     
  }, [familyId]);

  // Keep a ref to current state so realtime callback can read it
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // ---- Persist: localStorage (immediate) + Supabase (debounced) ----
  useEffect(() => {
    if (!familyId) return;
    if (skipNextSync.current) {
      skipNextSync.current = false;
      return;
    }
    // Always save to localStorage immediately
    saveLocal(familyId, state);
    if (!isSupabaseConfigured) return;

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(async () => {
      const snap = JSON.stringify(state);
      if (snap === lastSavedState.current) return;
      lastSavedState.current = snap;
      setSyncing(true);
      try {
        await saveTreeToSupabase(familyId, state);
      } catch (e) {
        console.error('Supabase save failed', e);
      } finally {
        setSyncing(false);
      }
    }, TIMING.SUPABASE_SYNC_DEBOUNCE);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [state, familyId]);

  // ---- Wrapped dispatch with history tracking + activity logging ----
  // Note: LOAD_STATE actions from initial load / realtime / undo / redo all go through
  // rawDispatch directly (not this wrapper), so they bypass history + activity tracking naturally.
  const dispatch = useCallback((action: Action) => {
    if (action.type === 'UNDO' || action.type === 'REDO') return;
    // Compute activity entries BEFORE the state mutates (we need the "before" snapshot)
    if (actor && familyId) {
      const entries = deriveActivityFromAction(action, stateRef.current, actor, familyId);
      if (entries.length > 0) {
        // Fire and forget — don't block the UI
        logActivity(familyId, actor, entries).catch(() => {});
      }
    }
    // Push current state to past, clear future
    setHistory((h) => ({
      past: [...h.past, stateRef.current].slice(-MAX_HISTORY),
      future: [],
    }));
    rawDispatch(action);
  }, [actor, familyId]);

  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.past.length === 0) return h;
      const previous = h.past[h.past.length - 1];
      const newPast = h.past.slice(0, -1);
      const newFuture = [stateRef.current, ...h.future].slice(0, MAX_HISTORY);
      rawDispatch({ type: 'LOAD_STATE', state: previous });
      skipNextSync.current = false; // persist the undone state
      return { past: newPast, future: newFuture };
    });
  }, []);

  const redo = useCallback(() => {
    setHistory((h) => {
      if (h.future.length === 0) return h;
      const next = h.future[0];
      const newFuture = h.future.slice(1);
      const newPast = [...h.past, stateRef.current].slice(-MAX_HISTORY);
      rawDispatch({ type: 'LOAD_STATE', state: next });
      skipNextSync.current = false;
      return { past: newPast, future: newFuture };
    });
  }, []);

  // ---- Keyboard shortcuts: Ctrl/Cmd+Z (undo), Ctrl/Cmd+Shift+Z or Ctrl+Y (redo) ----
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      const target = e.target as HTMLElement | null;
      // Don't trigger inside form inputs
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (e.key === 'y' || e.key === 'Y') {
        e.preventDefault();
        redo();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  const value = useMemo<StoreContextValue>(
    () => ({
      state,
      dispatch,
      canUndo: history.past.length > 0,
      canRedo: history.future.length > 0,
      undo,
      redo,
      loading,
      syncing,
      isDemo: !isSupabaseConfigured,
    }),
    [state, dispatch, history.past.length, history.future.length, undo, redo, loading, syncing],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}
