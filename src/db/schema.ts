import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

const createdAt = () =>
  text("created_at")
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`);

/** One row per Gateway user (`user.id`), made the first time they use the app. */
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  createdAt: createdAt(),
});

/** A source photo; its bytes are in R2 under `r2Key`. */
export const images = sqliteTable(
  "images",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id),
    name: text("name").notNull(),
    mime: text("mime").notNull(),
    size: integer("size").notNull(),
    r2Key: text("r2_key").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("images_owner_idx").on(t.ownerId, t.createdAt)],
);

/** A prepared PNG saved under its source image, with the settings that made it. */
export const outputs = sqliteTable(
  "outputs",
  {
    id: text("id").primaryKey(),
    imageId: text("image_id")
      .notNull()
      .references(() => images.id, { onDelete: "cascade" }),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id),
    settings: text("settings").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    size: integer("size").notNull(),
    r2Key: text("r2_key").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("outputs_image_idx").on(t.imageId)],
);

/** A named, ordered list of steps; private to its owner unless shared. */
export const workflows = sqliteTable(
  "workflows",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    steps: text("steps").notNull(),
    shared: integer("shared", { mode: "boolean" }).notNull().default(false),
    createdAt: createdAt(),
    updatedAt: createdAt(),
  },
  (t) => [index("workflows_owner_idx").on(t.ownerId), index("workflows_shared_idx").on(t.shared)],
);
