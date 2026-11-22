import { createFileRoute } from "@tanstack/react-router";
import { deleteImage, getImage, listOutputs, renameImageInput, renameImage } from "@/server/images";
import { notFound, readJson, requestViewer, unauthorized } from "@/server/http";

export const Route = createFileRoute("/api/images/$imageId/")({
  server: {
    handlers: {
      GET: async ({ request, params }: { request: Request; params: { imageId: string } }) => {
        const viewer = await requestViewer(request);
        if (!viewer) return unauthorized();
        const image = await getImage(viewer.id, params.imageId);
        if (!image) return notFound("Image");
        return Response.json({ image, outputs: await listOutputs(viewer.id, image.id) });
      },
      PATCH: async ({ request, params }: { request: Request; params: { imageId: string } }) => {
        const viewer = await requestViewer(request);
        if (!viewer) return unauthorized();
        const body = await readJson(request, renameImageInput);
        if ("response" in body) return body.response;
        const image = await renameImage(viewer.id, params.imageId, body.data.name);
        return image ? Response.json({ image }) : notFound("Image");
      },
      DELETE: async ({ request, params }: { request: Request; params: { imageId: string } }) => {
        const viewer = await requestViewer(request);
        if (!viewer) return unauthorized();
        return (await deleteImage(viewer.id, params.imageId)) ? Response.json({ ok: true }) : notFound("Image");
      },
    },
  },
});
