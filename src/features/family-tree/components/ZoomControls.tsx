'use client';

// Family Tree — Zoom controls
// Floating button cluster at bottom-right of the canvas: zoom in, percentage,
// zoom out, reset-to-fit. Extracted from FamilyTree.tsx for clarity.

import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react';

interface Props {
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
}

export function ZoomControls({ scale, onZoomIn, onZoomOut, onZoomReset }: Props) {
  return (
    <div className="ft-zoom-controls">
      <Button size="sm" variant="ghost" onClick={onZoomIn} aria-label="Zoom in" className="h-8 w-8 p-0 hover:bg-slate-100">
        <ZoomIn className="h-4 w-4" />
      </Button>
      <div className="py-0.5 text-center text-[10px] font-mono font-semibold text-slate-500">
        {Math.round(scale * 100)}%
      </div>
      <Button size="sm" variant="ghost" onClick={onZoomOut} aria-label="Zoom out" className="h-8 w-8 p-0 hover:bg-slate-100">
        <ZoomOut className="h-4 w-4" />
      </Button>
      <div className="my-0.5 h-px bg-slate-200" />
      <Button size="sm" variant="ghost" onClick={onZoomReset} aria-label="Reset zoom" className="h-8 w-8 p-0 hover:bg-slate-100">
        <Maximize className="h-4 w-4" />
      </Button>
    </div>
  );
}
