// Test images made here, so the checks carry no binary files.
import { deflateSync } from "node:zlib";

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

/** An RGB PNG of a soft, photo-like scene: sky, sun and hills. */
export function scenePng(width = 240, height = 160, seed = 0) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0;
    for (let x = 0; x < width; x++) {
      const i = y * (width * 3 + 1) + 1 + x * 3;
      const hill = height * (0.62 + 0.12 * Math.sin((x + seed * 37) / 23));
      const sun = Math.hypot(x - width * 0.7, y - height * 0.3) < height * 0.14;
      let r, g, b;
      if (sun) [r, g, b] = [250, 220, 140];
      else if (y > hill) [r, g, b] = [60 + (y % 7) * 4, 110 + ((x * y) % 13) * 3, 50];
      else [r, g, b] = [120 + (y * 80) / height, 160 + (y * 50) / height, 230];
      raw[i] = r; raw[i + 1] = g; raw[i + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** The DPI a PNG's pHYs chunk records, or null. */
export function pngDpi(bytes) {
  let at = 8;
  while (at < bytes.length) {
    const length = bytes.readUInt32BE(at);
    const type = bytes.toString("ascii", at + 4, at + 8);
    if (type === "pHYs") {
      const perMetre = bytes.readUInt32BE(at + 8);
      return Math.round((perMetre * 0.0254));
    }
    at += 12 + length;
  }
  return null;
}

export function pngSize(bytes) {
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

export async function upload(runtime, role, name, bytes, type = "image/png") {
  const form = new FormData();
  form.append("file", new Blob([bytes], { type }), name);
  const response = await runtime.fetch("/api/images", { role, method: "POST", body: form });
  return response;
}

export async function saveOutput(runtime, role, imageId, bytes, settings) {
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: "image/png" }), "output.png");
  form.append("settings", JSON.stringify(settings));
  return runtime.fetch(`/api/images/${imageId}/outputs`, { role, method: "POST", body: form });
}

export function json(runtime, path, role, method, body) {
  return runtime.fetch(path, {
    role,
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

export const SAMPLE_STEPS = [
  { type: "grayscale", enabled: true, params: { method: "luminance" } },
  { type: "brightnessContrast", enabled: true, params: { brightness: 5, contrast: 20 } },
  { type: "gamma", enabled: false, params: { gamma: 1.2 } },
  { type: "dither", enabled: true, params: { algorithm: "atkinson" } },
];
