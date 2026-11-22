import { createFileRoute } from "@tanstack/react-router";
import { duplicateWorkflow } from "@/server/workflows";
import { notFound, requestViewer, unauthorized } from "@/server/http";

export const Route = createFileRoute("/api/workflows/$workflowId/duplicate")({
  server: {
    handlers: {
      POST: async ({ request, params }: { request: Request; params: { workflowId: string } }) => {
        const viewer = await requestViewer(request);
        if (!viewer) return unauthorized();
        const workflow = await duplicateWorkflow(viewer, params.workflowId);
        return workflow ? Response.json({ workflow }, { status: 201 }) : notFound("Workflow");
      },
    },
  },
});
