import { createFileRoute } from "@tanstack/react-router";
import { outputFile } from "@/server/images";
import { fileResponse, notFound, requestViewer, unauthorized } from "@/server/http";

export const Route = createFileRoute("/api/outputs/$outputId/file")({
  server: {
    handlers: {
      GET: async ({ request, params }: { request: Request; params: { outputId: string } }) => {
        const viewer = await requestViewer(request);
        if (!viewer) return unauthorized();
        const body = await outputFile(viewer.id, params.outputId);
        return body ? fileResponse(body, "image/png") : notFound("Output");
      },
    },
  },
});
