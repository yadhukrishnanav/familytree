'use client';

// Family Tree — Main canvas component
// Renders tree SVG + person cards, pan/zoom (mouse + touch), toolbar, modals, detail panel, export.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  Link2,
  Calendar,
  MoreVertical,
  ZoomIn,
  ZoomOut,
  Maximize,
  Download,
  FileText,
  Sparkles,
  Trash2,
  Pencil,
  Undo2,
  Redo2,
  X,
  Copy,
  Check,
  Heart,
  Menu as MenuIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import type { FamilyTreeState, Person, TimelineEvent } from '../types';
import { useStore } from '../store';
import { useAuth } from '../auth';
import { computeLayout, NODE_WIDTH, NODE_HEIGHT } from '../layout';
import { PersonCard, MarriageBadge } from './PersonCard';
import { PersonForm } from './PersonForm';
import { RelationshipForm } from './RelationshipForm';
import { EventForm } from './EventForm';
import { Timeline } from './Timeline';
import { exportToPngFile, exportToPdfFile } from '../export';

type ModalKind = 'add-person' | 'edit-person' | 'add-relationship' | 'add-event' | 'edit-event' | null;

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
  const handleAddPerson = async (person: Person) => {
    setSubmitting(true);
    try {
      store.dispatch({ type: 'ADD_PERSON', person });
      toast.success('Person added', { description: `${person.firstName} ${person.lastName ?? ''}` });
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

  const handleDeletePerson = (personId: string) => {
    const p = state.persons[personId];
    store.dispatch({ type: 'DELETE_PERSON', personId });
    if (selectedId === personId) setSelectedId(null);
    toast.success('Person removed', { description: p ? `${p.firstName} ${p.lastName ?? ''}` : undefined });
  };

  const handleAddRelationship = async (
    action: { type: 'spouse'; unit: import('../types').FamilyUnit } | { type: 'parent-child'; parentId: string; childId: string },
  ) => {
    setSubmitting(true);
    try {
      if (action.type === 'spouse') {
        store.dispatch({ type: 'ADD_SPOUSE', unit: action.unit });
        toast.success('Spouses linked');
      } else {
        store.dispatch({ type: 'ADD_CHILD', parentId: action.parentId, childId: action.childId });
        toast.success('Parent-child link added');
      }
      setModal(null);
    } finally {
      setSubmitting(false);
    }
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

  const handleLoadSample = () => {
    if (Object.keys(state.persons).length > 0) {
      if (!confirm('Replace current tree with sample data? This can be undone with Ctrl/Cmd+Z.')) return;
    }
    store.dispatch({ type: 'LOAD_SAMPLE' });
    toast.success('Sample family loaded');
  };
  const handleClearAll = () => {
    if (Object.keys(state.persons).length === 0) {
      toast.info('Tree is already empty');
      return;
    }
    if (!confirm('Clear all persons, relationships, and events? This can be undone with Ctrl/Cmd+Z.')) return;
    store.dispatch({ type: 'CLEAR_ALL' });
    setSelectedId(null);
    toast.success('Tree cleared');
  };

  const personsArray = useMemo(() => Object.values(state.persons), [state.persons]);

  return (
    <div className="flex h-screen flex-col bg-gradient-to-br from-slate-50 via-white to-purple-50/40">
      {/* ---- Header ---- */}
      <header className="flex items-center justify-between border-b border-slate-200/80 bg-white/70 px-3 py-2.5 backdrop-blur-xl sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 via-pink-500 to-amber-500 text-white shadow-md shadow-purple-500/30">
            <span className="text-xs font-bold">FT</span>
            <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-green-400 ring-2 ring-white" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold leading-tight text-slate-800">
              {auth.activeFamily?.name ?? 'Family Tree'}
            </div>
            <div className="hidden items-center gap-1 text-[10px] text-slate-400 sm:flex">
              <span className={`h-1.5 w-1.5 rounded-full ${store.syncing ? 'bg-amber-400' : 'bg-green-400'}`} />
              {store.isDemo ? 'Demo mode (local)' : store.syncing ? 'Syncing…' : 'Synced'}
            </div>
          </div>
        </div>

        {/* Share code with copy button — premium pill */}
        {auth.activeFamily && (
          <button
            onClick={copyShareCode}
            className="hidden items-center gap-2 rounded-full border border-purple-200/60 bg-gradient-to-r from-purple-50 to-pink-50 px-3 py-1.5 text-xs shadow-sm transition hover:shadow-md hover:from-purple-100 hover:to-pink-100 sm:flex"
            title="Click to copy share code"
          >
            <span className="text-[10px] font-semibold uppercase tracking-wider text-purple-400">Share</span>
            <code className="font-mono text-[13px] font-bold tracking-wider text-purple-700">
              {auth.activeFamily.shareCode}
            </code>
            {copiedCode ? (
              <Check className="h-3.5 w-3.5 text-green-600" />
            ) : (
              <Copy className="h-3.5 w-3.5 text-purple-400" />
            )}
          </button>
        )}

        {/* Mobile share code button */}
        {auth.activeFamily && (
          <button
            onClick={copyShareCode}
            className="rounded-full bg-gradient-to-r from-purple-50 to-pink-50 px-2.5 py-1 font-mono text-xs font-bold text-purple-700 ring-1 ring-purple-200 sm:hidden"
            title="Tap to copy share code"
          >
            {auth.activeFamily.shareCode}
          </button>
        )}

        <div className="flex items-center gap-0.5">
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
          className="gap-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-3 shadow-md shadow-purple-500/25 hover:from-purple-700 hover:to-pink-700 hover:shadow-lg"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Add Person</span>
          <span className="sm:hidden">Person</span>
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setModal('add-relationship')}
          disabled={personsArray.length < 2}
          className="gap-1.5 rounded-lg border-slate-300 bg-white/80 hover:bg-white"
        >
          <Link2 className="h-4 w-4" />
          <span className="hidden sm:inline">Link</span>
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

        <div className="flex-1" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={handleExportPng}>
              <Download className="mr-2 h-3.5 w-3.5" />
              Export PNG
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportPdf}>
              <FileText className="mr-2 h-3.5 w-3.5" />
              Export PDF
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLoadSample}>
              <Sparkles className="mr-2 h-3.5 w-3.5" />
              Load sample family
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleClearAll} className="text-red-600 focus:text-red-700">
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              Clear all
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ---- Canvas (main area) ---- */}
      <div className="relative flex-1 overflow-hidden bg-slate-50">
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
          <EmptyState onAdd={() => { setEditingPerson(null); setModal('add-person'); }} onLoadSample={handleLoadSample} />
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
                    // Marriage: dashed pink line with subtle thickness
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
          />
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

      {/* ---- Modals ---- */}
      <Dialog open={modal === 'add-person' || modal === 'edit-person'} onOpenChange={(o) => { if (!o) { setModal(null); setEditingPerson(null); } }}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPerson ? 'Edit person' : 'Add person'}</DialogTitle>
          </DialogHeader>
          {auth.activeFamily && (
            <PersonForm
              initial={editingPerson ?? undefined}
              familyId={auth.activeFamily.id}
              onSubmit={editingPerson ? handleUpdatePerson : handleAddPerson}
              onCancel={() => { setModal(null); setEditingPerson(null); }}
              submitting={submitting}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={modal === 'add-relationship'} onOpenChange={(o) => { if (!o) setModal(null); }}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add relationship</DialogTitle>
          </DialogHeader>
          <RelationshipForm
            persons={personsArray}
            anchorPersonId={selectedId ?? undefined}
            onSubmit={handleAddRelationship}
            onCancel={() => setModal(null)}
            submitting={submitting}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={modal === 'add-event' || modal === 'edit-event'} onOpenChange={(o) => { if (!o) { setModal(null); setEditingEvent(null); } }}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
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
}: {
  person: Person;
  state: FamilyTreeState;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
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
                  background: person.deathYear != null ? 'rgba(100,116,139,0.12)' : 'rgba(16,185,129,0.12)',
                  color: person.deathYear != null ? '#475569' : '#059669',
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
function EmptyState({ onAdd, onLoadSample }: { onAdd: () => void; onLoadSample: () => void }) {
  return (
    <div className="relative flex h-full items-center justify-center p-6">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-purple-100 via-pink-100 to-amber-100 shadow-lg shadow-purple-500/10">
          <Plus className="h-10 w-10 text-purple-600" />
        </div>
        <h2 className="mb-2 text-2xl font-bold text-slate-800">Start your family tree</h2>
        <p className="mb-6 text-sm text-slate-500">
          Add your first family member to begin. You can always load a sample family to explore the features.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button
            onClick={onAdd}
            className="rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-5 shadow-md shadow-purple-500/25 hover:shadow-lg"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Add first person
          </Button>
          <Button
            variant="outline"
            onClick={onLoadSample}
            className="rounded-lg px-5"
          >
            <Sparkles className="mr-1.5 h-4 w-4" />
            Load sample family
          </Button>
        </div>
      </div>
    </div>
  );
}
