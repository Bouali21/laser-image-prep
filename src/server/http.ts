import { env } from "cloudflare:workers";
import { getEveryAppUser, isAdmin } from "@every-app/sdk/server";
import type { z } from "zod";
import { ensureUser } from "./users";
import type { Viewer } from "./workflows";

/** The signed-in caller of a server route, their row made on first sight. Null only if the Gateway sent no one. */
export async function requestViewer(request: Request): Promise<(Viewer & { email: string }) | null> {
  const user = await getEveryAppUser(request, env);
  if (!user) return null;
  await ensureUser(user);
  return { id: user.id, email: user.email, admin: isAdmin(user) };
}

export const unauthorized = () => Response.json({ error: "Sign in through your Gateway." }, { status: 401 });
export const notFound = (what: string) => Response.json({ error: `${what} not found` }, { status: 404 });

/** A JSON body parsed by `schema`, or the 400 to answer with. */
export async function readJson<T extends z.ZodType>(request: Request, schema: T): Promise<{ data: z.infer<T> } | { response: Response }> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { response: Response.json({ error: "Send a JSON body." }, { status: 400 }) };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return { response: Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 }) };
  return { data: parsed.data };
}

export function fileResponse(body: ReadableStream, mime: string, name?: string): Response {
  const headers: Record<string, string> = { "content-type": mime, "cache-control": "private, max-age=3600", "x-content-type-options": "nosniff" };
  if (name) headers["content-disposition"] = `inline; filename*=UTF-8''${encodeURIComponent(name)}`;
  return new Response(body, { headers });
}
