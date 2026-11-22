import { useEffect, useRef, useState, type PointerEvent } from "react";
import { drawTo } from "@/client/lib/imaging/browser";
import type { Raster } from "@/client/lib/imaging/raster";

/** A crop in percent of the source. */
export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const FULL_CROP: CropRect = { x: 0, y: 0, width: 100, height: 100 };

/** Drag across the image to pick the area to keep; `aspect` (width / height) fixes its shape. */
export function CropBox({
  source,
  crop,
  aspect,
  onChange,
}: {
  source: Raster;
  crop: CropRect;
  aspect: number | null;
  onChange: (crop: CropRect) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    if (canvas.current) drawTo(canvas.current, source);
  }, [source]);

  function point(e: PointerEvent<HTMLDivElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(100, Math.max(0, ((e.clientX - box.left) / box.width) * 100)),
      y: Math.min(100, Math.max(0, ((e.clientY - box.top) / box.height) * 100)),
    };
  }
  function rectTo(end: { x: number; y: number }): CropRect {
    if (!start) return crop;
    let w = Math.abs(end.x - start.x);
    let h = Math.abs(end.y - start.y);
    if (aspect) {
      // Percent units differ per axis: convert through the source's pixel ratio.
      const ratio = (aspect * source.height) / source.width;
      if (w / h > ratio) w = h * ratio;
      else h = w / ratio;
    }
    const x = end.x < start.x ? start.x - w : start.x;
    const y = end.y < start.y ? start.y - h : start.y;
    return {
      x: Math.max(0, x),
      y: Math.max(0, y),
      width: Math.max(1, Math.min(w, 100 - Math.max(0, x))),
      height: Math.max(1, Math.min(h, 100 - Math.max(0, y))),
    };
  }

  return (
    <div
      className="relative mx-auto w-fit touch-none select-none"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        setStart(point(e));
      }}
      onPointerMove={(e) => start && onChange(rectTo(point(e)))}
      onPointerUp={(e) => {
        if (start) {
          const next = rectTo(point(e));
          onChange(next.width < 2 || next.height < 2 ? FULL_CROP : next);
        }
        setStart(null);
      }}
    >
      <canvas ref={canvas} aria-label="Crop area" role="img" className="block max-h-[40vh] max-w-full cursor-crosshair rounded" />
      <div
        className="pointer-events-none absolute border-2 border-primary shadow-[0_0_0_9999px] shadow-background/60"
        style={{ left: `${crop.x}%`, top: `${crop.y}%`, width: `${crop.width}%`, height: `${crop.height}%` }}
      />
    </div>
  );
}
