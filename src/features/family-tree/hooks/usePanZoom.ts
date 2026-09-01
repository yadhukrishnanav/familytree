'use client';

// Family Tree — Pan/Zoom hook
// Encapsulates all the canvas pan/zoom logic: wheel zoom (towards cursor),
// mouse pan (click-drag), touch pan + pinch zoom, and zoom buttons.
// Extracted from FamilyTree.tsx to keep the main component focused on
// rendering + business logic.
//
// Usage:
//   const { transform, setTransform, onWheel, onMouseDown, ...,
//           zoomIn, zoomOut, zoomReset, canvasRef } = usePanZoom(layout.width, layout.height);

import { useCallback, useRef, useState } from 'react';
import { CANVAS } from '../constants';

export interface CanvasTransform {
  x: number;
  y: number;
  scale: number;
}

const { MIN_SCALE, MAX_SCALE, DEFAULT_TRANSFORM, ZOOM_STEP, WHEEL_SENSITIVITY } = CANVAS;

/**
 * Pan/zoom state + handlers for the tree canvas.
 *
 * @param layoutWidth  The computed layout width (used by zoomReset to fit).
 * @param layoutHeight The computed layout height (used by zoomReset to fit).
 */
export function usePanZoom(layoutWidth: number, layoutHeight: number) {
  const [transform, setTransform] = useState<CanvasTransform>(DEFAULT_TRANSFORM);
  const canvasRef = useRef<HTMLDivElement>(null);
  const isPanning = useRef(false);
  const panStart = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const pinchRef = useRef<{ distance: number; scale: number } | null>(null);

  // ---- Wheel zoom (towards cursor) ----
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    setTransform((t) => {
      const delta = -e.deltaY / WHEEL_SENSITIVITY;
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
      const newScale = Math.min(MAX_SCALE, t.scale * ZOOM_STEP);
      const cx = (canvasRef.current?.clientWidth ?? 800) / 2;
      const cy = (canvasRef.current?.clientHeight ?? 600) / 2;
      const wx = (cx - t.x) / t.scale;
      const wy = (cy - t.y) / t.scale;
      return { scale: newScale, x: cx - wx * newScale, y: cy - wy * newScale };
    });
  }, []);

  const zoomOut = useCallback(() => {
    setTransform((t) => {
      const newScale = Math.max(MIN_SCALE, t.scale / ZOOM_STEP);
      const cx = (canvasRef.current?.clientWidth ?? 800) / 2;
      const cy = (canvasRef.current?.clientHeight ?? 600) / 2;
      const wx = (cx - t.x) / t.scale;
      const wy = (cy - t.y) / t.scale;
      return { scale: newScale, x: cx - wx * newScale, y: cy - wy * newScale };
    });
  }, []);

  const zoomReset = useCallback(() => {
    if (!canvasRef.current || layoutWidth === 0) {
      setTransform(DEFAULT_TRANSFORM);
      return;
    }
    const cw = canvasRef.current.clientWidth;
    const ch = canvasRef.current.clientHeight;
    const scale = Math.max(MIN_SCALE, Math.min(cw / (layoutWidth + 200), ch / (layoutHeight + 200), 1));
    setTransform({ x: (cw - layoutWidth * scale) / 2, y: 40, scale });
  }, [layoutWidth, layoutHeight]);

  return {
    transform,
    setTransform,
    canvasRef,
    onWheel,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    zoomIn,
    zoomOut,
    zoomReset,
  };
}
