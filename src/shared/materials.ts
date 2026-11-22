import { makeStep, type DitherAlgorithm, type Step } from "./steps";

export interface Material {
  id: string;
  label: string;
  /** Tonal steps after grayscale, before size and dither. */
  tone: Step[];
  /** The laser lightens this surface, so the image is inverted. */
  invert: boolean;
  sharpen: number;
  dither: DitherAlgorithm;
}

const bc = (brightness: number, contrast: number) => makeStep("brightnessContrast", { brightness, contrast });
const gamma = (g: number) => makeStep("gamma", { gamma: g });
const levels = makeStep("autoLevels", { clip: 0.5 });

export const MATERIALS: Material[] = [
  { id: "plywood", label: "Plywood", tone: [levels, bc(10, 15), gamma(1.1)], invert: false, sharpen: 1, dither: "jarvis" },
  { id: "hardwood", label: "Hardwood", tone: [levels, bc(5, 20)], invert: false, sharpen: 1.2, dither: "jarvis" },
  { id: "mdf", label: "MDF", tone: [levels, bc(8, 10)], invert: false, sharpen: 1, dither: "stucki" },
  { id: "bamboo", label: "Bamboo", tone: [levels, bc(12, 18), gamma(1.15)], invert: false, sharpen: 1, dither: "jarvis" },
  { id: "slate", label: "Slate", tone: [levels, bc(0, 40)], invert: true, sharpen: 1.5, dither: "floydSteinberg" },
  { id: "tile", label: "Ceramic tile", tone: [levels, bc(-5, 35)], invert: false, sharpen: 1.5, dither: "floydSteinberg" },
  { id: "glass", label: "Glass", tone: [levels, bc(0, 30)], invert: true, sharpen: 0.8, dither: "atkinson" },
  { id: "acrylic", label: "Acrylic", tone: [levels, bc(5, 20)], invert: false, sharpen: 1, dither: "stucki" },
  { id: "leather", label: "Leather", tone: [levels, bc(10, 10), gamma(1.2)], invert: false, sharpen: 0.8, dither: "jarvis" },
  { id: "anodized", label: "Anodized aluminum", tone: [levels, bc(0, 25)], invert: true, sharpen: 1.2, dither: "floydSteinberg" },
  { id: "cork", label: "Cork", tone: [levels, bc(15, 15), gamma(1.25)], invert: false, sharpen: 0.6, dither: "atkinson" },
  { id: "coatedMetal", label: "Coated metal", tone: [levels, bc(0, 30)], invert: true, sharpen: 1.2, dither: "floydSteinberg" },
];

export function materialById(id: string): Material | undefined {
  return MATERIALS.find((m) => m.id === id);
}

/** Size settings shared by every mode. */
export interface OutputSize {
  width: number;
  /** 0 keeps the aspect ratio. */
  height: number;
  unit: "mm" | "in";
  dpi: number;
}

/** A material's whole pipeline at an output size. */
export function materialSteps(material: Material, size: OutputSize | null, extra: Step[] = []): Step[] {
  return [
    makeStep("grayscale"),
    ...material.tone,
    ...extra,
    ...(material.invert ? [makeStep("invert")] : []),
    ...(material.sharpen > 0 ? [makeStep("sharpen", { amount: material.sharpen })] : []),
    ...(size ? [makeStep("resize", { ...size })] : []),
    makeStep("dither", { algorithm: material.dither }),
  ];
}
