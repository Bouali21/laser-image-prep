import { createFileRoute } from "@tanstack/react-router";
import { imageFile } from "@/server/images";
import { fileResponse, notFound, requestViewer, unauthorized } from "@/server/http";

export const Route = createFileRoute("/api/images/$imageId/file")({
  server: {
    handlers: {
      GET: async ({ request, params }: { request: Request; params: { imageId: string } }) => {
        const viewer = await requestViewer(request);
        if (!viewer) return unauthorized();
        const file = await imageFile(viewer.id, params.imageId);
        return file ? fileResponse(file.body, file.mime, file.name) : notFound("Image");
      },
    },
  },
});
