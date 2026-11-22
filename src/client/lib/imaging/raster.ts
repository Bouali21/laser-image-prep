/** An RGBA image with float channels in 0..255. */
export interface Raster {
  width: number;
  height: number;
  data: Float32Array;
}

export function createRaster(width: number, height: number): Raster {
  return { width, height, data: new Float32Array(width * height * 4) };
}

export function fromRgba(width: number, height: number, rgba: ArrayLike<number>): Raster {
  return { width, height, data: Float32Array.from(rgba) };
}

export function toRgba(raster: Raster): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(raster.data.length);
  for (let i = 0; i < out.length; i++) out[i] = Math.round(raster.data[i]!);
  return out;
}

export function luminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Luminance per pixel. */
export function lumaPlane(raster: Raster): Float32Array {
  const { data } = raster;
  const out = new Float32Array(raster.width * raster.height);
  for (let p = 0, i = 0; p < out.length; p++, i += 4) out[p] = luminance(data[i]!, data[i + 1]!, data[i + 2]!);
  return out;
}

/** A gray raster from one plane, alpha kept from `like`. */
export function fromPlane(plane: Float32Array, like: Raster): Raster {
  const out = createRaster(like.width, like.height);
  for (let p = 0, i = 0; p < plane.length; p++, i += 4) {
    const v = plane[p]!;
    out.data[i] = v;
    out.data[i + 1] = v;
    out.data[i + 2] = v;
    out.data[i + 3] = like.data[i + 3]!;
  }
  return out;
}

/** Applies `f` to each colour channel; alpha stays. */
export function mapChannels(raster: Raster, f: (v: number) => number): Raster {
  const out = createRaster(raster.width, raster.height);
  const { data } = raster;
  for (let i = 0; i < data.length; i += 4) {
    out.data[i] = clamp(f(data[i]!));
    out.data[i + 1] = clamp(f(data[i + 1]!));
    out.data[i + 2] = clamp(f(data[i + 2]!));
    out.data[i + 3] = data[i + 3]!;
  }
  return out;
}

export function clamp(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

/** Flattens transparency onto white, as an engraving does. */
export function flatten(raster: Raster): Raster {
  const out = createRaster(raster.width, raster.height);
  const { data } = raster;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3]! / 255;
    out.data[i] = data[i]! * a + 255 * (1 - a);
    out.data[i + 1] = data[i + 1]! * a + 255 * (1 - a);
    out.data[i + 2] = data[i + 2]! * a + 255 * (1 - a);
    out.data[i + 3] = 255;
  }
  return out;
}
