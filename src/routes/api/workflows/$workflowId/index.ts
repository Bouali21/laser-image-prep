import { createFileRoute } from "@tanstack/react-router";
import { deleteWorkflow, getWorkflow, updateWorkflow, workflowChange } from "@/server/workflows";
import { notFound, readJson, requestViewer, unauthorized } from "@/server/http";

export const Route = createFileRoute("/api/workflows/$workflowId/")({
  server: {
    handlers: {
      GET: async ({ request, params }: { request: Request; params: { workflowId: string } }) => {
        const viewer = await requestViewer(request);
        if (!viewer) return unauthorized();
        const workflow = await getWorkflow(viewer, params.workflowId);
        return workflow ? Response.json({ workflow }) : notFound("Workflow");
      },
      PATCH: async ({ request, params }: { request: Request; params: { workflowId: string } }) => {
        const viewer = await requestViewer(request);
        if (!viewer) return unauthorized();
        const body = await readJson(request, workflowChange);
        if ("response" in body) return body.response;
        const result = await updateWorkflow(viewer, params.workflowId, body.data);
        return result.ok ? Response.json({ workflow: result.value }) : Response.json({ error: result.error }, { status: result.status });
      },
      DELETE: async ({ request, params }: { request: Request; params: { workflowId: string } }) => {
        const viewer = await requestViewer(request);
        if (!viewer) return unauthorized();
        const result = await deleteWorkflow(viewer, params.workflowId);
        return result.ok ? Response.json({ ok: true }) : Response.json({ error: result.error }, { status: result.status });
      },
    },
  },
});
