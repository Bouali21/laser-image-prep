import { useId } from "react";
import { SegmentedToggle } from "@/client/components/SegmentedToggle";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import type { OutputSize } from "@/shared/materials";

/** Physical width (and optionally height), unit and DPI, with the pixel size they make. */
export function SizeFields({
  size,
  onChange,
  pixels,
  withHeight = false,
}: {
  size: OutputSize;
  onChange: (size: OutputSize) => void;
  pixels: { width: number; height: number } | null;
  withHeight?: boolean;
}) {
  const id = useId();
  const number = (v: string) => (v === "" ? 0 : Number(v));
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="w-28 space-y-1.5">
        <Label htmlFor={`${id}-w`}>Width</Label>
        <Input id={`${id}-w`} type="number" inputMode="decimal" min={0.1} step="any" value={size.width || ""}
          onChange={(e) => onChange({ ...size, width: number(e.target.value) })} />
      </div>
      {withHeight ? (
        <div className="w-28 space-y-1.5">
          <Label htmlFor={`${id}-h`}>Height</Label>
          <Input id={`${id}-h`} type="number" inputMode="decimal" min={0} step="any" placeholder="Auto" value={size.height || ""}
            onChange={(e) => onChange({ ...size, height: number(e.target.value) })} />
        </div>
      ) : null}
      <div className="pb-2">
        <SegmentedToggle
          showLabels
          value={size.unit}
          onChange={(unit) => onChange({ ...size, unit })}
          items={[
            { value: "mm", label: "mm", icon: null },
            { value: "in", label: "in", icon: null },
          ]}
        />
      </div>
      <div className="w-24 space-y-1.5">
        <Label htmlFor={`${id}-dpi`}>DPI</Label>
        <Input id={`${id}-dpi`} type="number" inputMode="numeric" min={50} max={1200} step={1} value={size.dpi || ""}
          onChange={(e) => onChange({ ...size, dpi: number(e.target.value) })} />
      </div>
      <p data-testid="pixel-size" className="pb-2 text-sm text-muted-foreground tabular-nums">
        {pixels ? `${pixels.width} × ${pixels.height} px` : "—"}
      </p>
    </div>
  );
}

export function validSize(size: OutputSize): boolean {
  return size.width > 0 && size.width <= 2000 && size.height >= 0 && size.height <= 2000 && size.dpi >= 50 && size.dpi <= 1200;
}
