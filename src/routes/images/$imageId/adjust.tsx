import { createFileRoute } from "@tanstack/react-router";
import { FlipHorizontal2, FlipVertical2, RotateCcw, RotateCw } from "lucide-react";
import { useMemo, useState } from "react";
import { SegmentedToggle } from "@/client/components/SegmentedToggle";
import { CropBox, FULL_CROP, type CropRect } from "@/client/components/imaging/CropBox";
import { ExportBar } from "@/client/components/imaging/ExportBar";
import { MaterialPicker } from "@/client/components/imaging/MaterialPicker";
import { ModeFrame } from "@/client/components/imaging/ModeFrame";
import { PreviewCanvas } from "@/client/components/imaging/PreviewCanvas";
import { Section } from "@/client/components/imaging/Section";
import { SizeFields, validSize } from "@/client/components/imaging/SizeFields";
import { Button } from "@/client/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/client/components/ui/select";
import { Slider } from "@/client/components/ui/slider";
import { useRendered, useSource } from "@/client/hooks/useImaging";
import { sizeToPixels } from "@/client/lib/imaging/size";
import { MATERIALS, materialById, materialSteps, type OutputSize } from "@/shared/materials";
import { makeStep, type Step } from "@/shared/steps";
import { getImageDetail } from "@/serverFunctions/images";

export const Route = createFileRoute("/images/$imageId/adjust")({
  ssr: false,
  loader: ({ params }) => getImageDetail({ data: { id: params.imageId } }),
  head: () => ({ meta: [{ title: "Adjust · Laser Image Prep" }] }),
  component: AdjustPage,
});

const ASPECTS = [
  { value: "free", label: "Free" },
  { value: "1", label: "1:1" },
  { value: "1.3333", label: "4:3" },
  { value: "1.5", label: "3:2" },
  { value: "1.4", label: "7:5" },
  { value: "1.7778", label: "16:9" },
];

function AdjustPage() {
  const detail = Route.useLoaderData();
  const { imageId } = Route.useParams();
  const { source, error } = useSource(imageId);
  const [crop, setCrop] = useState<CropRect>(FULL_CROP);
  const [aspect, setAspect] = useState("free");
  const [turns, setTurns] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [materialId, setMaterialId] = useState(MATERIALS[0]!.id);
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [sharpness, setSharpness] = useState(0);
  const [showing, setShowing] = useState<"before" | "after">("after");
  const [size, setSize] = useState<OutputSize>({ width: 100, height: 0, unit: "mm", dpi: 254 });
  const material = materialById(materialId)!;
  const ok = validSize(size);

  const geometry = useMemo(() => {
    const steps: Step[] = [];
    if (crop.x > 0 || crop.y > 0 || crop.width < 100 || crop.height < 100) steps.push(makeStep("crop", { ...crop }));
    const quarter = ((turns % 4) + 4) % 4;
    if (quarter) steps.push(makeStep("rotate", { angle: String(quarter * 90) }));
    if (flipH) steps.push(makeStep("flip", { axis: "horizontal" }));
    if (flipV) steps.push(makeStep("flip", { axis: "vertical" }));
    return steps;
  }, [crop, turns, flipH, flipV]);

  const steps = useMemo(
    () => [
      ...geometry,
      ...materialSteps(
        { ...material, sharpen: material.sharpen + sharpness * 0.3 },
        ok ? size : null,
        brightness || contrast ? [makeStep("brightnessContrast", { brightness: brightness * 5, contrast: contrast * 5 })] : [],
      ),
    ],
    [geometry, material, sharpness, ok, size, brightness, contrast],
  );
  const after = useRendered(source, steps);
  const before = useRendered(source, geometry);
  const shown = showing === "after" ? after : before;

  const geomSize = source
    ? (() => {
        const w = Math.max(1, Math.round((source.width * crop.width) / 100));
        const h = Math.max(1, Math.round((source.height * crop.height) / 100));
        return turns % 2 ? { w: h, h: w } : { w, h };
      })()
    : null;
  const pixels = geomSize && ok ? sizeToPixels(size, geomSize.w, geomSize.h) : null;

  const slider = (label: string, value: number, set: (v: number) => void, min: number, max: number, testId: string) => (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span data-testid={testId} className="tabular-nums text-muted-foreground">{value}</span>
      </div>
      <Slider thumbLabel={label} min={min} max={max} step={1} value={[value]} onValueChange={(v) => set(Array.isArray(v) ? v[0]! : v)} />
    </div>
  );

  return (
    <ModeFrame imageId={imageId} imageName={detail?.image.name ?? null} title="Adjust" error={error}>
      <Section title="Crop and turn">
        <div className="flex flex-wrap items-center gap-2">
          <Select items={ASPECTS} value={aspect} onValueChange={(v) => { if (v) { setAspect(v); setCrop(FULL_CROP); } }}>
            <SelectTrigger size="sm" aria-label="Aspect ratio">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ASPECTS.map((a) => (
                <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => setCrop(FULL_CROP)} disabled={crop === FULL_CROP}>Reset crop</Button>
          <Button variant="outline" size="icon-sm" aria-label="Rotate left" onClick={() => setTurns((t) => t + 3)}><RotateCcw aria-hidden /></Button>
          <Button variant="outline" size="icon-sm" aria-label="Rotate right" onClick={() => setTurns((t) => t + 1)}><RotateCw aria-hidden /></Button>
          <Button variant={flipH ? "default" : "outline"} size="icon-sm" aria-label="Flip horizontal" aria-pressed={flipH} onClick={() => setFlipH((f) => !f)}><FlipHorizontal2 aria-hidden /></Button>
          <Button variant={flipV ? "default" : "outline"} size="icon-sm" aria-label="Flip vertical" aria-pressed={flipV} onClick={() => setFlipV((f) => !f)}><FlipVertical2 aria-hidden /></Button>
        </div>
        {source ? <CropBox source={source} crop={crop} aspect={aspect === "free" ? null : Number(aspect)} onChange={setCrop} /> : null}
      </Section>
      <Section title="Material">
        <MaterialPicker value={materialId} onChange={setMaterialId} />
      </Section>
      <Section title="Fine-tune">
        <div className="grid gap-4 sm:grid-cols-3">
          {slider("Brightness", brightness, setBrightness, -10, 10, "brightness-value")}
          {slider("Contrast", contrast, setContrast, -10, 10, "contrast-value")}
          {slider("Sharpness", sharpness, setSharpness, 0, 10, "sharpness-value")}
        </div>
      </Section>
      <Section title="Output size">
        <SizeFields size={size} onChange={setSize} pixels={pixels} />
      </Section>
      <div className="space-y-2">
        <SegmentedToggle
          showLabels
          value={showing}
          onChange={setShowing}
          items={[
            { value: "before", label: "Before", icon: null },
            { value: "after", label: "After", icon: null },
          ]}
        />
        <PreviewCanvas raster={shown.result} ready={!shown.rendering} showing={showing} label={showing === "after" ? "Prepared image" : "Original image"} />
      </div>
      <ExportBar
        imageId={imageId}
        imageName={detail?.image.name ?? "image"}
        suffix={material.id}
        result={after.rendering ? null : after.result}
        dpi={size.dpi}
        settings={{ mode: "adjust", material: material.id, steps }}
      />
    </ModeFrame>
  );
}
