import { describe, expect, it } from "vitest";
import { MATERIALS, materialSteps } from "@/shared/materials";
import { DITHER_ALGORITHMS, makeStep, skipReason, stepsSchema } from "@/shared/steps";
import { workflowInput } from "@/shared/workflow";
import { dither } from "./dither";
import { lightBurnProject } from "./lbrn";
import { applyStep, runSteps } from "./ops";
import { readDpi, withDpi } from "./png";
import { createRaster, type Raster } from "./raster";
import { appliedSteps, runWorkflow } from "./run";
import { sizeToPixels, upscalesTooMuch } from "./size";
import { makeZip } from "./zip";

function gradient(width: number, height: number): Raster {
  const r = createRaster(width, height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const v = (x / (width - 1)) * 255;
      r.data.set([v, v * 0.8, 255 - v, 255], i);
    }
  return r;
}

const MINIMAL_PNG = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 1, 0, 0, 0, 1, 8, 0, 0, 0, 0, 0x3a, 0x7e, 0x9b, 0x55,
  0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);

describe("dithering", () => {
  it.each(DITHER_ALGORITHMS.map((a) => a.value))("%s leaves only black and white and keeps mean tone", (algorithm) => {
    const out = dither(gradient(64, 32), algorithm);
    const values = new Set<number>();
    let sum = 0;
    for (let i = 0; i < out.data.length; i += 4) {
      values.add(out.data[i]!);
      sum += out.data[i]!;
    }
    expect([...values].sort()).toEqual([0, 255]);
    const mean = sum / (64 * 32);
    expect(mean).toBeGreaterThan(80);
    expect(mean).toBeLessThan(180);
  });
});

describe("steps", () => {
  it("rejects unknown steps and out-of-range values", () => {
    expect(stepsSchema.safeParse([{ type: "vectorize", enabled: true, params: {} }]).success).toBe(false);
    expect(stepsSchema.safeParse([{ type: "gamma", enabled: true, params: { gamma: 99 } }]).success).toBe(false);
    expect(stepsSchema.safeParse([{ type: "dither", enabled: true, params: { algorithm: "magic" } }]).success).toBe(false);
    expect(workflowInput.safeParse({ name: "x", steps: [{ type: "gamma", enabled: false, params: {} }] }).data?.steps[0]).toEqual({
      type: "gamma",
      enabled: false,
      params: { gamma: 1 },
    });
  });

  it("rotates, flips and crops", () => {
    const src = gradient(30, 20);
    expect(applyStep(src, makeStep("rotate", { angle: "90" }))).toMatchObject({ width: 20, height: 30 });
    const flipped = applyStep(src, makeStep("flip", { axis: "horizontal" }));
    expect(flipped.data[0]).toBeCloseTo(255);
    expect(applyStep(src, makeStep("crop", { x: 50, y: 0, width: 50, height: 50 }))).toMatchObject({ width: 15, height: 10 });
  });

  it("skips disabled steps", () => {
    const src = gradient(8, 8);
    expect(runSteps(src, [{ ...makeStep("invert"), enabled: false }]).data).toEqual(src.data);
  });

  it("every material preset runs and ends black and white at its size", () => {
    for (const m of MATERIALS) {
      const out = runSteps(gradient(40, 20), materialSteps(m, { width: 10, height: 0, unit: "mm", dpi: 254 }));
      expect(out.width).toBe(100);
      expect(out.height).toBe(50);
      expect(new Set(Array.from(out.data.filter((_, i) => i % 4 === 0)))).toEqual(new Set([0, 255]));
    }
  });
});

describe("output", () => {
  it("sizes by physical size and DPI", () => {
    expect(sizeToPixels({ width: 100, height: 0, unit: "mm", dpi: 254 }, 300, 200)).toEqual({ width: 1000, height: 667 });
    expect(sizeToPixels({ width: 2, height: 3, unit: "in", dpi: 300 }, 10, 10)).toEqual({ width: 600, height: 900 });
    expect(upscalesTooMuch(100, 100, { width: 131, height: 100 })).toBe(true);
    expect(upscalesTooMuch(100, 100, { width: 130, height: 130 })).toBe(false);
  });

  it("writes DPI into a PNG", () => {
    expect(readDpi(withDpi(MINIMAL_PNG, 318))).toBe(318);
    expect(readDpi(withDpi(withDpi(MINIMAL_PNG, 300), 600))).toBe(600);
  });

  it("runs a workflow as steps, then resize, then dither, skipping its own dither and resize", () => {
    const steps = [makeStep("grayscale"), makeStep("resize", { width: 1, unit: "mm", dpi: 254 }), makeStep("dither", { algorithm: "bayer2" })];
    expect(steps.map(skipReason)).toEqual([null, expect.any(String), expect.any(String)]);
    const opts = { size: { width: 5, height: 0, unit: "mm" as const, dpi: 254 }, finalDither: true };
    const out = runWorkflow(gradient(20, 10), steps, opts);
    expect(out).toMatchObject({ width: 50, height: 25 });
    expect(appliedSteps(steps, opts).map((s) => s.type)).toEqual(["grayscale", "resize", "dither"]);
  });

  it("builds a zip and a LightBurn project", () => {
    const zip = makeZip([{ name: "a.png", data: MINIMAL_PNG }, { name: "a.png", data: MINIMAL_PNG }]);
    expect(Array.from(zip.subarray(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
    expect(new TextDecoder().decode(zip)).toContain("a-2.png");
    const project = lightBurnProject("AAAA", 254, 127, 254);
    expect(project).toContain('W="254" H="127"');
    expect(project).toContain("<XForm>0.1 0 0 0.1 12.7 6.35</XForm>");
  });
});
