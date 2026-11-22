import type { DitherAlgorithm } from "@/shared/steps";
import { fromPlane, lumaPlane, type Raster } from "./raster";

type Kernel = { divisor: number; taps: [dx: number, dy: number, weight: number][] };

const KERNELS: Record<string, Kernel> = {
  floydSteinberg: { divisor: 16, taps: [[1, 0, 7], [-1, 1, 3], [0, 1, 5], [1, 1, 1]] },
  atkinson: { divisor: 8, taps: [[1, 0, 1], [2, 0, 1], [-1, 1, 1], [0, 1, 1], [1, 1, 1], [0, 2, 1]] },
  jarvis: {
    divisor: 48,
    taps: [[1, 0, 7], [2, 0, 5], [-2, 1, 3], [-1, 1, 5], [0, 1, 7], [1, 1, 5], [2, 1, 3], [-2, 2, 1], [-1, 2, 3], [0, 2, 5], [1, 2, 3], [2, 2, 1]],
  },
  stucki: {
    divisor: 42,
    taps: [[1, 0, 8], [2, 0, 4], [-2, 1, 2], [-1, 1, 4], [0, 1, 8], [1, 1, 4], [2, 1, 2], [-2, 2, 1], [-1, 2, 2], [0, 2, 4], [1, 2, 2], [2, 2, 1]],
  },
  sierra: {
    divisor: 32,
    taps: [[1, 0, 5], [2, 0, 3], [-2, 1, 2], [-1, 1, 4], [0, 1, 5], [1, 1, 4], [2, 1, 2], [-1, 2, 2], [0, 2, 3], [1, 2, 2]],
  },
  sierraLite: { divisor: 4, taps: [[1, 0, 2], [-1, 1, 1], [0, 1, 1]] },
  twoRowSierra: { divisor: 16, taps: [[1, 0, 4], [2, 0, 3], [-2, 1, 1], [-1, 1, 2], [0, 1, 3], [1, 1, 2], [2, 1, 1]] },
  burkes: { divisor: 32, taps: [[1, 0, 8], [2, 0, 4], [-2, 1, 2], [-1, 1, 4], [0, 1, 8], [1, 1, 4], [2, 1, 2]] },
};

function bayer(n: number): number[] {
  let m = [0];
  let size = 1;
  while (size < n) {
    const next = new Array<number>(size * 2 * size * 2);
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const v = m[y * size + x]! * 4;
        next[y * size * 2 + x] = v;
        next[y * size * 2 + x + size] = v + 2;
        next[(y + size) * size * 2 + x] = v + 3;
        next[(y + size) * size * 2 + x + size] = v + 1;
      }
    m = next;
    size *= 2;
  }
  return m.map((v) => ((v + 0.5) / (n * n)) * 255);
}

let blueNoiseCache: Float32Array | null = null;
const BLUE = 64;

/** A 64×64 blue-noise threshold map, ranked by repeatedly filling the largest void. */
export function blueNoiseMap(): Float32Array {
  if (blueNoiseCache) return blueNoiseCache;
  const n = BLUE * BLUE;
  const sigma = 1.9;
  const kernel = new Float32Array(n);
  for (let y = 0; y < BLUE; y++)
    for (let x = 0; x < BLUE; x++) {
      const dx = Math.min(x, BLUE - x);
      const dy = Math.min(y, BLUE - y);
      kernel[y * BLUE + x] = Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
    }
  const energy = new Float32Array(n);
  const rank = new Float32Array(n);
  const taken = new Uint8Array(n);
  // A fixed seed point keeps the map the same on every run.
  let next = 0;
  for (let r = 0; r < n; r++) {
    taken[next] = 1;
    rank[next] = ((r + 0.5) / n) * 255;
    const px = next % BLUE;
    const py = (next / BLUE) | 0;
    for (let y = 0; y < BLUE; y++) {
      const ky = ((y - py + BLUE) % BLUE) * BLUE;
      const row = y * BLUE;
      for (let x = 0; x < BLUE; x++) energy[row + x] += kernel[ky + ((x - px + BLUE) % BLUE)]!;
    }
    let best = -1;
    let bestEnergy = Infinity;
    for (let i = 0; i < n; i++) {
      if (!taken[i] && energy[i]! < bestEnergy) {
        bestEnergy = energy[i]!;
        best = i;
      }
    }
    if (best < 0) break;
    next = best;
  }
  blueNoiseCache = rank;
  return rank;
}

function ordered(plane: Float32Array, width: number, map: ArrayLike<number>, size: number): Float32Array {
  const out = new Float32Array(plane.length);
  for (let p = 0; p < plane.length; p++) {
    const x = p % width;
    const y = (p / width) | 0;
    out[p] = plane[p]! > map[(y % size) * size + (x % size)]! ? 255 : 0;
  }
  return out;
}

function diffuse(plane: Float32Array, width: number, height: number, kernel: Kernel): Float32Array {
  const work = Float32Array.from(plane);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      const old = work[p]!;
      const value = old < 128 ? 0 : 255;
      work[p] = value;
      const error = (old - value) / kernel.divisor;
      for (const [dx, dy, w] of kernel.taps) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < width && ny < height) work[ny * width + nx] += error * w;
      }
    }
  }
  return work;
}

/** Black and white by the given algorithm, from the image's luminance. */
export function dither(raster: Raster, algorithm: DitherAlgorithm): Raster {
  const plane = lumaPlane(raster);
  const { width, height } = raster;
  let out: Float32Array;
  if (algorithm === "bayer2") out = ordered(plane, width, bayer(2), 2);
  else if (algorithm === "bayer4") out = ordered(plane, width, bayer(4), 4);
  else if (algorithm === "bayer8") out = ordered(plane, width, bayer(8), 8);
  else if (algorithm === "blueNoise") out = ordered(plane, width, blueNoiseMap(), BLUE);
  else out = diffuse(plane, width, height, KERNELS[algorithm]!);
  return fromPlane(out, raster);
}
