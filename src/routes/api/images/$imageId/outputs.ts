import { createFileRoute } from "@tanstack/react-router";
import { createOutput, outputSettingsSchema } from "@/server/images";
import { requestViewer, unauthorized } from "@/server/http";

// Saves a prepared PNG under one of the member's images (multipart: "file" and "settings" as JSON).
export const Route = createFileRoute("/api/images/$imageId/outputs")({
  server: {
    handlers: {
      POST: async ({ request, params }: { request: Request; params: { imageId: string } }) => {
        const viewer = await requestViewer(request);
        if (!viewer) return unauthorized();
        const form = await request.formData().catch(() => null);
        const file = form?.get("file");
        const raw = form?.get("settings");
        if (!file || typeof file === "string" || typeof raw !== "string")
          return Response.json({ error: "Attach \"file\" and \"settings\"." }, { status: 400 });
        let settings;
        try {
          settings = outputSettingsSchema.safeParse(JSON.parse(raw));
        } catch {
          return Response.json({ error: "Settings must be JSON." }, { status: 400 });
        }
        if (!settings.success) return Response.json({ error: settings.error.issues[0]?.message ?? "Invalid settings" }, { status: 400 });
        const result = await createOutput(viewer.id, params.imageId, new Uint8Array(await file.arrayBuffer()), settings.data);
        if ("error" in result) return Response.json({ error: result.error }, { status: result.status });
        return Response.json({ output: result }, { status: 201 });
      },
    },
  },
});
