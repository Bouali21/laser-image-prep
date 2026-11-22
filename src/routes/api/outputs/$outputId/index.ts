import { createFileRoute } from "@tanstack/react-router";
import { deleteOutput } from "@/server/images";
import { notFound, requestViewer, unauthorized } from "@/server/http";

export const Route = createFileRoute("/api/outputs/$outputId/")({
  server: {
    handlers: {
      DELETE: async ({ request, params }: { request: Request; params: { outputId: string } }) => {
        const viewer = await requestViewer(request);
        if (!viewer) return unauthorized();
        return (await deleteOutput(viewer.id, params.outputId)) ? Response.json({ ok: true }) : notFound("Output");
      },
    },
  },
});
