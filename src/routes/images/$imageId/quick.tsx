import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ExportBar } from "@/client/components/imaging/ExportBar";
import { MaterialPicker } from "@/client/components/imaging/MaterialPicker";
import { ModeFrame } from "@/client/components/imaging/ModeFrame";
import { PreviewCanvas } from "@/client/components/imaging/PreviewCanvas";
import { Section } from "@/client/components/imaging/Section";
import { SizeFields, validSize } from "@/client/components/imaging/SizeFields";
import { useRendered, useSource } from "@/client/hooks/useImaging";
import { sizeToPixels } from "@/client/lib/imaging/size";
import { MATERIALS, materialById, materialSteps, type OutputSize } from "@/shared/materials";
import { getImageDetail } from "@/serverFunctions/images";

export const Route = createFileRoute("/images/$imageId/quick")({
  ssr: false,
  loader: ({ params }) => getImageDetail({ data: { id: params.imageId } }),
  head: () => ({ meta: [{ title: "One click · Laser Image Prep" }] }),
  component: QuickPage,
});

function QuickPage() {
  const detail = Route.useLoaderData();
  const { imageId } = Route.useParams();
  const { source, error } = useSource(imageId);
  const [materialId, setMaterialId] = useState(MATERIALS[0]!.id);
  const [size, setSize] = useState<OutputSize>({ width: 100, height: 0, unit: "mm", dpi: 254 });
  const material = materialById(materialId)!;
  const ok = validSize(size);
  const steps = useMemo(() => materialSteps(material, ok ? size : null), [material, size, ok]);
  const { result, rendering } = useRendered(source, steps);
  const pixels = source && ok ? sizeToPixels(size, source.width, source.height) : null;

  return (
    <ModeFrame imageId={imageId} imageName={detail?.image.name ?? null} title="One click" error={error}>
      <Section title="Material">
        <MaterialPicker value={materialId} onChange={setMaterialId} />
      </Section>
      <Section title="Output size">
        <SizeFields size={size} onChange={setSize} pixels={pixels} />
      </Section>
      <PreviewCanvas raster={result} ready={!rendering} label={`${material.label} preview`} />
      <ExportBar
        imageId={imageId}
        imageName={detail?.image.name ?? "image"}
        suffix={material.id}
        result={rendering ? null : result}
        dpi={size.dpi}
        settings={{ mode: "quick", material: material.id, steps }}
      />
    </ModeFrame>
  );
}
