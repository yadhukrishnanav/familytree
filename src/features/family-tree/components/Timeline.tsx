'use client';

// Family Tree — Timeline strip
// Horizontal zoomable timeline at the bottom of the canvas.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, ChevronDown, ChevronUp, Trash2, Calendar } from 'lucide-react';
import type { Person, TimelineEvent } from '../types';

interface Props {
  events: TimelineEvent[];
  persons: Record<string, Person>;
  collapsed: boolean;
  onToggle: () => void;
  onSelectEvent?: (event: TimelineEvent) => void;
  onDeleteEvent?: (eventId: string) => void;
}

const ICON_EMOJI: Record<string, string> = {
  birth: '🎂',
  death: '🕯️',
  marriage: '💍',
  graduation: '🎓',
  job: '💼',
  move: '🏠',
  milestone: '⭐',
  travel: '✈️',
  custom: '📌',
};

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 4;
const BASE_PX_PER_YEAR = 60;

export function Timeline({
  events,
  persons,
  collapsed,
  onToggle,
  onSelectEvent,
  onDeleteEvent,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);

  const sorted = useMemo(
    () => [...events].sort((a, b) => a.year - b.year),
    [events],
  );

  const { minYear, maxYear, yearSpan, totalWidth } = useMemo(() => {
    if (sorted.length === 0) {
      return { minYear: 0, maxYear: 0, yearSpan: 0, totalWidth: 0 };
    }
    const min = Math.min(...sorted.map((e) => e.year));
    const max = Math.max(...sorted.map((e) => e.year));
    const span = Math.max(max - min, 1);
    return {
      minYear: min,
      maxYear: max,
      yearSpan: span,
      totalWidth: (span + 2) * BASE_PX_PER_YEAR * zoom + 80,
    };
  }, [sorted, zoom]);

  const yearToX = (year: number) =>
    80 + (year - minYear + 1) * BASE_PX_PER_YEAR * zoom;

  // Ctrl+scroll zoom; otherwise horizontal scroll
  const onWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = -e.deltaY / 500;
      setZoom((z) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z + delta)));
    }
  };

  // Touch pinch zoom support
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchRef.current = { distance: Math.hypot(dx, dy), zoom };
    }
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const ratio = dist / pinchRef.current.distance;
      setZoom(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, pinchRef.current.zoom * ratio)));
    }
  };
  const onTouchEnd = () => {
    pinchRef.current = null;
  };

  // Decade ticks
  const decadeTicks = useMemo(() => {
    if (sorted.length === 0) return [];
    const startDecade = Math.floor(minYear / 10) * 10;
    const endDecade = Math.ceil(maxYear / 10) * 10;
    const ticks: number[] = [];
    for (let y = startDecade; y <= endDecade; y += 10) ticks.push(y);
    return ticks;
  }, [minYear, maxYear, sorted.length]);

  // Alternate cards above/below — inline yearToX so the deps array matches
  const cardPositions = useMemo(() => {
    const toX = (year: number) => 80 + (year - minYear + 1) * BASE_PX_PER_YEAR * zoom;
    return sorted.map((e, i) => ({
      event: e,
      x: toX(e.year),
      above: i % 2 === 0,
    }));
  }, [sorted, minYear, zoom]);

  if (collapsed) {
    return (
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between border-t border-slate-200 bg-white/80 px-4 py-2 backdrop-blur-md hover:bg-white"
      >
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <Calendar className="h-4 w-4 text-amber-500" />
          Timeline
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
            {sorted.length} events
          </span>
        </div>
        <ChevronUp className="h-4 w-4 text-slate-400" />
      </button>
    );
  }

  return (
    <div className="border-t border-slate-200 bg-white/90 backdrop-blur-md">
      <div className="flex items-center justify-between px-4 py-2">
        <button
          onClick={onToggle}
          className="flex items-center gap-2 text-sm font-medium text-slate-700"
        >
          <Calendar className="h-4 w-4 text-amber-500" />
          Timeline
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
            {sorted.length} events
          </span>
        </button>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - 0.2))}
            aria-label="Zoom out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <span className="w-12 text-center text-xs font-mono text-slate-500">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + 0.2))}
            aria-label="Zoom in"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" onClick={onToggle} aria-label="Collapse timeline">
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div
        ref={scrollRef}
        onWheel={onWheel}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className="relative h-[210px] overflow-x-auto overflow-y-hidden"
        style={{ touchAction: 'pan-x' }}
      >
        {sorted.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            No events yet. Click <span className="mx-1 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">+ Event</span> to add one.
          </div>
        ) : (
          <div className="relative h-full" style={{ width: totalWidth, minWidth: '100%' }}>
            {/* Axis line */}
            <div
              className="absolute left-0 right-0 h-0.5 bg-slate-300"
              style={{ top: '50%' }}
            />
            {/* Decade ticks */}
            {decadeTicks.map((y) => (
              <div
                key={y}
                className="absolute flex flex-col items-center"
                style={{ left: yearToX(y), top: '50%', transform: 'translate(-50%, 0)' }}
              >
                <div className="h-3 w-px bg-slate-300" />
                <span className="mt-1 text-[10px] font-mono text-slate-400">{y}</span>
              </div>
            ))}

            {/* Cards */}
            {cardPositions.map(({ event, x, above }) => {
              const cardWidth = 160;
              const cardHeight = 70;
              const verticalOffset = 12;
              const top = above
                ? 'calc(50% - ' + (cardHeight + verticalOffset) + 'px)'
                : 'calc(50% + ' + verticalOffset + 'px)';
              return (
                <div key={event.id} className="group absolute" style={{ left: x - cardWidth / 2, top, width: cardWidth }}>
                  {/* Connecting line + dot */}
                  <div
                    className="absolute left-1/2 h-3 w-0.5"
                    style={{
                      background: event.color,
                      top: above ? 'auto' : `-12px`,
                      bottom: above ? `-12px` : 'auto',
                    }}
                  />
                  <div
                    className="absolute left-1/2 h-2 w-2 -translate-x-1/2 rounded-full"
                    style={{
                      background: event.color,
                      top: above ? 'auto' : `-12px`,
                      bottom: above ? `-12px` : 'auto',
                    }}
                  />

                  <div
                    onClick={() => onSelectEvent?.(event)}
                    className="cursor-pointer overflow-hidden rounded-lg bg-white shadow-md ring-1 ring-slate-200 transition hover:shadow-lg hover:ring-2"
                    style={{ borderTop: `3px solid ${event.color}` }}
                  >
                    <div className="flex items-start gap-1.5 px-2 py-1.5">
                      <span className="text-base leading-none">{ICON_EMOJI[event.icon] ?? '📌'}</span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-semibold text-slate-800">
                          {event.title}
                        </div>
                        <div className="text-[10px] font-mono text-slate-500">{event.year}</div>
                      </div>
                      {onDeleteEvent && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteEvent(event.id);
                          }}
                          className="opacity-0 transition group-hover:opacity-100"
                          aria-label="Delete event"
                        >
                          <Trash2 className="h-3 w-3 text-red-500 hover:text-red-600" />
                        </button>
                      )}
                    </div>
                    {/* Person mini-avatars */}
                    {event.personIds.length > 0 && (
                      <div className="flex flex-wrap gap-0.5 border-t border-slate-100 px-2 py-1">
                        {event.personIds.slice(0, 5).map((pid) => {
                          const p = persons[pid];
                          if (!p) return null;
                          return (
                            <div
                              key={pid}
                              className="h-3.5 w-3.5 rounded-full ring-1 ring-white"
                              style={{
                                background: `linear-gradient(135deg, ${p.avatarColors[0]}, ${p.avatarColors[1]})`,
                              }}
                              title={`${p.firstName} ${p.lastName ?? ''}`}
                            />
                          );
                        })}
                        {event.personIds.length > 5 && (
                          <span className="text-[8px] text-slate-400">+{event.personIds.length - 5}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
