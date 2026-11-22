import { createFileRoute } from "@tanstack/react-router";
import { createImage, listImages } from "@/server/images";
import { requestViewer, unauthorized } from "@/server/http";

// The member's own images: the list, and uploads (multipart, field "file").
export const Route = createFileRoute("/api/images/")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const viewer = await requestViewer(request);
        if (!viewer) return unauthorized();
        return Response.json({ images: await listImages(viewer.id) });
      },
      POST: async ({ request }: { request: Request }) => {
        const viewer = await requestViewer(request);
        if (!viewer) return unauthorized();
        const form = await request.formData().catch(() => null);
        const file = form?.get("file");
        if (!file || typeof file === "string") return Response.json({ error: "Attach an image as \"file\"." }, { status: 400 });
        const result = await createImage(viewer.id, file.name, new Uint8Array(await file.arrayBuffer()));
        if ("error" in result) return Response.json({ error: result.error }, { status: result.status });
        return Response.json({ image: result }, { status: 201 });
      },
    },
  },
});
