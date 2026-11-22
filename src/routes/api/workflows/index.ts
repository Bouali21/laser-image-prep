import { createFileRoute } from "@tanstack/react-router";
import { createWorkflow, listWorkflows, workflowInput } from "@/server/workflows";
import { readJson, requestViewer, unauthorized } from "@/server/http";

// The member's workflows and everyone's shared ones; POST creates or imports one.
export const Route = createFileRoute("/api/workflows/")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const viewer = await requestViewer(request);
        if (!viewer) return unauthorized();
        return Response.json({ workflows: await listWorkflows(viewer) });
      },
      POST: async ({ request }: { request: Request }) => {
        const viewer = await requestViewer(request);
        if (!viewer) return unauthorized();
        const body = await readJson(request, workflowInput);
        if ("response" in body) return body.response;
        return Response.json({ workflow: await createWorkflow(viewer, body.data) }, { status: 201 });
      },
    },
  },
});
