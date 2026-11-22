import { sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

/** Makes the user's row the first time they're seen, and keeps their email current. */
export async function ensureUser(user: { id: string; email: string }): Promise<void> {
  await db
    .insert(users)
    .values({ id: user.id, email: user.email })
    .onConflictDoUpdate({ target: users.id, set: { email: sql`excluded.email` } });
}
