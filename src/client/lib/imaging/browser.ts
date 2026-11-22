// The parts that need a browser: decoding files and encoding canvases.
import { lightBurnProject } from "./lbrn";
import { withDpi } from "./png";
import { flatten, fromRgba, toRgba, type Raster } from "./raster";

/** Longest side kept in memory while editing. */
const MAX_SIDE = 4000;

export async function decode(blob: Blob): Promise<Raster> {
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return flatten(fromRgba(width, height, ctx.getImageData(0, 0, width, height).data));
}

export function drawTo(canvas: HTMLCanvasElement, raster: Raster): void {
  canvas.width = raster.width;
  canvas.height = raster.height;
  canvas.getContext("2d")!.putImageData(new ImageData(toRgba(raster), raster.width, raster.height), 0, 0);
}

export async function encodePng(raster: Raster, dpi: number): Promise<Uint8Array<ArrayBuffer>> {
  const canvas = new OffscreenCanvas(raster.width, raster.height);
  canvas.getContext("2d")!.putImageData(new ImageData(toRgba(raster), raster.width, raster.height), 0, 0);
  const blob = await canvas.convertToBlob({ type: "image/png" });
  return withDpi(new Uint8Array(await blob.arrayBuffer()), dpi);
}

export async function encodeLightBurn(raster: Raster, dpi: number): Promise<string> {
  const png = await encodePng(raster, dpi);
  let binary = "";
  for (let i = 0; i < png.length; i += 0x8000) binary += String.fromCharCode(...png.subarray(i, i + 0x8000));
  return lightBurnProject(btoa(binary), raster.width, raster.height, dpi);
}

export function downloadBytes(data: BlobPart, name: string, type: string): void {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** "lighthouse.jpg" -> "lighthouse-slate.png" */
export function outputName(source: string, suffix: string, extension: string): string {
  const base = source.replace(/\.[a-z0-9]+$/i, "").replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "") || "image";
  return `${base}-${suffix}.${extension}`;
}
