import type { OutputSize } from "@/shared/materials";

export const MM_PER_INCH = 25.4;

/** Pixels for a physical size; a height of 0 keeps the aspect ratio. */
export function sizeToPixels(size: OutputSize, sourceWidth: number, sourceHeight: number): { width: number; height: number } {
  const inches = (v: number) => (size.unit === "mm" ? v / MM_PER_INCH : v);
  const width = Math.max(1, Math.round(inches(size.width) * size.dpi));
  const height = size.height > 0
    ? Math.max(1, Math.round(inches(size.height) * size.dpi))
    : Math.max(1, Math.round((width * sourceHeight) / sourceWidth));
  return { width, height };
}

/** Millimetres for a pixel count at a DPI. */
export function pixelsToMm(pixels: number, dpi: number): number {
  return (pixels / dpi) * MM_PER_INCH;
}

/** True when reaching `target` means stretching the source by more than 30%. */
export function upscalesTooMuch(sourceWidth: number, sourceHeight: number, target: { width: number; height: number }): boolean {
  return target.width > sourceWidth * 1.3 || target.height > sourceHeight * 1.3;
}
