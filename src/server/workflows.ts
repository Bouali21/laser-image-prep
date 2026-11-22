import { and, asc, desc, eq, or, sql } from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/db";
import { users, workflows } from "@/db/schema";
import type { Step } from "@/shared/steps";
import { workflowChange, workflowInput } from "@/shared/workflow";

export { workflowChange, workflowInput };

export interface Workflow {
  id: string;
  name: string;
  description: string;
  steps: Step[];
  shared: boolean;
  ownerEmail: string;
  updatedAt: string;
  /** The caller owns it: may rename, change steps, share and delete. */
  canEdit: boolean;
  /** The caller may delete or unshare it: the owner, or an admin while it's shared. */
  canModerate: boolean;
}

export interface Viewer {
  id: string;
  admin: boolean;
}

const shown = {
  id: workflows.id,
  ownerId: workflows.ownerId,
  name: workflows.name,
  description: workflows.description,
  steps: workflows.steps,
  shared: workflows.shared,
  updatedAt: workflows.updatedAt,
  ownerEmail: users.email,
};

type Row = { id: string; ownerId: string; name: string; description: string; steps: string; shared: boolean; updatedAt: string; ownerEmail: string };

function toWorkflow(row: Row, viewer: Viewer): Workflow {
  const own = row.ownerId === viewer.id;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    steps: JSON.parse(row.steps) as Step[],
    shared: row.shared,
    ownerEmail: row.ownerEmail,
    updatedAt: row.updatedAt,
    canEdit: own,
    canModerate: own || (viewer.admin && row.shared),
  };
}

/** What the viewer can see: their own and every shared one. */
const visible = (viewer: Viewer) => or(eq(workflows.ownerId, viewer.id), eq(workflows.shared, true));

export async function listWorkflows(viewer: Viewer): Promise<Workflow[]> {
  const rows = await db
    .select(shown)
    .from(workflows)
    .innerJoin(users, eq(users.id, workflows.ownerId))
    .where(visible(viewer))
    .orderBy(desc(workflows.updatedAt), asc(workflows.id));
  return rows.map((r) => toWorkflow(r, viewer));
}

export async function getWorkflow(viewer: Viewer, id: string): Promise<Workflow | null> {
  const [row] = await db
    .select(shown)
    .from(workflows)
    .innerJoin(users, eq(users.id, workflows.ownerId))
    .where(and(eq(workflows.id, id), visible(viewer)));
  return row ? toWorkflow(row, viewer) : null;
}

export async function createWorkflow(viewer: Viewer, input: z.infer<typeof workflowInput>): Promise<Workflow> {
  const id = crypto.randomUUID();
  await db.insert(workflows).values({
    id,
    ownerId: viewer.id,
    name: input.name,
    description: input.description,
    steps: JSON.stringify(input.steps),
  });
  return (await getWorkflow(viewer, id))!;
}

export type Outcome<T> = { ok: true; value: T } | { ok: false; status: 403 | 404; error: string };

const notFound = { ok: false, status: 404, error: "Workflow not found" } as const;
const forbidden = (error: string) => ({ ok: false, status: 403, error }) as const;

export async function updateWorkflow(viewer: Viewer, id: string, change: z.infer<typeof workflowChange>): Promise<Outcome<Workflow>> {
  const current = await getWorkflow(viewer, id);
  if (!current) return notFound;
  const { shared, ...content } = change;
  const editsContent = Object.values(content).some((v) => v !== undefined);
  if (editsContent && !current.canEdit) return forbidden("Only its owner can change this workflow.");
  if (shared !== undefined && !current.canEdit && !(shared === false && current.canModerate))
    return forbidden("Only its owner can share this workflow.");
  await db
    .update(workflows)
    .set({
      ...(content.name !== undefined && { name: content.name }),
      ...(content.description !== undefined && { description: content.description }),
      ...(content.steps !== undefined && { steps: JSON.stringify(content.steps) }),
      ...(shared !== undefined && { shared }),
      updatedAt: sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`,
    })
    .where(eq(workflows.id, id));
  const updated = await getWorkflow(viewer, id);
  // An admin who unshares someone else's workflow can no longer see it.
  return updated ? { ok: true, value: updated } : { ok: true, value: { ...current, shared: false, canModerate: false } };
}

export async function deleteWorkflow(viewer: Viewer, id: string): Promise<Outcome<null>> {
  const current = await getWorkflow(viewer, id);
  if (!current) return notFound;
  if (!current.canModerate) return forbidden("Only its owner or an admin can delete this workflow.");
  await db.delete(workflows).where(eq(workflows.id, id));
  return { ok: true, value: null };
}

export async function duplicateWorkflow(viewer: Viewer, id: string): Promise<Workflow | null> {
  const current = await getWorkflow(viewer, id);
  if (!current) return null;
  return createWorkflow(viewer, {
    name: `${current.name} (copy)`.slice(0, 120),
    description: current.description,
    steps: current.steps,
  });
}
