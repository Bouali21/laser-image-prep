import { createServerFn } from "@tanstack/react-start";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import { z } from "zod";
import * as workflows from "@/server/workflows";
import { viewerOf } from "./viewer";

const idInput = z.object({ id: z.string().min(1).max(64) }).strict();

export const getWorkflows = createServerFn()
  .middleware([ensureUserMiddleware])
  .handler(async ({ context }) => workflows.listWorkflows(await viewerOf(context.user)));

export const getWorkflow = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => idInput.parse(data))
  .handler(async ({ data, context }) => workflows.getWorkflow(await viewerOf(context.user), data.id));

/** Creates one from the editor or an imported file; unknown steps and out-of-range values are refused. */
export const createWorkflow = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => workflows.workflowInput.parse(data))
  .handler(async ({ data, context }) => workflows.createWorkflow(await viewerOf(context.user), data));

export const updateWorkflow = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => idInput.extend({ change: workflows.workflowChange }).parse(data))
  .handler(async ({ data, context }) => {
    const result = await workflows.updateWorkflow(await viewerOf(context.user), data.id, data.change);
    if (!result.ok) throw new Error(result.error);
    return result.value;
  });

export const deleteWorkflow = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => idInput.parse(data))
  .handler(async ({ data, context }) => {
    const result = await workflows.deleteWorkflow(await viewerOf(context.user), data.id);
    if (!result.ok) throw new Error(result.error);
    return null;
  });

export const duplicateWorkflow = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => idInput.parse(data))
  .handler(async ({ data, context }) => {
    const copy = await workflows.duplicateWorkflow(await viewerOf(context.user), data.id);
    if (!copy) throw new Error("Workflow not found");
    return copy;
  });
