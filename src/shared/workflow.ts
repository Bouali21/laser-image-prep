import { z } from "zod";
import { stepsSchema } from "./steps";

/** A workflow as created, saved from the editor or imported from a file. Extra fields in a file are ignored. */
export const workflowInput = z
  .object({
    name: z.string().trim().min(1, "Give it a name").max(120),
    description: z.string().trim().max(1000).default(""),
    steps: stepsSchema,
  })
  .strip();

export const workflowChange = z
  .object({
    name: z.string().trim().min(1, "Give it a name").max(120).optional(),
    description: z.string().trim().max(1000).optional(),
    steps: stepsSchema.optional(),
    shared: z.boolean().optional(),
  })
  .strict();
