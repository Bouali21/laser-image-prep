import { isAdmin } from "@every-app/sdk/server";
import { ensureUser } from "@/server/users";
import type { Viewer } from "@/server/workflows";

/** The signed-in member as the queries take them, their row made on first sight. */
export async function viewerOf(user: { id: string; email: string; orgRole: string }): Promise<Viewer> {
  await ensureUser(user);
  return { id: user.id, admin: isAdmin(user) };
}
