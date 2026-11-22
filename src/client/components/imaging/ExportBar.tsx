import { useState } from "react";
import { Download, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/client/components/ui/button";
import { saveOutput } from "@/client/lib/api";
import { downloadBytes, encodeLightBurn, encodePng, outputName } from "@/client/lib/imaging/browser";
import type { Raster } from "@/client/lib/imaging/raster";
import { pixelsToMm } from "@/client/lib/imaging/size";
import type { OutputSettings } from "@/server/images";

/** Download the result as PNG or a LightBurn project, or keep it under its image. */
export function ExportBar({
  imageId,
  imageName,
  suffix,
  result,
  dpi,
  settings,
}: {
  imageId: string;
  imageName: string;
  suffix: string;
  result: Raster | null;
  dpi: number;
  settings: Omit<OutputSettings, "widthMm" | "heightMm" | "dpi">;
}) {
  const [busy, setBusy] = useState<"png" | "lbrn" | "save" | null>(null);
  async function act(kind: "png" | "lbrn" | "save") {
    if (!result) return;
    setBusy(kind);
    try {
      if (kind === "png") {
        downloadBytes(await encodePng(result, dpi), outputName(imageName, suffix, "png"), "image/png");
      } else if (kind === "lbrn") {
        downloadBytes(await encodeLightBurn(result, dpi), outputName(imageName, suffix, "lbrn2"), "application/xml");
      } else {
        await saveOutput(imageId, await encodePng(result, dpi), {
          ...settings,
          widthMm: Number(pixelsToMm(result.width, dpi).toFixed(2)),
          heightMm: Number(pixelsToMm(result.height, dpi).toFixed(2)),
          dpi,
        });
        toast.success("Saved to library");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That didn't work.");
    } finally {
      setBusy(null);
    }
  }
  const disabled = !result || busy !== null;
  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={() => act("png")} disabled={disabled} pending={busy === "png"}>
        <Download aria-hidden /> Download PNG
      </Button>
      <Button variant="outline" onClick={() => act("lbrn")} disabled={disabled} pending={busy === "lbrn"}>
        <Download aria-hidden /> Download LightBurn
      </Button>
      <Button variant="outline" onClick={() => act("save")} disabled={disabled} pending={busy === "save"}>
        <Save aria-hidden /> Save to library
      </Button>
    </div>
  );
}
