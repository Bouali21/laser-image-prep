import type { DitherAlgorithm, Step } from "@/shared/steps";
import { dither } from "./dither";
import { clamp, createRaster, fromPlane, lumaPlane, mapChannels, type Raster } from "./raster";
import { sizeToPixels } from "./size";

export function brightnessContrast(r: Raster, brightness: number, contrast: number): Raster {
  const c = contrast * 2.55;
  const factor = (259 * (c + 255)) / (255 * (259 - c));
  const b = brightness * 1.28;
  return mapChannels(r, (v) => factor * (v + b - 128) + 128);
}

export function exposure(r: Raster, ev: number): Raster {
  const k = 2 ** ev;
  return mapChannels(r, (v) => v * k);
}

export function gamma(r: Raster, g: number): Raster {
  return mapChannels(r, (v) => 255 * (v / 255) ** (1 / g));
}

export function invert(r: Raster): Raster {
  return mapChannels(r, (v) => 255 - v);
}

export function autoLevels(r: Raster, clipPercent: number): Raster {
  const plane = lumaPlane(r);
  const hist = new Uint32Array(256);
  for (const v of plane) hist[Math.round(clamp(v))]!++;
  const cut = (plane.length * clipPercent) / 100;
  let lo = 0;
  for (let sum = 0; lo < 255 && (sum += hist[lo]!) <= cut; lo++);
  let hi = 255;
  for (let sum = 0; hi > 0 && (sum += hist[hi]!) <= cut; hi--);
  if (hi <= lo) return r;
  return mapChannels(r, (v) => ((v - lo) * 255) / (hi - lo));
}

export function grayscale(r: Raster, method: string): Raster {
  const { data } = r;
  const plane = new Float32Array(r.width * r.height);
  for (let p = 0, i = 0; p < plane.length; p++, i += 4) {
    const R = data[i]!, G = data[i + 1]!, B = data[i + 2]!;
    plane[p] =
      method === "average" ? (R + G + B) / 3
      : method === "lightness" ? (Math.max(R, G, B) + Math.min(R, G, B)) / 2
      : 0.2126 * R + 0.7152 * G + 0.0722 * B;
  }
  return fromPlane(plane, r);
}

export function monochrome(r: Raster, channel: string): Raster {
  const offset = channel === "green" ? 1 : channel === "blue" ? 2 : 0;
  const plane = new Float32Array(r.width * r.height);
  for (let p = 0; p < plane.length; p++) plane[p] = r.data[p * 4 + offset]!;
  return fromPlane(plane, r);
}

/** A 3×3 convolution over the colour channels. */
function convolve3(r: Raster, k: number[]): Raster {
  const { width: w, height: h, data } = r;
  const out = createRaster(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        for (let ky = -1; ky <= 1; ky++)
          for (let kx = -1; kx <= 1; kx++) {
            const sx = Math.min(w - 1, Math.max(0, x + kx));
            const sy = Math.min(h - 1, Math.max(0, y + ky));
            sum += data[(sy * w + sx) * 4 + c]! * k[(ky + 1) * 3 + kx + 1]!;
          }
        out.data[o + c] = clamp(sum);
      }
      out.data[o + 3] = data[o + 3]!;
    }
  return out;
}

export function sharpen(r: Raster, amount: number): Raster {
  if (amount === 0) return r;
  const a = amount;
  return convolve3(r, [0, -a, 0, -a, 1 + 4 * a, -a, 0, -a, 0]);
}

/** Separable Gaussian blur with sigma = radius. */
export function blur(r: Raster, radius: number): Raster {
  const sigma = Math.max(0.3, radius);
  const half = Math.ceil(sigma * 3);
  const weights: number[] = [];
  let total = 0;
  for (let i = -half; i <= half; i++) {
    const v = Math.exp(-(i * i) / (2 * sigma * sigma));
    weights.push(v);
    total += v;
  }
  const k = weights.map((v) => v / total);
  const pass = (src: Raster, horizontal: boolean): Raster => {
    const { width: w, height: h, data } = src;
    const out = createRaster(w, h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const o = (y * w + x) * 4;
        for (let c = 0; c < 3; c++) {
          let sum = 0;
          for (let i = -half; i <= half; i++) {
            const sx = horizontal ? Math.min(w - 1, Math.max(0, x + i)) : x;
            const sy = horizontal ? y : Math.min(h - 1, Math.max(0, y + i));
            sum += data[(sy * w + sx) * 4 + c]! * k[i + half]!;
          }
          out.data[o + c] = sum;
        }
        out.data[o + 3] = data[o + 3]!;
      }
    return out;
  };
  return pass(pass(r, true), false);
}

export function unsharpMask(r: Raster, amount: number, radius: number, threshold: number): Raster {
  const soft = blur(r, radius);
  const out = createRaster(r.width, r.height);
  for (let i = 0; i < r.data.length; i++) {
    if (i % 4 === 3) {
      out.data[i] = r.data[i]!;
      continue;
    }
    const diff = r.data[i]! - soft.data[i]!;
    out.data[i] = Math.abs(diff) >= threshold ? clamp(r.data[i]! + amount * diff) : r.data[i]!;
  }
  return out;
}

/** Contrast-limited adaptive histogram equalization on luminance. */
export function clahe(r: Raster, clipLimit: number, tiles: number): Raster {
  const { width: w, height: h } = r;
  const plane = lumaPlane(r);
  const tw = w / tiles;
  const th = h / tiles;
  const maps: Float32Array[] = [];
  for (let ty = 0; ty < tiles; ty++)
    for (let tx = 0; tx < tiles; tx++) {
      const x0 = Math.floor(tx * tw), x1 = Math.max(x0 + 1, Math.floor((tx + 1) * tw));
      const y0 = Math.floor(ty * th), y1 = Math.max(y0 + 1, Math.floor((ty + 1) * th));
      const hist = new Float32Array(256);
      let count = 0;
      for (let y = y0; y < Math.min(h, y1); y++)
        for (let x = x0; x < Math.min(w, x1); x++) {
          hist[Math.round(clamp(plane[y * w + x]!))]!++;
          count++;
        }
      const limit = Math.max(1, (clipLimit * count) / 256);
      let excess = 0;
      for (let i = 0; i < 256; i++)
        if (hist[i]! > limit) {
          excess += hist[i]! - limit;
          hist[i] = limit;
        }
      const lift = excess / 256;
      const map = new Float32Array(256);
      let sum = 0;
      for (let i = 0; i < 256; i++) {
        sum += hist[i]! + lift;
        map[i] = count ? (sum / count) * 255 : i;
      }
      maps.push(map);
    }
  const out = createRaster(w, h);
  for (let y = 0; y < h; y++) {
    const gy = Math.min(tiles - 1, Math.max(0, y / th - 0.5));
    const y0 = Math.floor(gy), y1 = Math.min(tiles - 1, y0 + 1), fy = gy - y0;
    for (let x = 0; x < w; x++) {
      const gx = Math.min(tiles - 1, Math.max(0, x / tw - 0.5));
      const x0 = Math.floor(gx), x1 = Math.min(tiles - 1, x0 + 1), fx = gx - x0;
      const p = y * w + x;
      const v = Math.round(clamp(plane[p]!));
      const top = maps[y0 * tiles + x0]![v]! * (1 - fx) + maps[y0 * tiles + x1]![v]! * fx;
      const bottom = maps[y1 * tiles + x0]![v]! * (1 - fx) + maps[y1 * tiles + x1]![v]! * fx;
      const nv = top * (1 - fy) + bottom * fy;
      const shift = nv - plane[p]!;
      const o = p * 4;
      out.data[o] = clamp(r.data[o]! + shift);
      out.data[o + 1] = clamp(r.data[o + 1]! + shift);
      out.data[o + 2] = clamp(r.data[o + 2]! + shift);
      out.data[o + 3] = r.data[o + 3]!;
    }
  }
  return out;
}

export function rotate(r: Raster, angle: number): Raster {
  const { width: w, height: h, data } = r;
  const quarter = angle === 90 || angle === 270;
  const out = createRaster(quarter ? h : w, quarter ? w : h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let nx: number, ny: number;
      if (angle === 90) [nx, ny] = [h - 1 - y, x];
      else if (angle === 270) [nx, ny] = [y, w - 1 - x];
      else [nx, ny] = [w - 1 - x, h - 1 - y];
      const s = (y * w + x) * 4;
      const d = (ny * out.width + nx) * 4;
      out.data[d] = data[s]!;
      out.data[d + 1] = data[s + 1]!;
      out.data[d + 2] = data[s + 2]!;
      out.data[d + 3] = data[s + 3]!;
    }
  return out;
}

export function flip(r: Raster, axis: string): Raster {
  const { width: w, height: h, data } = r;
  const out = createRaster(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const sx = axis === "horizontal" ? w - 1 - x : x;
      const sy = axis === "vertical" ? h - 1 - y : y;
      out.data.set(data.subarray((sy * w + sx) * 4, (sy * w + sx) * 4 + 4), (y * w + x) * 4);
    }
  return out;
}

/** Crop by percentages of the current size. */
export function crop(r: Raster, xPct: number, yPct: number, wPct: number, hPct: number): Raster {
  const x0 = Math.min(r.width - 1, Math.round((r.width * xPct) / 100));
  const y0 = Math.min(r.height - 1, Math.round((r.height * yPct) / 100));
  const w = Math.max(1, Math.min(r.width - x0, Math.round((r.width * wPct) / 100)));
  const h = Math.max(1, Math.min(r.height - y0, Math.round((r.height * hPct) / 100)));
  const out = createRaster(w, h);
  for (let y = 0; y < h; y++)
    out.data.set(r.data.subarray(((y0 + y) * r.width + x0) * 4, ((y0 + y) * r.width + x0 + w) * 4), y * w * 4);
  return out;
}

/** Resampling with a triangle filter widened when shrinking, so detail averages instead of aliasing. */
export function resample(r: Raster, width: number, height: number): Raster {
  if (width === r.width && height === r.height) return r;
  const pass = (src: Raster, size: number, horizontal: boolean): Raster => {
    const from = horizontal ? src.width : src.height;
    const out = horizontal ? createRaster(size, src.height) : createRaster(src.width, size);
    const scale = from / size;
    const support = Math.max(1, scale);
    const lines = horizontal ? src.height : src.width;
    for (let i = 0; i < size; i++) {
      const center = (i + 0.5) * scale - 0.5;
      const lo = Math.max(0, Math.floor(center - support));
      const hi = Math.min(from - 1, Math.ceil(center + support));
      const weights: number[] = [];
      let total = 0;
      for (let j = lo; j <= hi; j++) {
        const wgt = Math.max(0, 1 - Math.abs(j - center) / support);
        weights.push(wgt);
        total += wgt;
      }
      for (let line = 0; line < lines; line++) {
        const d = horizontal ? (line * size + i) * 4 : (i * src.width + line) * 4;
        for (let c = 0; c < 4; c++) {
          let sum = 0;
          for (let j = lo; j <= hi; j++) {
            const s = horizontal ? (line * src.width + j) * 4 : (j * src.width + line) * 4;
            sum += src.data[s + c]! * weights[j - lo]!;
          }
          out.data[d + c] = total ? sum / total : 0;
        }
      }
    }
    return out;
  };
  return pass(pass(r, width, true), height, false);
}

export function threshold(r: Raster, level: number): Raster {
  const plane = lumaPlane(r);
  return fromPlane(plane.map((v) => (v >= level ? 255 : 0)), r);
}

export function adaptiveThreshold(r: Raster, blockSize: number, offset: number): Raster {
  const { width: w, height: h } = r;
  const plane = lumaPlane(r);
  const integral = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += plane[y * w + x]!;
      integral[(y + 1) * (w + 1) + x + 1] = integral[y * (w + 1) + x + 1]! + row;
    }
  }
  const half = Math.floor(blockSize / 2);
  const out = new Float32Array(plane.length);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - half), x1 = Math.min(w, x + half + 1);
      const y0 = Math.max(0, y - half), y1 = Math.min(h, y + half + 1);
      const sum = integral[y1 * (w + 1) + x1]! - integral[y0 * (w + 1) + x1]! - integral[y1 * (w + 1) + x0]! + integral[y0 * (w + 1) + x0]!;
      const mean = sum / ((x1 - x0) * (y1 - y0));
      out[y * w + x] = plane[y * w + x]! > mean - offset ? 255 : 0;
    }
  return fromPlane(out, r);
}

/** Round dots on a rotated grid, sized by how dark each cell is. */
export function halftone(r: Raster, cellSize: number, angleDeg: number): Raster {
  const { width: w, height: h } = r;
  const plane = lumaPlane(r);
  const a = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(a), sin = Math.sin(a);
  const out = new Float32Array(plane.length);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const u = x * cos + y * sin;
      const v = -x * sin + y * cos;
      const cu = (Math.floor(u / cellSize) + 0.5) * cellSize;
      const cv = (Math.floor(v / cellSize) + 0.5) * cellSize;
      const cx = Math.min(w - 1, Math.max(0, Math.round(cu * cos - cv * sin)));
      const cy = Math.min(h - 1, Math.max(0, Math.round(cu * sin + cv * cos)));
      const darkness = 1 - plane[cy * w + cx]! / 255;
      const radius = Math.sqrt(darkness) * cellSize * 0.71;
      out[y * w + x] = Math.hypot(u - cu, v - cv) < radius ? 0 : 255;
    }
  return fromPlane(out, r);
}

export function applyStep(r: Raster, step: Step): Raster {
  const p = step.params;
  const n = (k: string) => Number(p[k]);
  const s = (k: string) => String(p[k]);
  switch (step.type) {
    case "brightnessContrast": return brightnessContrast(r, n("brightness"), n("contrast"));
    case "exposure": return exposure(r, n("ev"));
    case "autoLevels": return autoLevels(r, n("clip"));
    case "clahe": return clahe(r, n("clipLimit"), Math.round(n("tiles")));
    case "gamma": return gamma(r, n("gamma"));
    case "grayscale": return grayscale(r, s("method"));
    case "monochrome": return monochrome(r, s("channel"));
    case "invert": return invert(r);
    case "sharpen": return sharpen(r, n("amount"));
    case "unsharpMask": return unsharpMask(r, n("amount"), n("radius"), n("threshold"));
    case "blur": return blur(r, n("radius"));
    case "rotate": return rotate(r, Number(s("angle")));
    case "flip": return flip(r, s("axis"));
    case "crop": return crop(r, n("x"), n("y"), n("width"), n("height"));
    case "resize": {
      const px = sizeToPixels({ width: n("width"), height: n("height"), unit: s("unit") as "mm" | "in", dpi: n("dpi") }, r.width, r.height);
      return resample(r, px.width, px.height);
    }
    case "threshold": return threshold(r, n("level"));
    case "adaptiveThreshold": return adaptiveThreshold(r, Math.round(n("blockSize")), n("offset"));
    case "halftone": return halftone(r, n("cellSize"), n("angle"));
    case "dither": return dither(r, s("algorithm") as DitherAlgorithm);
  }
}

/** The source through every enabled step, in order. */
export function runSteps(source: Raster, steps: Step[]): Raster {
  let r = source;
  for (const step of steps) if (step.enabled) r = applyStep(r, step);
  return r;
}
