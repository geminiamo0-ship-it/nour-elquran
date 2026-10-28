'use client';

import { useCallback, useEffect, useRef, type PointerEvent } from 'react';

type Point = Readonly<{ x: number; y: number }>;
type Stroke = Point[];

/** In-memory pen strokes in normalized coordinates survive responsive canvas resizes. */
export function useMushafDrawing(enabled: boolean) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Stroke[]>([]);
  const activeStroke = useRef<Stroke | null>(null);

  const redraw = useCallback((resize = false) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    if (resize) {
      canvas.width = Math.round(rect.width * ratio);
      canvas.height = Math.round(rect.height * ratio);
    }
    const context = canvas.getContext('2d');
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, rect.width, rect.height);
    context.lineWidth = 3.2;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = '#b18327';
    context.fillStyle = '#b18327';
    for (const stroke of [...strokes.current, ...(activeStroke.current ? [activeStroke.current] : [])]) {
      if (!stroke.length) continue;
      const first = stroke[0];
      if (!first) continue;
      context.beginPath();
      context.moveTo(first.x * rect.width, first.y * rect.height);
      for (const point of stroke.slice(1)) context.lineTo(point.x * rect.width, point.y * rect.height);
      if (stroke.length === 1) {
        context.arc(first.x * rect.width, first.y * rect.height, 1.7, 0, Math.PI * 2);
        context.fill();
      } else context.stroke();
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => redraw(true));
    observer.observe(canvas);
    redraw(true);
    return () => observer.disconnect();
  }, [redraw]);

  function point(event: PointerEvent<HTMLCanvasElement>): Point {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / Math.max(1, rect.width), y: (event.clientY - rect.top) / Math.max(1, rect.height) };
  }

  function onPointerDown(event: PointerEvent<HTMLCanvasElement>) {
    if (!enabled) return;
    activeStroke.current = [point(event)];
    event.currentTarget.setPointerCapture(event.pointerId);
    redraw();
  }

  function onPointerMove(event: PointerEvent<HTMLCanvasElement>) {
    if (!enabled || !activeStroke.current) return;
    activeStroke.current.push(point(event));
    redraw();
  }

  function onPointerUp(event: PointerEvent<HTMLCanvasElement>) {
    if (!activeStroke.current) return;
    strokes.current.push(activeStroke.current);
    activeStroke.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    redraw();
  }

  function clear() {
    strokes.current = [];
    activeStroke.current = null;
    redraw();
  }

  return { canvasRef, onPointerDown, onPointerMove, onPointerUp, clear };
}
