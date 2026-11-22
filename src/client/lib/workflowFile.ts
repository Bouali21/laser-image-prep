import { z } from "zod";
import { downloadBytes, outputName } from "@/client/lib/imaging/browser";
import type { Step } from "@/shared/steps";
import { workflowInput } from "@/shared/workflow";

/** Reads a workflow file; throws a sentence saying what's wrong. */
export async function readWorkflowFile(file: File): Promise<z.infer<typeof workflowInput>> {
  let json: unknown;
  try {
    json = JSON.parse(await file.text());
  } catch {
    throw new Error("That file isn't a valid workflow: it isn't JSON.");
  }
  const parsed = workflowInput.safeParse(json);
  if (!parsed.success) throw new Error(`That file isn't a valid workflow: ${parsed.error.issues[0]?.message ?? "unknown content"}.`);
  return parsed.data;
}

export function downloadWorkflow(workflow: { name: string; description: string; steps: Step[] }): void {
  const body = JSON.stringify({ name: workflow.name, description: workflow.description, steps: workflow.steps }, null, 2);
  downloadBytes(body, outputName(workflow.name, "workflow", "json"), "application/json");
}
