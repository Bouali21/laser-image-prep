import { z } from "zod";

/** One editable value of a step. */
export type ParamDef =
  | { key: string; label: string; kind: "number"; min: number; max: number; step: number; default: number; unit?: string }
  | { key: string; label: string; kind: "choice"; options: { value: string; label: string }[]; default: string };

export interface StepDef {
  label: string;
  group: "Tone" | "Color" | "Detail" | "Geometry" | "Output";
  params: ParamDef[];
}

const num = (key: string, label: string, min: number, max: number, step: number, def: number, unit?: string): ParamDef => ({
  key, label, kind: "number", min, max, step, default: def, unit,
});

export const DITHER_ALGORITHMS = [
  { value: "floydSteinberg", label: "Floyd-Steinberg" },
  { value: "atkinson", label: "Atkinson" },
  { value: "jarvis", label: "Jarvis-Judice-Ninke" },
  { value: "stucki", label: "Stucki" },
  { value: "sierra", label: "Sierra" },
  { value: "sierraLite", label: "Sierra Lite" },
  { value: "twoRowSierra", label: "Two-row Sierra" },
  { value: "burkes", label: "Burkes" },
  { value: "bayer2", label: "Bayer 2×2" },
  { value: "bayer4", label: "Bayer 4×4" },
  { value: "bayer8", label: "Bayer 8×8" },
  { value: "blueNoise", label: "Blue noise" },
] as const;
export type DitherAlgorithm = (typeof DITHER_ALGORITHMS)[number]["value"];

export const UNITS = [
  { value: "mm", label: "mm" },
  { value: "in", label: "in" },
];

export const STEP_DEFS = {
  brightnessContrast: {
    label: "Brightness / contrast",
    group: "Tone",
    params: [num("brightness", "Brightness", -100, 100, 1, 0), num("contrast", "Contrast", -100, 100, 1, 0)],
  },
  exposure: { label: "Exposure", group: "Tone", params: [num("ev", "Exposure", -3, 3, 0.1, 0, "EV")] },
  autoLevels: { label: "Auto levels", group: "Tone", params: [num("clip", "Clip", 0, 10, 0.1, 0.5, "%")] },
  clahe: {
    label: "Local contrast (CLAHE)",
    group: "Tone",
    params: [num("clipLimit", "Clip limit", 1, 10, 0.1, 2), num("tiles", "Tiles", 2, 16, 1, 8)],
  },
  gamma: { label: "Gamma", group: "Tone", params: [num("gamma", "Gamma", 0.1, 5, 0.05, 1)] },
  grayscale: {
    label: "Grayscale",
    group: "Color",
    params: [{
      key: "method", label: "Method", kind: "choice", default: "luminance",
      options: [
        { value: "luminance", label: "Luminance" },
        { value: "average", label: "Average" },
        { value: "lightness", label: "Lightness" },
      ],
    }],
  },
  monochrome: {
    label: "Monochrome (one channel)",
    group: "Color",
    params: [{
      key: "channel", label: "Channel", kind: "choice", default: "red",
      options: [
        { value: "red", label: "Red" },
        { value: "green", label: "Green" },
        { value: "blue", label: "Blue" },
      ],
    }],
  },
  invert: { label: "Invert", group: "Color", params: [] },
  sharpen: { label: "Sharpen", group: "Detail", params: [num("amount", "Amount", 0, 5, 0.1, 1)] },
  unsharpMask: {
    label: "Unsharp mask",
    group: "Detail",
    params: [num("amount", "Amount", 0, 5, 0.1, 1), num("radius", "Radius", 0.5, 10, 0.5, 2, "px"), num("threshold", "Threshold", 0, 255, 1, 0)],
  },
  blur: { label: "Blur", group: "Detail", params: [num("radius", "Radius", 0.5, 20, 0.5, 1, "px")] },
  rotate: {
    label: "Rotate",
    group: "Geometry",
    params: [{
      key: "angle", label: "Angle", kind: "choice", default: "90",
      options: [
        { value: "90", label: "90° right" },
        { value: "180", label: "180°" },
        { value: "270", label: "90° left" },
      ],
    }],
  },
  flip: {
    label: "Flip",
    group: "Geometry",
    params: [{
      key: "axis", label: "Axis", kind: "choice", default: "horizontal",
      options: [
        { value: "horizontal", label: "Horizontal" },
        { value: "vertical", label: "Vertical" },
      ],
    }],
  },
  crop: {
    label: "Crop",
    group: "Geometry",
    params: [
      num("x", "Left", 0, 99, 1, 0, "%"),
      num("y", "Top", 0, 99, 1, 0, "%"),
      num("width", "Width", 1, 100, 1, 100, "%"),
      num("height", "Height", 1, 100, 1, 100, "%"),
    ],
  },
  resize: {
    label: "Resize",
    group: "Geometry",
    params: [
      num("width", "Width", 1, 2000, 0.1, 100),
      num("height", "Height", 0, 2000, 0.1, 0),
      { key: "unit", label: "Unit", kind: "choice", default: "mm", options: UNITS },
      num("dpi", "DPI", 50, 1200, 1, 254),
    ],
  },
  threshold: { label: "Threshold", group: "Output", params: [num("level", "Level", 0, 255, 1, 128)] },
  adaptiveThreshold: {
    label: "Adaptive threshold",
    group: "Output",
    params: [num("blockSize", "Block size", 3, 101, 2, 15, "px"), num("offset", "Offset", -50, 50, 1, 5)],
  },
  halftone: {
    label: "Halftone",
    group: "Output",
    params: [num("cellSize", "Cell size", 2, 32, 1, 6, "px"), num("angle", "Angle", 0, 90, 1, 45, "°")],
  },
  dither: {
    label: "Dither",
    group: "Output",
    params: [{ key: "algorithm", label: "Algorithm", kind: "choice", default: "floydSteinberg", options: [...DITHER_ALGORITHMS] }],
  },
} satisfies Record<string, StepDef>;

export type StepType = keyof typeof STEP_DEFS;
export const STEP_TYPES = Object.keys(STEP_DEFS) as StepType[];

export type StepParams = Record<string, number | string>;
export interface Step {
  type: StepType;
  enabled: boolean;
  params: StepParams;
}

export function defaultParams(type: StepType): StepParams {
  const def: StepDef = STEP_DEFS[type];
  return Object.fromEntries(def.params.map((p) => [p.key, p.default]));
}

export function makeStep(type: StepType, params: StepParams = {}): Step {
  return { type, enabled: true, params: { ...defaultParams(type), ...params } };
}

function paramSchema(p: ParamDef) {
  return p.kind === "number"
    ? z.number().finite().min(p.min).max(p.max)
    : z.enum(p.options.map((o) => o.value) as [string, ...string[]]);
}

/** A step of a known type whose every value is present and in range. */
export const stepSchema = z
  .object({
    type: z.string(),
    enabled: z.boolean().default(true),
    params: z.record(z.string(), z.unknown()).default({}),
  })
  .strict()
  .transform((step, ctx) => {
    if (!(step.type in STEP_DEFS)) {
      ctx.addIssue({ code: "custom", message: `Unknown step "${step.type}"` });
      return z.NEVER;
    }
    const type = step.type as StepType;
    const def: StepDef = STEP_DEFS[type];
    const known = new Set(def.params.map((p) => p.key));
    for (const key of Object.keys(step.params)) {
      if (!known.has(key)) {
        ctx.addIssue({ code: "custom", message: `${def.label} has no setting "${key}"` });
        return z.NEVER;
      }
    }
    const params: StepParams = {};
    for (const p of def.params) {
      const raw = step.params[p.key] ?? p.default;
      const parsed = paramSchema(p).safeParse(raw);
      if (!parsed.success) {
        ctx.addIssue({ code: "custom", message: `${def.label}: ${p.label} is out of range` });
        return z.NEVER;
      }
      params[p.key] = parsed.data;
    }
    return { type, enabled: step.enabled, params } satisfies Step;
  });

export const stepsSchema = z.array(stepSchema).max(100);

/** Steps a workflow run replaces with its own output settings. */
export function skipReason(step: Step): string | null {
  if (step.type === "dither") return "Final dither replaces it";
  if (step.type === "resize") return "Output size replaces it";
  return null;
}

export function stepSummary(step: Step): string {
  const def: StepDef = STEP_DEFS[step.type];
  return def.params
    .map((p) => {
      const v = step.params[p.key];
      if (p.kind === "choice") return p.options.find((o) => o.value === v)?.label ?? String(v);
      return `${p.label} ${v}${p.unit ?? ""}`;
    })
    .join(", ");
}
