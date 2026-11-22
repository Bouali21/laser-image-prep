// Uploads and downloads go straight to the app's file routes (src/routes/api).
import type { OutputSettings } from "@/server/images";

export const imageFileUrl = (id: string) => `/api/images/${id}/file`;
export const outputFileUrl = (id: string) => `/api/outputs/${id}/file`;

async function failure(response: Response): Promise<Error> {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return new Error(body?.error ?? `The server answered ${response.status}.`);
}

export async function uploadImage(file: File): Promise<{ id: string; name: string }> {
  const form = new FormData();
  form.append("file", file, file.name);
  const response = await fetch("/api/images", { method: "POST", body: form });
  if (!response.ok) throw await failure(response);
  return ((await response.json()) as { image: { id: string; name: string } }).image;
}

export async function saveOutput(imageId: string, png: Uint8Array<ArrayBuffer>, settings: OutputSettings): Promise<void> {
  const form = new FormData();
  form.append("file", new Blob([png], { type: "image/png" }), "output.png");
  form.append("settings", JSON.stringify(settings));
  const response = await fetch(`/api/images/${imageId}/outputs`, { method: "POST", body: form });
  if (!response.ok) throw await failure(response);
}

export async function fetchImage(id: string): Promise<Blob> {
  const response = await fetch(imageFileUrl(id));
  if (!response.ok) throw await failure(response);
  return response.blob();
}
export const ACCEPT = "image/jpeg,image/png,image/webp,image/bmp,.jpg,.jpeg,.png,.webp,.bmp";
