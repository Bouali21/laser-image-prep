import { useEffect, useState } from "react";
import { fetchImage } from "@/client/lib/api";
import { decode } from "@/client/lib/imaging/browser";
import { runSteps } from "@/client/lib/imaging/ops";
import type { Raster } from "@/client/lib/imaging/raster";
import type { Step } from "@/shared/steps";

/** The library image, decoded. */
export function useSource(imageId: string): { source: Raster | null; error: string | null } {
  const [source, setSource] = useState<Raster | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    fetchImage(imageId)
      .then(decode)
      .then((r) => live && setSource(r))
      .catch((e: unknown) => live && setError(e instanceof Error ? e.message : "The image couldn't be opened."));
    return () => {
      live = false;
    };
  }, [imageId]);
  return { source, error };
}

/** The source through the steps, re-rendered shortly after they stop changing. */
export function useRendered(source: Raster | null, steps: Step[]): { result: Raster | null; rendering: boolean; error: string | null } {
  const [result, setResult] = useState<Raster | null>(null);
  const [rendering, setRendering] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const key = JSON.stringify(steps);
  useEffect(() => {
    if (!source) return;
    setRendering(true);
    const timer = setTimeout(() => {
      try {
        setResult(runSteps(source, steps));
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "These steps couldn't be applied.");
      }
      setRendering(false);
    }, 120);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, key]);
  return { result, rendering, error };
}
