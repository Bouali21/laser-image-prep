import { ArrowDown, ArrowUp, X } from "lucide-react";
import { Button } from "@/client/components/ui/button";
import { Switch } from "@/client/components/ui/switch";
import { STEP_DEFS, type Step, type StepDef } from "@/shared/steps";
import { ParamField } from "./ParamField";

export type KeyedStep = Step & { key: string };

/** The recorded steps: each can be switched off, edited in place, moved or removed. */
export function StepList({ steps, onChange }: { steps: KeyedStep[]; onChange: (steps: KeyedStep[]) => void }) {
  const replace = (i: number, step: KeyedStep) => onChange(steps.map((s, j) => (j === i ? step : s)));
  const move = (i: number, by: number) => {
    const next = [...steps];
    const [step] = next.splice(i, 1);
    next.splice(i + by, 0, step!);
    onChange(next);
  };
  return (
    <ol className="space-y-2">
      {steps.map((step, i) => {
        const def: StepDef = STEP_DEFS[step.type];
        return (
          <li
            key={step.key}
            data-testid="step-row"
            data-enabled={String(step.enabled)}
            className="space-y-3 rounded-lg border border-border bg-card p-3 data-[enabled=false]:opacity-60"
          >
            <div className="flex items-center gap-2">
              <Switch size="sm" aria-label="Step on" checked={step.enabled} onCheckedChange={(enabled) => replace(i, { ...step, enabled })} />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                <span className="mr-1.5 text-muted-foreground tabular-nums">{i + 1}.</span>
                {def.label}
              </span>
              <Button variant="ghost" size="icon-xs" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                <ArrowUp aria-hidden />
              </Button>
              <Button variant="ghost" size="icon-xs" aria-label="Move down" disabled={i === steps.length - 1} onClick={() => move(i, 1)}>
                <ArrowDown aria-hidden />
              </Button>
              <Button variant="ghost" size="icon-xs" aria-label="Remove step" onClick={() => onChange(steps.filter((_, j) => j !== i))}>
                <X aria-hidden />
              </Button>
            </div>
            {def.params.length ? (
              <div className="flex flex-wrap gap-3">
                {def.params.map((p) => (
                  <ParamField
                    key={p.key}
                    def={p}
                    value={step.params[p.key]!}
                    onChange={(v) => replace(i, { ...step, params: { ...step.params, [p.key]: v } })}
                  />
                ))}
              </div>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
