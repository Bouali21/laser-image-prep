import { env } from "cloudflare:workers";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { images, outputs } from "@/db/schema";
import { stepsSchema } from "@/shared/steps";

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export const renameImageInput = z.object({ name: z.string().trim().min(1, "Give it a name").max(200) }).strict();

export const outputSettingsSchema = z
  .object({
    mode: z.enum(["quick", "adjust", "editor", "run"]),
    material: z.string().max(40).optional(),
    workflowName: z.string().max(200).optional(),
    widthMm: z.number().positive().max(5000),
    heightMm: z.number().positive().max(5000),
    dpi: z.number().int().min(10).max(5000),
    steps: stepsSchema,
  })
  .strict();
export type OutputSettings = z.infer<typeof outputSettingsSchema>;

export interface ImageRow {
  id: string;
  name: string;
  mime: string;
  size: number;
  createdAt: string;
}
export interface OutputRow {
  id: string;
  imageId: string;
  width: number;
  height: number;
  size: number;
  createdAt: string;
  settings: OutputSettings;
}

const shownImage = { id: images.id, name: images.name, mime: images.mime, size: images.size, createdAt: images.createdAt };

/** The image type from its first bytes, or null when it isn't one we take. */
export function sniffImageType(head: Uint8Array): string | null {
  const b = head;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0x42 && b[1] === 0x4d) return "image/bmp";
  const text = String.fromCharCode(...b.subarray(0, 12));
  if (text.startsWith("RIFF") && text.slice(8, 12) === "WEBP") return "image/webp";
  return null;
}

export function listImages(ownerId: string): Promise<ImageRow[]> {
  return db.select(shownImage).from(images).where(eq(images.ownerId, ownerId)).orderBy(desc(images.createdAt), images.id);
}

export async function getImage(ownerId: string, id: string): Promise<ImageRow | null> {
  const [row] = await db.select(shownImage).from(images).where(and(eq(images.id, id), eq(images.ownerId, ownerId)));
  return row ?? null;
}

export async function createImage(ownerId: string, name: string, bytes: Uint8Array): Promise<ImageRow | { error: string; status: number }> {
  if (bytes.length > MAX_UPLOAD_BYTES) return { error: "Images can be up to 25 MB.", status: 413 };
  const mime = sniffImageType(bytes.subarray(0, 16));
  if (!mime) return { error: "Upload a JPEG, PNG, WebP or BMP image.", status: 415 };
  const id = crypto.randomUUID();
  const r2Key = `users/${ownerId}/images/${id}`;
  await env.files.put(r2Key, bytes, { httpMetadata: { contentType: mime } });
  const [row] = await db
    .insert(images)
    .values({ id, ownerId, name: name.trim().slice(0, 200) || "image", mime, size: bytes.length, r2Key })
    .returning(shownImage);
  return row!;
}

export async function renameImage(ownerId: string, id: string, name: string): Promise<ImageRow | null> {
  const [row] = await db
    .update(images)
    .set({ name })
    .where(and(eq(images.id, id), eq(images.ownerId, ownerId)))
    .returning(shownImage);
  return row ?? null;
}

/** Deletes the image, its outputs and their files. False when the user has no such image. */
export async function deleteImage(ownerId: string, id: string): Promise<boolean> {
  const [image] = await db.select({ r2Key: images.r2Key }).from(images).where(and(eq(images.id, id), eq(images.ownerId, ownerId)));
  if (!image) return false;
  const keys = await db.select({ r2Key: outputs.r2Key }).from(outputs).where(and(eq(outputs.imageId, id), eq(outputs.ownerId, ownerId)));
  await db.batch([
    db.delete(outputs).where(and(eq(outputs.imageId, id), eq(outputs.ownerId, ownerId))),
    db.delete(images).where(and(eq(images.id, id), eq(images.ownerId, ownerId))),
  ]);
  await env.files.delete([image.r2Key, ...keys.map((k) => k.r2Key)]);
  return true;
}

export async function imageFile(ownerId: string, id: string): Promise<{ body: ReadableStream; mime: string; name: string } | null> {
  const [image] = await db
    .select({ r2Key: images.r2Key, mime: images.mime, name: images.name })
    .from(images)
    .where(and(eq(images.id, id), eq(images.ownerId, ownerId)));
  if (!image) return null;
  const object = await env.files.get(image.r2Key);
  return object ? { body: object.body, mime: image.mime, name: image.name } : null;
}

function toOutput(row: typeof outputs.$inferSelect): OutputRow {
  return {
    id: row.id,
    imageId: row.imageId,
    width: row.width,
    height: row.height,
    size: row.size,
    createdAt: row.createdAt,
    settings: JSON.parse(row.settings) as OutputSettings,
  };
}

export async function listOutputs(ownerId: string, imageId: string): Promise<OutputRow[]> {
  const rows = await db
    .select()
    .from(outputs)
    .where(and(eq(outputs.imageId, imageId), eq(outputs.ownerId, ownerId)))
    .orderBy(desc(outputs.createdAt), outputs.id);
  return rows.map(toOutput);
}

/** Reads a PNG's pixel size from its header, or null when it isn't a PNG. */
function pngSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (sniffImageType(bytes.subarray(0, 16)) !== "image/png" || bytes.length < 24) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

export async function createOutput(
  ownerId: string,
  imageId: string,
  bytes: Uint8Array,
  settings: OutputSettings,
): Promise<OutputRow | { error: string; status: number }> {
  if (!(await getImage(ownerId, imageId))) return { error: "Image not found", status: 404 };
  if (bytes.length > MAX_UPLOAD_BYTES) return { error: "Outputs can be up to 25 MB.", status: 413 };
  const size = pngSize(bytes);
  if (!size) return { error: "Outputs are PNG images.", status: 415 };
  const id = crypto.randomUUID();
  const r2Key = `users/${ownerId}/outputs/${id}`;
  await env.files.put(r2Key, bytes, { httpMetadata: { contentType: "image/png" } });
  const [row] = await db
    .insert(outputs)
    .values({ id, imageId, ownerId, settings: JSON.stringify(settings), ...size, size: bytes.length, r2Key })
    .returning();
  return toOutput(row!);
}

export async function outputFile(ownerId: string, id: string): Promise<ReadableStream | null> {
  const [row] = await db.select({ r2Key: outputs.r2Key }).from(outputs).where(and(eq(outputs.id, id), eq(outputs.ownerId, ownerId)));
  if (!row) return null;
  return (await env.files.get(row.r2Key))?.body ?? null;
}

export async function deleteOutput(ownerId: string, id: string): Promise<boolean> {
  const [row] = await db
    .delete(outputs)
    .where(and(eq(outputs.id, id), eq(outputs.ownerId, ownerId)))
    .returning({ r2Key: outputs.r2Key });
  if (!row) return false;
  await env.files.delete(row.r2Key);
  return true;
}
