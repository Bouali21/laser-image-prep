import { useId } from "react";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/client/components/ui/select";
import type { ParamDef } from "@/shared/steps";

/** One editable value of a step. */
export function ParamField({ def, value, onChange }: { def: ParamDef; value: number | string; onChange: (v: number | string) => void }) {
  const id = useId();
  if (def.kind === "choice") {
    return (
      <div className="space-y-1.5">
        <Label>{def.label}</Label>
        <Select items={def.options} value={String(value)} onValueChange={(v) => v !== null && onChange(v)}>
          <SelectTrigger size="sm" aria-label={def.label} className="min-w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {def.options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }
  return (
    <div className="w-28 space-y-1.5">
      <Label htmlFor={id}>
        {def.label}
        {def.unit ? <span className="text-muted-foreground"> ({def.unit})</span> : null}
      </Label>
      <Input
        id={id}
        type="number"
        className="h-8"
        min={def.min}
        max={def.max}
        step={def.step}
        defaultValue={value}
        key={String(value)}
        onBlur={(e) => commit(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit(e.currentTarget.value);
        }}
      />
    </div>
  );
  function commit(raw: string) {
    if (def.kind !== "number") return;
    const n = Number(raw);
    if (raw === "" || !Number.isFinite(n)) return;
    const clamped = Math.min(def.max, Math.max(def.min, n));
    if (clamped !== value) onChange(clamped);
  }
}
