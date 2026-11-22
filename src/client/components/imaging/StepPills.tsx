import { Badge } from "@/client/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/client/components/ui/tooltip";
import { STEP_DEFS, stepSummary, type Step, type StepDef } from "@/shared/steps";

/** A workflow's steps in order; `skip` marks the ones a run leaves out, with why. */
export function StepPills({ steps, skip }: { steps: Step[]; skip?: (step: Step) => string | null }) {
  return (
    <ol className="flex flex-wrap gap-2">
      {steps.map((step, i) => {
        const def: StepDef = STEP_DEFS[step.type];
        const reason = skip?.(step) ?? null;
        const summary = stepSummary(step);
        const pill = (
          <Badge
            variant={reason || !step.enabled ? "outline" : "secondary"}
            className={reason || !step.enabled ? "text-muted-foreground" : undefined}
          >
            {i + 1}. {def.label}
            {!step.enabled ? " · off" : reason ? " · skipped" : null}
          </Badge>
        );
        return (
          <li key={i} data-testid="step-pill">
            {reason || summary ? (
              <Tooltip>
                <TooltipTrigger render={<span tabIndex={0} />}>{pill}</TooltipTrigger>
                <TooltipContent>{[reason, summary].filter(Boolean).join(" · ")}</TooltipContent>
              </Tooltip>
            ) : (
              pill
            )}
          </li>
        );
      })}
    </ol>
  );
}
