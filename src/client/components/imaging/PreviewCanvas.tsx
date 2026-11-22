import { useEffect, useRef } from "react";
import { drawTo } from "@/client/lib/imaging/browser";
import type { Raster } from "@/client/lib/imaging/raster";
import { Spinner } from "@/client/components/ui/spinner";

/** The rendered image, fitted to the column. */
export function PreviewCanvas({
  raster,
  ready,
  showing = "after",
  label,
}: {
  raster: Raster | null;
  ready: boolean;
  showing?: "before" | "after";
  label: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current && raster) drawTo(ref.current, raster);
  }, [raster]);
  return (
    <div className="relative flex min-h-48 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted p-2">
      <canvas
        ref={ref}
        data-testid="preview"
        data-ready={ready && raster ? "true" : "false"}
        data-showing={showing}
        aria-label={label}
        role="img"
        className="max-h-[60vh] max-w-full object-contain [image-rendering:pixelated]"
      />
      {!ready || !raster ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <Spinner className="size-6 text-muted-foreground" />
        </div>
      ) : null}
    </div>
  );
}
