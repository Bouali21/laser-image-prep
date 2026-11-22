import { makeStep, skipReason, type Step } from "@/shared/steps";
import type { OutputSize } from "@/shared/materials";
import { dither } from "./dither";
import { resample, runSteps } from "./ops";
import type { Raster } from "./raster";
import { sizeToPixels } from "./size";

export interface RunOptions {
  /** Null leaves the size as the steps made it. */
  size: OutputSize | null;
  finalDither: boolean;
}

/** A workflow run: its enabled steps minus the skipped ones, then the output size, then the final dither. */
export function runWorkflow(source: Raster, steps: Step[], options: RunOptions): Raster {
  let r = runSteps(source, steps.filter((s) => !skipReason(s)));
  if (options.size) {
    const px = sizeToPixels(options.size, r.width, r.height);
    r = resample(r, px.width, px.height);
  }
  if (options.finalDither) r = dither(r, "jarvis");
  return r;
}

/** The steps a run actually applied, for the saved output's record. */
export function appliedSteps(steps: Step[], options: RunOptions): Step[] {
  return [
    ...steps.filter((s) => !skipReason(s)),
    ...(options.size ? [makeStep("resize", { ...options.size })] : []),
    ...(options.finalDither ? [makeStep("dither", { algorithm: "jarvis" })] : []),
  ];
}
