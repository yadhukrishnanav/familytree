'use client';

// Family Tree — Main canvas component
// Version: 2026-08-25-v2 (relation picker in PersonForm)
// Renders tree SVG + person cards, pan/zoom (mouse + touch), toolbar, modals, detail panel, export.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Plus,
  Calendar,
  MoreVertical,
  ZoomIn,
  ZoomOut,
  Maximize,
  Download,
  FileText,
  Trash2,
  Pencil,
  Undo2,
  Redo2,
  X,
  Copy,
  Check,
  Heart,
  History,
  RotateCcw,
  Search,
  Cake,
  MessageSquare,
  Users,
  LayoutGrid,
  TreePine,
  Map as MapIcon,
  Upload,
  LogOut,
  Menu as MenuIcon,
  ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import type { FamilyTreeState, Person, TimelineEvent } from '../types';
import { useStore } from '../store';
import { useAuth } from '../auth';
import { deletePhoto } from '../supabase';
import { computeLayout, NODE_WIDTH, NODE_HEIGHT } from '../layout';
import { PersonCard, MarriageBadge } from './PersonCard';
import { PersonForm, type NewRelation } from './PersonForm';
import { EventForm } from './EventForm';
import { Timeline } from './Timeline';
import { ActivityPanel } from './ActivityPanel';
import { PWAInstallButton } from './PWAInstallButton';
import { SearchPalette } from './SearchPalette';
import { BirthdayPanel } from './BirthdayPanel';
import { PhotoGridView } from './PhotoGridView';
import { ChatPanel } from './ChatPanel';
import { FamilySwitcherDialog } from './FamilySwitcherDialog';

// Leaflet touches `window` at import time, so the map MUST be loaded client-side only.
const MapPanel = dynamic(() => import('./MapPanel').then((m) => m.MapPanel), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-sm text-slate-400">
      Loading map…
    </div>
  ),
});
import { MemberManagerDialog } from './MemberManagerDialog';
import { CSVImportDialog } from './CSVImportDialog';
import { FederationPanel } from './FederationPanel';
import { exportToPngFile, exportToPdfFile } from '../export';

type ModalKind = 'add-person' | 'edit-person' | 'add-event' | 'edit-event' | null;

interface CanvasTransform {
  x: number;
  y: number;
  scale: number;
}

const MIN_SCALE = 0.2;
const MAX_SCALE = 3;

export function FamilyTree() {
  const store = useStore();
  const auth = useAuth();
  const { state } = store;

  const [transform, setTransform] = useState<CanvasTransform>({ x: 100, y: 60, scale: 0.8 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalKind>(null);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [editingEvent, setEditingEvent] = useState<TimelineEvent | null>(null);
  const [timelineCollapsed, setTimelineCollapsed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [showHistory, setShowHistory] = useState(false); // person history modal
  const [showSearch, setShowSearch] = useState(false);
  const [showBirthdays, setShowBirthdays] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [showFederation, setShowFederation] = useState(false);
  // Switcher modal: lets the user create a NEW family, JOIN an existing one with
  // a code, or switch between families they already belong to — all without
  // signing out. Previously a registered user with one family was stuck on it.
  const [showFamilySwitcher, setShowFamilySwitcher] = useState(false);
  const WEDDING_DATE = new Date('2026-09-05T00:00:00');
  const [showCelebration, setShowCelebration] = useState(() => new Date() < WEDDING_DATE);
  const [viewMode, setViewMode] = useState<'tree' | 'grid'>('tree');
  // Birthplace map is now a slide-in sidebar (toggled separately from viewMode),
  // so the tree canvas stays visible behind it.
  const [showMap, setShowMap] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null); // for export
  const isPanning = useRef(false);
  const panStart = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const pinchRef = useRef<{ distance: number; scale: number } | null>(null);

  const layout = useMemo(
    () => computeLayout(state.persons, state.familyUnits),
    [state.persons, state.familyUnits],
  );

  const selectedPerson = selectedId ? state.persons[selectedId] ?? null : null;

  // ---- Center on first load ----
  useEffect(() => {
    if (!canvasRef.current || layout.width === 0) return;
    const cw = canvasRef.current.clientWidth;
    const ch = canvasRef.current.clientHeight;
    const targetScale = Math.min(cw / (layout.width + 200), ch / (layout.height + 200), 1);
    const scale = Math.max(MIN_SCALE, targetScale);
    setTransform({
      x: (cw - layout.width * scale) / 2,
      y: 40,
      scale,
    });
     
  }, [Object.keys(state.persons).length, state.familyUnits.length]);

  // ---- Wheel zoom (towards cursor) ----
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    setTransform((t) => {
      const delta = -e.deltaY / 600;
      const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, t.scale * (1 + delta)));
      // Keep cursor point stable: world coords under cursor before = after
      const wx = (mouseX - t.x) / t.scale;
      const wy = (mouseY - t.y) / t.scale;
      return {
        scale: newScale,
        x: mouseX - wx * newScale,
        y: mouseY - wy * newScale,
      };
    });
  }, []);

  // ---- Mouse pan ----
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    // Only pan on empty canvas (not on a person card)
    if ((e.target as HTMLElement).closest('[data-person-card]')) return;
    if (e.button !== 0) return;
    isPanning.current = true;
    panStart.current = { x: e.clientX, y: e.clientY, tx: transform.x, ty: transform.y };
    (e.target as HTMLElement).style.cursor = 'grabbing';
  }, [transform.x, transform.y]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current || !panStart.current) return;
    const dx = e.clientX - panStart.current.x;
    const dy = e.clientY - panStart.current.y;
    setTransform((t) => ({ ...t, x: panStart.current!.tx + dx, y: panStart.current!.ty + dy }));
  }, []);

  const onMouseUp = useCallback(() => {
    isPanning.current = false;
    panStart.current = null;
    if (canvasRef.current) canvasRef.current.style.cursor = 'grab';
  }, []);

  // ---- Touch pan + pinch zoom (mobile) ----
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('[data-person-card]')) return;
    if (e.touches.length === 1) {
      isPanning.current = true;
      const t = e.touches[0];
      panStart.current = { x: t.clientX, y: t.clientY, tx: transform.x, ty: transform.y };
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchRef.current = { distance: Math.hypot(dx, dy), scale: transform.scale };
      isPanning.current = false;
    }
  }, [transform.x, transform.y, transform.scale]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1 && isPanning.current && panStart.current) {
      const t = e.touches[0];
      const dx = t.clientX - panStart.current.x;
      const dy = t.clientY - panStart.current.y;
      setTransform((tr) => ({ ...tr, x: panStart.current!.tx + dx, y: panStart.current!.ty + dy }));
    } else if (e.touches.length === 2 && pinchRef.current) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const ratio = dist / pinchRef.current.distance;
      const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, pinchRef.current.scale * ratio));
      // Zoom around midpoint
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      setTransform((t) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return t;
        const cx = midX - rect.left;
        const cy = midY - rect.top;
        const wx = (cx - t.x) / t.scale;
        const wy = (cy - t.y) / t.scale;
        return { scale: newScale, x: cx - wx * newScale, y: cy - wy * newScale };
      });
    }
  }, []);

  const onTouchEnd = useCallback(() => {
    isPanning.current = false;
    panStart.current = null;
    pinchRef.current = null;
  }, []);

  // ---- Zoom buttons ----
  const zoomIn = useCallback(() => {
    setTransform((t) => {
      const newScale = Math.min(MAX_SCALE, t.scale * 1.2);
      const cx = (canvasRef.current?.clientWidth ?? 800) / 2;
      const cy = (canvasRef.current?.clientHeight ?? 600) / 2;
      const wx = (cx - t.x) / t.scale;
      const wy = (cy - t.y) / t.scale;
      return { scale: newScale, x: cx - wx * newScale, y: cy - wy * newScale };
    });
  }, []);
  const zoomOut = useCallback(() => {
    setTransform((t) => {
      const newScale = Math.max(MIN_SCALE, t.scale / 1.2);
      const cx = (canvasRef.current?.clientWidth ?? 800) / 2;
      const cy = (canvasRef.current?.clientHeight ?? 600) / 2;
      const wx = (cx - t.x) / t.scale;
      const wy = (cy - t.y) / t.scale;
      return { scale: newScale, x: cx - wx * newScale, y: cy - wy * newScale };
    });
  }, []);
  const zoomReset = useCallback(() => {
    if (!canvasRef.current || layout.width === 0) {
      setTransform({ x: 100, y: 60, scale: 0.8 });
      return;
    }
    const cw = canvasRef.current.clientWidth;
    const ch = canvasRef.current.clientHeight;
    const scale = Math.max(MIN_SCALE, Math.min(cw / (layout.width + 200), ch / (layout.height + 200), 1));
    setTransform({ x: (cw - layout.width * scale) / 2, y: 40, scale });
  }, [layout.width, layout.height]);

  // ---- Share code copy ----
  const copyShareCode = useCallback(async () => {
    if (!auth.activeFamily) return;
    try {
      await navigator.clipboard.writeText(auth.activeFamily.shareCode);
      setCopiedCode(true);
      toast.success('Share code copied!', {
        description: `"${auth.activeFamily.shareCode}" is ready to paste.`,
      });
      setTimeout(() => setCopiedCode(false), 1800);
    } catch {
      toast.error('Could not copy to clipboard');
    }
  }, [auth.activeFamily]);

  // ---- Form submission handlers ----
  const handleAddPerson = async (
    person: Person,
    _photoChanged: boolean,
    _oldPhotoUrl?: string,
    relation?: NewRelation,
  ) => {
    setSubmitting(true);
    try {
      store.dispatch({ type: 'ADD_PERSON', person });

      // If the user picked a relationship, link the new person to the target.
      if (relation) {
        if (relation.kind === 'spouse') {
          // Create a family unit: target + new person as spouses
          store.dispatch({
            type: 'ADD_SPOUSE',
            unit: {
              id: crypto.randomUUID(),
              partner1Id: relation.targetPersonId,
              partner2Id: person.id,
              childrenIds: [],
              marriageYear: relation.marriageYear,
            },
          });
          toast.success('Person added', {
            description: `${person.firstName} ${person.lastName ?? ''} added and linked as spouse`,
          });
        } else if (relation.kind === 'child') {
          // New person is CHILD of targetPersonId.
          // Find the target's family unit (where they're a partner). If none exists, create a stub
          // unit with just the target as partner1 so ADD_CHILD can attach to it.
          const parentUnit = state.familyUnits.find(
            (u) => u.partner1Id === relation.targetPersonId || u.partner2Id === relation.targetPersonId,
          );
          if (parentUnit) {
            store.dispatch({
              type: 'ADD_CHILD',
              parentId: relation.targetPersonId,
              childId: person.id,
            });
          } else {
            // Target has no spouse unit — create one with just them, then add child
            const newUnitId = crypto.randomUUID();
            store.dispatch({
              type: 'ADD_SPOUSE',
              unit: {
                id: newUnitId,
                partner1Id: relation.targetPersonId,
                partner2Id: undefined,
                childrenIds: [],
              },
            });
            store.dispatch({
              type: 'ADD_CHILD',
              parentId: relation.targetPersonId,
              childId: person.id,
            });
          }
          toast.success('Person added', {
            description: `${person.firstName} ${person.lastName ?? ''} added as child`,
          });
        } else if (relation.kind === 'parent') {
          // New person is PARENT of targetPersonId.
          // Similar to above — find the target's existing unit (they're a child in it),
          // and either attach the new parent, or create a new unit with the new person as partner1
          // and the target as their child.
          const targetUnit = state.familyUnits.find(
            (u) => u.childrenIds.includes(relation.targetPersonId),
          );
          if (targetUnit) {
            // Target already has a parent unit — add the new person as the second partner if empty,
            // otherwise just attach as a new spouse-less parent (creates a new unit)
            if (!targetUnit.partner2Id) {
              // Fill the empty partner slot — but that requires UPDATE on the unit, which we don't have.
              // Workaround: create a new unit with the new person as partner1 + the target as child.
              store.dispatch({
                type: 'ADD_SPOUSE',
                unit: {
                  id: crypto.randomUUID(),
                  partner1Id: person.id,
                  partner2Id: undefined,
                  childrenIds: [relation.targetPersonId],
                },
              });
            } else {
              // Both partner slots full — create a new unit with just the new parent
              store.dispatch({
                type: 'ADD_SPOUSE',
                unit: {
                  id: crypto.randomUUID(),
                  partner1Id: person.id,
                  partner2Id: undefined,
                  childrenIds: [relation.targetPersonId],
                },
              });
            }
          } else {
            // No existing parent unit for target — create one
            store.dispatch({
              type: 'ADD_SPOUSE',
              unit: {
                id: crypto.randomUUID(),
                partner1Id: person.id,
                partner2Id: undefined,
                childrenIds: [relation.targetPersonId],
              },
            });
          }
          toast.success('Person added', {
            description: `${person.firstName} ${person.lastName ?? ''} added as parent`,
          });
        } else if (relation.kind === 'sibling') {
          // New person is a SIBLING of targetPersonId — share the same parent unit.
          const parentUnit = state.familyUnits.find(
            (u) => u.childrenIds.includes(relation.targetPersonId),
          );
          if (parentUnit) {
            store.dispatch({
              type: 'ADD_SIBLING',
              targetId: relation.targetPersonId,
              siblingId: person.id,
            });
            toast.success('Person added', {
              description: `${person.firstName} ${person.lastName ?? ''} added as sibling`,
            });
          } else {
            // Target has no parent unit yet — sibling can't be linked.
            toast('Person added (standalone)', {
              description: `We couldn't find parents for ${state.persons[relation.targetPersonId]?.firstName ?? 'the target'}. Add a parent first to keep siblings at the same generation level.`,
            });
          }
        }
      } else {
        toast.success('Person added', { description: `${person.firstName} ${person.lastName ?? ''}` });
      }
      setModal(null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdatePerson = async (person: Person) => {
    setSubmitting(true);
    try {
      store.dispatch({ type: 'UPDATE_PERSON', person });
      toast.success('Person updated');
      setModal(null);
      setEditingPerson(null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePerson = async (personId: string) => {
    const p = state.persons[personId];
    if (!p) return;
    if (!confirm(`Delete ${p.firstName} ${p.lastName ?? ''}? This will also remove their photo and auto-events. Can be undone with Ctrl/Cmd+Z.`)) return;
    // Delete photo from storage BEFORE removing the person (URL is gone after dispatch)
    if (p.photoUrl) {
      deletePhoto(p.photoUrl).catch(() => { /* ignore — might already be gone */ });
    }
    // Also delete photos on this person's auto-events (which DELETE_PERSON will purge)
    for (const ev of state.timelineEvents) {
      if (ev.photoUrl && ev.personIds.includes(personId) && ev.id.startsWith('auto_')) {
        deletePhoto(ev.photoUrl).catch(() => {});
      }
    }
    store.dispatch({ type: 'DELETE_PERSON', personId });
    if (selectedId === personId) setSelectedId(null);
    toast.success('Person removed', { description: `${p.firstName} ${p.lastName ?? ''}` });
  };

  const handleAddEvent = async (event: TimelineEvent) => {
    setSubmitting(true);
    try {
      store.dispatch({ type: 'ADD_EVENT', event });
      toast.success('Event added', { description: event.title });
      setModal(null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateEvent = async (event: TimelineEvent) => {
    setSubmitting(true);
    try {
      store.dispatch({ type: 'UPDATE_EVENT', event });
      toast.success('Event updated');
      setModal(null);
      setEditingEvent(null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEvent = (eventId: string) => {
    const ev = state.timelineEvents.find((e) => e.id === eventId);
    // Best-effort delete the event's photo from storage
    if (ev?.photoUrl) {
      deletePhoto(ev.photoUrl).catch(() => {});
    }
    store.dispatch({ type: 'DELETE_EVENT', eventId });
    toast.success('Event removed');
  };

  // ---- Export handlers ----
  const handleExportPng = async () => {
    if (!contentRef.current) return;
    toast.info('Generating PNG...');
    try {
      await exportToPngFile(contentRef.current, `family-tree-${auth.activeFamily?.name ?? 'export'}.png`);
      toast.success('PNG exported');
    } catch (e: any) {
      toast.error('Export failed', { description: e.message });
    }
  };
  const handleExportPdf = async () => {
    if (!contentRef.current) return;
    toast.info('Generating PDF...');
    try {
      await exportToPdfFile(contentRef.current, `family-tree-${auth.activeFamily?.name ?? 'export'}.pdf`);
      toast.success('PDF exported');
    } catch (e: any) {
      toast.error('Export failed', { description: e.message });
    }
  };

  // Keyboard shortcut: Ctrl/Cmd+K to open search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      if (e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        setShowSearch(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const personsArray = useMemo(() => Object.values(state.persons), [state.persons]);

  return (
    <div className="flex h-screen flex-col bg-gradient-to-br from-stone-50 via-white to-emerald-50/40">
      {/* ---- Header ---- */}
      <header className="flex items-center justify-between border-b border-slate-200/80 bg-white/70 px-3 py-2.5 backdrop-blur-xl sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/30">
            <span className="text-xs font-bold">FT</span>
            <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-green-400 ring-2 ring-white" />
          </div>
          {/* Clickable family name — opens the switcher (create / join / switch) */}
          <button
            type="button"
            onClick={() => setShowFamilySwitcher(true)}
            className="group flex min-w-0 items-center gap-1 rounded-md px-1 py-0.5 text-left transition hover:bg-slate-100"
            title="Switch family, or create / join another"
          >
            <div className="min-w-0">
              <div className="truncate text-[15px] font-semibold leading-tight text-slate-800 group-hover:text-slate-900">
                {auth.activeFamily?.name ?? 'Family Tree'}
              </div>
              <div className="hidden items-center gap-1 text-[10px] text-slate-400 sm:flex">
                <span className={`h-1.5 w-1.5 rounded-full ${store.syncing ? 'bg-amber-400' : 'bg-green-400'}`} />
                {store.isDemo ? 'Demo mode (local)' : store.syncing ? 'Syncing…' : 'Synced'}
                {auth.families.length > 1 && (
                  <span className="ml-1 text-slate-400">· {auth.families.length} families</span>
                )}
              </div>
            </div>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400 transition group-hover:text-slate-600" />
          </button>
        </div>

        {/* Share code with copy button — premium pill */}
        {auth.activeFamily && (
          <button
            onClick={copyShareCode}
            className="hidden items-center gap-2 rounded-full border border-emerald-200/60 bg-gradient-to-r from-emerald-50 to-teal-50 px-3 py-1.5 text-xs shadow-sm transition hover:shadow-md hover:from-emerald-100 hover:to-teal-100 sm:flex"
            title="Click to copy share code"
          >
            <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">Share</span>
            <code className="font-mono text-[13px] font-bold tracking-wider text-emerald-700">
              {auth.activeFamily.shareCode}
            </code>
            {copiedCode ? (
              <Check className="h-3.5 w-3.5 text-green-600" />
            ) : (
              <Copy className="h-3.5 w-3.5 text-emerald-400" />
            )}
          </button>
        )}

        {/* Mobile share code button */}
        {auth.activeFamily && (
          <button
            onClick={copyShareCode}
            className="rounded-full bg-gradient-to-r from-emerald-50 to-teal-50 px-2.5 py-1 font-mono text-xs font-bold text-emerald-700 ring-1 ring-emerald-200 sm:hidden"
            title="Tap to copy share code"
          >
            {auth.activeFamily.shareCode}
          </button>
        )}

        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowActivity(true)}
            title="Recent activity"
            className="h-8 w-8 p-0"
          >
            <History className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={store.undo}
            disabled={!store.canUndo}
            title="Undo (Ctrl/Cmd+Z)"
            className="h-8 w-8 p-0"
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={store.redo}
            disabled={!store.canRedo}
            title="Redo (Ctrl/Cmd+Shift+Z)"
            className="h-8 w-8 p-0"
          >
            <Redo2 className="h-4 w-4" />
          </Button>
          </div>
      </header>

      {/* ---- Toolbar ---- */}
      <div className="flex items-center gap-1.5 border-b border-slate-200/80 bg-white/60 px-3 py-2 backdrop-blur-xl sm:gap-2 sm:px-5">
        <Button
          size="sm"
          onClick={() => { setEditingPerson(null); setModal('add-person'); }}
          className="gap-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-3 shadow-md shadow-emerald-500/25 hover:from-emerald-700 hover:to-teal-700 hover:shadow-lg"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Add Person</span>
          <span className="sm:hidden">Person</span>
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => { setEditingEvent(null); setModal('add-event'); }}
          className="gap-1.5 rounded-lg border-slate-300 bg-white/80 hover:bg-white"
        >
          <Calendar className="h-4 w-4" />
          <span className="hidden sm:inline">Event</span>
        </Button>

        {/* Divider */}
        <div className="mx-1 hidden h-5 w-px bg-slate-200 sm:block" />

        {/* Search (Ctrl/Cmd+K) */}
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowSearch(true)}
          className="gap-1.5 rounded-lg border-slate-300 bg-white/80 hover:bg-white"
          title="Search (Ctrl/Cmd+K)"
        >
          <Search className="h-4 w-4" />
          <span className="hidden md:inline">Search</span>
        </Button>

        {/* View toggle: tree / grid */}
        <div className="flex rounded-lg border border-slate-300 bg-white/80 p-0.5">
          <button
            onClick={() => setViewMode('tree')}
            className={`flex h-7 w-7 items-center justify-center rounded-md text-xs transition ${viewMode === 'tree' ? 'bg-slate-200 text-slate-700' : 'text-slate-500 hover:bg-slate-50'}`}
            title="Tree view"
          >
            <TreePine className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`flex h-7 w-7 items-center justify-center rounded-md text-xs transition ${viewMode === 'grid' ? 'bg-slate-200 text-slate-700' : 'text-slate-500 hover:bg-slate-50'}`}
            title="Photo grid view"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Birthdays */}
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowBirthdays((v) => !v)}
          className={`gap-1.5 rounded-lg border-slate-300 bg-white/80 hover:bg-white ${showBirthdays ? 'ring-2 ring-slate-300' : ''}`}
          title="Birthdays"
        >
          <Cake className="h-4 w-4 text-slate-500" />
        </Button>

        {/* Birthplace map sidebar */}
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowMap((v) => !v)}
          className={`gap-1.5 rounded-lg border-slate-300 bg-white/80 hover:bg-white ${showMap ? 'ring-2 ring-slate-300' : ''}`}
          title="Family birthplace map"
        >
          <MapIcon className="h-4 w-4 text-slate-500" />
        </Button>

        {/* Chat */}
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowChat(true)}
          className="gap-1.5 rounded-lg border-slate-300 bg-white/80 hover:bg-white"
          title="Family chat"
        >
          <MessageSquare className="h-4 w-4 text-slate-500" />
        </Button>

        <div className="flex-1" />

        {/* Install app */}
        <PWAInstallButton />

        {/* More menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={handleExportPng}>
              <Download className="mr-2 h-3.5 w-3.5" />
              Export PNG
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportPdf}>
              <FileText className="mr-2 h-3.5 w-3.5" />
              Export PDF
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setShowCsvImport(true)}>
              <Upload className="mr-2 h-3.5 w-3.5" />
              Import from CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShowMembers(true)}>
              <Users className="mr-2 h-3.5 w-3.5" />
              Manage members
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShowFamilySwitcher(true)}>
              <TreePine className="mr-2 h-3.5 w-3.5" />
              Switch / create / join family
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShowFederation(true)}>
              <TreePine className="mr-2 h-3.5 w-3.5" />
              Linked families
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => { if (confirm('Sign out of Family Tree? You can sign back in with the same email.')) auth.signOut(); }} className="text-red-600 focus:text-red-700">
              <LogOut className="mr-2 h-3.5 w-3.5" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ---- Canvas (main area) ---- */}
      <div className="relative flex-1 overflow-hidden bg-slate-50">
      {viewMode === 'grid' ? (
        <PhotoGridView
          persons={state.persons}
          onSelectPerson={(id) => { setSelectedId(id); setViewMode('tree'); }}
        />
      ) : (
        <>
        {/* Dot grid background */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(circle, rgba(148, 163, 184, 0.35) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
            backgroundPosition: '0 0',
          }}
          aria-hidden
        />

        {/* Gradient ambient glow */}
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              'radial-gradient(ellipse 600px 400px at 30% 20%, rgba(168, 85, 247, 0.06), transparent), radial-gradient(ellipse 500px 300px at 80% 80%, rgba(245, 158, 11, 0.05), transparent)',
          }}
          aria-hidden
        />

        {store.loading ? (
          <div className="relative flex h-full items-center justify-center text-slate-400">Loading…</div>
        ) : Object.keys(state.persons).length === 0 ? (
          <EmptyState onAdd={() => { setEditingPerson(null); setModal('add-person'); }} />
        ) : (
          <div
            ref={canvasRef}
            className="relative h-full w-full touch-none select-none overflow-hidden"
            style={{ cursor: 'grab' }}
            onWheel={onWheel}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            <div
              ref={contentRef}
              className="absolute left-0 top-0"
              style={{
                transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                transformOrigin: '0 0',
                width: layout.width + 100,
                height: layout.height + 100,
              }}
            >
              {/* Subtle horizontal generation guide lines.
                  One per distinct generation Y, drawn behind everything else.
                  Helps the eye see "everyone on this row is the same generation". */}
              <svg
                className="absolute left-0 top-0 pointer-events-none"
                width={layout.width + 100}
                height={layout.height + 100}
                aria-hidden
              >
                {(() => {
                  // Collect distinct Y positions of node tops, sorted.
                  const ys = Array.from(
                    new Set(layout.nodes.map((n) => n.y).filter((y) => typeof y === 'number')),
                  ).sort((a, b) => a - b);
                  return ys.map((y, i) => (
                    <g key={`gen-line-${i}`}>
                      {/* Faint label band at left edge */}
                      <line
                        x1={0}
                        y1={y - 8}
                        x2={layout.width + 100}
                        y2={y - 8}
                        stroke="rgba(148, 163, 184, 0.18)"
                        strokeWidth={1}
                        strokeDasharray="2 6"
                        strokeLinecap="round"
                      />
                    </g>
                  ));
                })()}
              </svg>

              {/* SVG for connections */}
              <svg
                className="absolute left-0 top-0 pointer-events-none"
                width={layout.width + 100}
                height={layout.height + 100}
              >
                <defs>
                  <linearGradient id="grad-marriage" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#ec4899" />
                    <stop offset="100%" stopColor="#f43f5e" />
                  </linearGradient>
                  <linearGradient id="grad-parent" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#cbd5e1" />
                    <stop offset="100%" stopColor="#94a3b8" />
                  </linearGradient>
                </defs>
                {layout.connections.map((c, i) => {
                  if (c.type === 'marriage') {
                    // Marriage: dashed green line with subtle thickness
                    return (
                      <line
                        key={i}
                        x1={c.fromX}
                        y1={c.fromY}
                        x2={c.toX}
                        y2={c.toY}
                        stroke="url(#grad-marriage)"
                        strokeWidth={2.5}
                        strokeDasharray="6 4"
                        strokeLinecap="round"
                      />
                    );
                  }
                  if (c.type === 'junction') {
                    // Junction bar (horizontal across siblings OR vertical drop from couple)
                    return (
                      <line
                        key={i}
                        x1={c.fromX}
                        y1={c.fromY}
                        x2={c.toX}
                        y2={c.toY}
                        stroke="#94a3b8"
                        strokeWidth={2}
                        strokeLinecap="round"
                      />
                    );
                  }
                  // Parent-child: subtle Bezier curve
                  const midY = (c.fromY + c.toY) / 2;
                  return (
                    <path
                      key={i}
                      d={`M ${c.fromX} ${c.fromY} C ${c.fromX} ${midY}, ${c.toX} ${midY}, ${c.toX} ${c.toY}`}
                      fill="none"
                      stroke="url(#grad-parent)"
                      strokeWidth={2}
                      strokeLinecap="round"
                    />
                  );
                })}
              </svg>

              {/* Marriage badges */}
              {layout.connections
                .filter((c) => c.type === 'marriage' && c.marriageYear != null)
                .map((c, i) => (
                  <MarriageBadge
                    key={`mb-${i}`}
                    x={(c.fromX + c.toX) / 2}
                    y={c.fromY}
                    year={c.marriageYear}
                  />
                ))}

              {/* Person cards */}
              {layout.nodes.map((node) => {
                if (!node.personId) return null;
                const person = state.persons[node.personId];
                if (!person) return null;
                return (
                  <div key={node.id} data-person-card>
                    <PersonCard
                      person={person}
                      x={node.x}
                      y={node.y}
                      generation={node.generation}
                      selected={selectedId === node.personId}
                      onClick={() => setSelectedId(node.personId!)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Zoom controls (above timeline if visible) */}
        <div className="absolute right-3 bottom-3 z-40 flex flex-col gap-0.5 rounded-xl bg-white/80 p-1 shadow-lg ring-1 ring-slate-200/80 backdrop-blur-md">
          <Button size="sm" variant="ghost" onClick={zoomIn} aria-label="Zoom in" className="h-8 w-8 p-0 hover:bg-slate-100">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <div className="py-0.5 text-center text-[10px] font-mono font-semibold text-slate-500">
            {Math.round(transform.scale * 100)}%
          </div>
          <Button size="sm" variant="ghost" onClick={zoomOut} aria-label="Zoom out" className="h-8 w-8 p-0 hover:bg-slate-100">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <div className="my-0.5 h-px bg-slate-200" />
          <Button size="sm" variant="ghost" onClick={zoomReset} aria-label="Reset zoom" className="h-8 w-8 p-0 hover:bg-slate-100">
            <Maximize className="h-4 w-4" />
          </Button>
        </div>

        {/* Detail panel (right) */}
        {selectedPerson && (
          <DetailPanel
            person={selectedPerson}
            state={state}
            onClose={() => setSelectedId(null)}
            onEdit={() => { setEditingPerson(selectedPerson); setModal('edit-person'); }}
            onDelete={() => handleDeletePerson(selectedPerson.id)}
            onShowHistory={() => setShowHistory(true)}
          />
        )}
        </>
      )}
      </div>

      {/* ---- Timeline ---- */}
      <Timeline
        events={state.timelineEvents}
        persons={state.persons}
        collapsed={timelineCollapsed}
        onToggle={() => setTimelineCollapsed((v) => !v)}
        onSelectEvent={(ev) => { setEditingEvent(ev); setModal('edit-event'); }}
        onDeleteEvent={handleDeleteEvent}
      />

      {/* Footnote */}
      <div className="border-t border-slate-100 bg-white/50 px-4 py-2.5 text-center text-[16px] font-bold text-slate-900">
        Built with &#10084; by one among us
      </div>

      {/* Celebration overlay (until Sep 4, 2026) */}
      {showCelebration && (
        <CelebrationOverlay onClose={() => setShowCelebration(false)} />
      )}

      {/* ---- Modals ---- */}
      <Dialog open={modal === 'add-person' || modal === 'edit-person'} onOpenChange={(o) => { if (!o) { setModal(null); setEditingPerson(null); } }}>
        <DialogContent className="max-h-[85vh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPerson ? 'Edit person' : 'Add person'}</DialogTitle>
          </DialogHeader>
          {auth.activeFamily && (
            <PersonForm
              initial={editingPerson ?? undefined}
              familyId={auth.activeFamily.id}
              existingPersons={editingPerson ? undefined : personsArray}
              onSubmit={editingPerson ? handleUpdatePerson : handleAddPerson}
              onCancel={() => { setModal(null); setEditingPerson(null); }}
              submitting={submitting}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={modal === 'add-event' || modal === 'edit-event'} onOpenChange={(o) => { if (!o) { setModal(null); setEditingEvent(null); } }}>
        <DialogContent className="max-h-[85vh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEvent ? 'Edit event' : 'Add event'}</DialogTitle>
          </DialogHeader>
          {auth.activeFamily && (
            <EventForm
              initial={editingEvent ?? undefined}
              familyId={auth.activeFamily.id}
              persons={personsArray}
              onSubmit={editingEvent ? handleUpdateEvent : handleAddEvent}
              onCancel={() => { setModal(null); setEditingEvent(null); }}
              submitting={submitting}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Person edit history (audit log) */}
      {selectedPerson && (
        <PersonHistoryDialog
          open={showHistory}
          onOpenChange={setShowHistory}
          familyId={auth.activeFamily!.id}
          person={selectedPerson}
          onRevert={(person) => {
            store.dispatch({ type: 'UPDATE_PERSON', person });
            setShowHistory(false);
          }}
        />
      )}

      {/* Recent activity panel (slide-in) */}
      {showActivity && auth.activeFamily && (
        <ActivityPanel
          familyId={auth.activeFamily.id}
          onClose={() => setShowActivity(false)}
          onRevert={(action) => store.dispatch(action)}
        />
      )}

      {/* Search palette (Ctrl/Cmd+K) */}
      <SearchPalette
        open={showSearch}
        onOpenChange={setShowSearch}
        persons={state.persons}
        onSelectPerson={(id) => {
          setSelectedId(id);
          setViewMode('tree');
        }}
      />

      {/* Birthday panel */}
      {showBirthdays && (
        <BirthdayPanel
          persons={state.persons}
          onClose={() => setShowBirthdays(false)}
          onSelectPerson={(id) => {
            setSelectedId(id);
            setShowBirthdays(false);
            setViewMode('tree');
          }}
        />
      )}

      {/* Birthplace map sidebar — slide-in panel showing every family member's
          birthPlace as a pin on OpenStreetMap (Nominatim geocoding, cached). */}
      {showMap && (
        <MapPanel
          persons={state.persons}
          selectedId={selectedId}
          onSelectPerson={(id) => {
            setSelectedId(id);
            // Keep the sidebar open so the user can hop between pins;
            // if they're in grid view, snap back to tree so the card is visible.
            if (viewMode === 'grid') setViewMode('tree');
          }}
          onClose={() => setShowMap(false)}
        />
      )}

      {/* Family chat panel */}
      {showChat && auth.activeFamily && (
        <ChatPanel
          familyId={auth.activeFamily.id}
          onClose={() => setShowChat(false)}
        />
      )}

      {/* Member manager dialog */}
      {auth.activeFamily && (
        <MemberManagerDialog
          open={showMembers}
          onOpenChange={setShowMembers}
          familyId={auth.activeFamily.id}
        />
      )}

      {/* CSV import dialog */}
      <CSVImportDialog
        open={showCsvImport}
        onOpenChange={setShowCsvImport}
        onImport={(persons) => {
          for (const p of persons) {
            store.dispatch({ type: 'ADD_PERSON', person: p });
          }
        }}
      />

      {/* Federation (linked families) panel */}
      {showFederation && auth.activeFamily && (
        <FederationPanel
          familyId={auth.activeFamily.id}
          onClose={() => setShowFederation(false)}
        />
      )}

      {/* Family switcher (create / join / switch between this user's families) */}
      <FamilySwitcherDialog
        open={showFamilySwitcher}
        onClose={() => setShowFamilySwitcher(false)}
        auth={auth}
      />
    </div>
  );
}

// ---------- Celebration overlay (until Sep 4, 2026) ----------
function CelebrationOverlay({ onClose }: { onClose: () => void }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 500);
    }, 10000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center transition-opacity duration-500 ${visible ? 'opacity-100' : 'opacity-0'}`}>
      <div className="absolute inset-0 bg-emerald-900/80 backdrop-blur-md" onClick={onClose} />
      <div className="absolute inset-0 opacity-30 bg-cover bg-center" style={{ backgroundImage: 'url(/wedding-invite.jpg)', filter: 'blur(8px) saturate(1.2)', transform: 'scale(1.1)' }} />
      <div className="absolute inset-0 bg-gradient-to-t from-emerald-900/90 via-emerald-900/50 to-emerald-900/80" />
      <div className="relative z-10 mx-4 flex max-w-md flex-col items-center text-center">
        <div className="mb-4 overflow-hidden rounded-2xl shadow-2xl ring-2 ring-white/30" style={{ maxWidth: 200 }}>
          <img src="/wedding-invite.jpg" alt="Wedding invitation" className="w-full h-auto" />
        </div>
        <div className="mb-3 text-4xl animate-bounce">💍</div>
        <h2 className="mb-1 text-2xl font-bold text-white sm:text-3xl">
          As we gather for
        </h2>
        <h2 className="mb-3 text-3xl font-bold sm:text-4xl">
          <span className="bg-gradient-to-r from-amber-300 to-yellow-200 bg-clip-text text-transparent whitespace-nowrap">Anu&apos;s Wedding</span> 💐
        </h2>
        <p className="mb-1 text-base text-emerald-100 sm:text-lg">31st August 2026 · Wasava Cliff House, Kannur</p>
        <p className="mb-5 text-base text-emerald-100 sm:text-lg">let&apos;s map our roots and celebrate where we all come from. Add your branch to the family tree! 🌳</p>
        <button onClick={onClose} className="rounded-full bg-white px-8 py-3 text-base font-bold text-emerald-700 shadow-xl transition hover:scale-105 hover:bg-emerald-50">Let&apos;s begin 🌿</button>
        <p className="mt-4 text-xs text-emerald-300/60">(This message will disappear shortly)</p>
      </div>
      <button onClick={onClose} className="absolute right-4 top-4 z-20 rounded-full bg-white/20 p-2 text-white backdrop-blur-sm transition hover:bg-white/30" aria-label="Close"><X className="h-5 w-5" /></button>
    </div>
  );
}

// ---------- Detail panel ----------
function DetailPanel({
  person,
  state,
  onClose,
  onEdit,
  onDelete,
  onShowHistory,
}: {
  person: Person;
  state: FamilyTreeState;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onShowHistory: () => void;
}) {
  const related = state.familyUnits.filter(
    (u) => u.partner1Id === person.id || u.partner2Id === person.id || u.childrenIds.includes(person.id),
  );
  const parents = state.familyUnits.find((u) => u.childrenIds.includes(person.id));
  const spouse = related.find((u) => u.partner1Id === person.id || u.partner2Id === person.id);
  const spouseId = spouse?.partner1Id === person.id ? spouse?.partner2Id : spouse?.partner1Id;
  const children = related.flatMap((u) =>
    (u.partner1Id === person.id || u.partner2Id === person.id) ? u.childrenIds : [],
  );
  const parentsList = parents ? [parents.partner1Id, parents.partner2Id].filter(Boolean) as string[] : [];

  return (
    <div className="absolute right-3 top-3 z-50 w-80 overflow-hidden rounded-2xl bg-white/95 shadow-2xl ring-1 ring-slate-200/80 backdrop-blur-xl">
      {/* Gradient header strip */}
      <div
        className="h-1.5"
        style={{ background: `linear-gradient(to right, ${person.avatarColors[0]}, ${person.avatarColors[1]})` }}
      />

      <div className="p-4">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div
              className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl shadow-md ring-2 ring-white"
              style={{ background: `linear-gradient(135deg, ${person.avatarColors[0]}, ${person.avatarColors[1]})` }}
            >
              {person.photoUrl ? (
                 
                <img src={person.photoUrl} alt={person.firstName} className="h-full w-full object-cover" crossOrigin="anonymous" />
              ) : (
                <span className="text-xl font-bold text-white drop-shadow-sm">
                  {(person.firstName[0] + (person.lastName?.[0] ?? '')).toUpperCase()}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <div className="truncate text-base font-semibold text-slate-800">
                {person.firstName} {person.lastName ?? ''}
              </div>
              <div
                className="mt-0.5 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                style={{
                  // Always slate — no emerald accent on living persons (per user request).
                  // Deceased uses slightly darker slate for distinction.
                  background: person.deathYear != null ? 'rgba(100,116,139,0.14)' : 'rgba(148,163,184,0.18)',
                  color: person.deathYear != null ? '#475569' : '#64748b',
                }}
              >
                {person.birthYear ?? '?'} – {person.deathYear ?? 'present'}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        <dl className="space-y-1.5 rounded-lg bg-slate-50/80 p-3 text-sm">
          {person.occupation && (
            <div className="flex justify-between gap-2">
              <dt className="text-slate-400">Occupation</dt>
              <dd className="text-right font-medium text-slate-700">{person.occupation}</dd>
            </div>
          )}
          {person.birthPlace && (
            <div className="flex justify-between gap-2">
              <dt className="text-slate-400">Born in</dt>
              <dd className="text-right font-medium text-slate-700">{person.birthPlace}</dd>
            </div>
          )}
          {spouseId && state.persons[spouseId] && (
            <div className="flex justify-between gap-2">
              <dt className="flex items-center gap-1 text-slate-400">
                <Heart className="h-3 w-3" /> Spouse
              </dt>
              <dd className="text-right font-medium text-slate-700">
                {state.persons[spouseId].firstName} {state.persons[spouseId].lastName ?? ''}
              </dd>
            </div>
          )}
          {parentsList.length > 0 && (
            <div className="flex justify-between gap-2">
              <dt className="text-slate-400">Parents</dt>
              <dd className="text-right font-medium text-slate-700">
                {parentsList.map((pid) => state.persons[pid]).filter(Boolean).map((p) => `${p.firstName} ${p.lastName ?? ''}`).join(', ')}
              </dd>
            </div>
          )}
          {children.length > 0 && (
            <div className="flex justify-between gap-2">
              <dt className="text-slate-400">Children ({children.length})</dt>
              <dd className="text-right font-medium text-slate-700">
                {children.map((pid) => state.persons[pid]).filter(Boolean).map((p) => `${p.firstName} ${p.lastName ?? ''}`).join(', ')}
              </dd>
            </div>
          )}
        </dl>

        <div className="mt-3 flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onEdit}
            className="flex-1 rounded-lg border-slate-300 hover:bg-slate-50"
          >
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            Edit
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onShowHistory}
            title="Edit history"
            className="rounded-lg border-slate-300 hover:bg-slate-50"
          >
            <History className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onDelete}
            className="rounded-lg border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------- Empty state ----------
function EmptyState({ onAdd }: { onAdd: () => void }) {
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

// ---------- Person edit history dialog ----------
import {
  fetchEntityHistory,
  describeActivity,
  timeAgo,
  type ActivityLogEntry,
} from '../activity';

function PersonHistoryDialog({
  open,
  onOpenChange,
  familyId,
  person,
  onRevert,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  familyId: string;
  person: Person;
  onRevert: (person: Person) => void;
}) {
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
