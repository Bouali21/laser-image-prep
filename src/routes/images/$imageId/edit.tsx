import { createFileRoute } from "@tanstack/react-router";
import { Plus, Redo2, Save, Undo2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { WorkflowDialog } from "@/client/components/WorkflowDialog";
import { EmptyState } from "@/client/components/EmptyState";
import { ExportBar } from "@/client/components/imaging/ExportBar";
import { ModeFrame } from "@/client/components/imaging/ModeFrame";
import { PreviewCanvas } from "@/client/components/imaging/PreviewCanvas";
import { Section } from "@/client/components/imaging/Section";
import { StepList, type KeyedStep } from "@/client/components/imaging/StepList";
import { Button } from "@/client/components/ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/client/components/ui/select";
import { useRendered, useSource } from "@/client/hooks/useImaging";
import { makeStep, STEP_DEFS, STEP_TYPES, type Step, type StepDef, type StepType } from "@/shared/steps";
import { getImageDetail } from "@/serverFunctions/images";
import { createWorkflow, getWorkflows } from "@/serverFunctions/workflows";

export const Route = createFileRoute("/images/$imageId/edit")({
  ssr: false,
  validateSearch: z.object({ workflow: z.string().optional() }),
  loader: async ({ params }) => {
    const [detail, workflows] = await Promise.all([getImageDetail({ data: { id: params.imageId } }), getWorkflows()]);
    return { detail, workflows };
  },
  head: () => ({ meta: [{ title: "Editor · Laser Image Prep" }] }),
  component: EditorPage,
});

const TOOL_ITEMS = STEP_TYPES.map((type) => ({ value: type, label: (STEP_DEFS[type] as StepDef).label }));
const GROUPS = ["Tone", "Color", "Detail", "Geometry", "Output"] as const;

let counter = 0;
const keyed = (steps: Step[]): KeyedStep[] => steps.map((s) => ({ ...s, key: `s${++counter}` }));
const plain = (steps: KeyedStep[]): Step[] => steps.map(({ key: _key, ...s }) => s);

function EditorPage() {
  const { detail, workflows } = Route.useLoaderData();
  const { imageId } = Route.useParams();
  const search = Route.useSearch();
  const { source, error } = useSource(imageId);
  const initial = workflows.find((w) => w.id === search.workflow);
  const [history, setHistory] = useState<{ past: KeyedStep[][]; present: KeyedStep[]; future: KeyedStep[][] }>(() => ({
    past: [],
    present: keyed(initial?.steps ?? []),
    future: [],
  }));
  const [tool, setTool] = useState<StepType>("grayscale");
  const [loaded, setLoaded] = useState<string | null>(initial?.id ?? null);
  const [saving, setSaving] = useState(false);
  const steps = history.present;
  const change = (next: KeyedStep[]) => setHistory((h) => ({ past: [...h.past, h.present].slice(-100), present: next, future: [] }));
  const undo = () => setHistory((h) => (h.past.length ? { past: h.past.slice(0, -1), present: h.past.at(-1)!, future: [h.present, ...h.future] } : h));
  const redo = () => setHistory((h) => (h.future.length ? { past: [...h.past, h.present], present: h.future[0]!, future: h.future.slice(1) } : h));

  const pipeline = useMemo(() => plain(steps), [steps]);
  const { result, rendering, error: renderError } = useRendered(source, pipeline);
  const resize = [...pipeline].reverse().find((s) => s.enabled && s.type === "resize");
  const dpi = resize ? Number(resize.params.dpi) : 254;

  return (
    <ModeFrame
      imageId={imageId}
      imageName={detail?.image.name ?? null}
      title="Editor"
      error={error}
      actions={
        <>
          <Button variant="outline" size="icon" aria-label="Undo" disabled={!history.past.length} onClick={undo}>
            <Undo2 aria-hidden />
          </Button>
          <Button variant="outline" size="icon" aria-label="Redo" disabled={!history.future.length} onClick={redo}>
            <Redo2 aria-hidden />
          </Button>
        </>
      }
    >
      <Section title="Steps">
        <div className="flex flex-wrap items-center gap-2">
          <Select items={TOOL_ITEMS} value={tool} onValueChange={(v) => v && setTool(v as StepType)}>
            <SelectTrigger aria-label="Tool" className="min-w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GROUPS.map((group) => (
                <SelectGroup key={group}>
                  <SelectLabel>{group}</SelectLabel>
                  {TOOL_ITEMS.filter((t) => (STEP_DEFS[t.value] as StepDef).group === group).map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => change([...steps, ...keyed([makeStep(tool)])])}>
            <Plus aria-hidden /> Add step
          </Button>
          <div className="ml-auto flex flex-wrap gap-2">
            {workflows.length ? (
              <Select
                items={workflows.map((w) => ({ value: w.id, label: w.name }))}
                value={loaded}
                onValueChange={(id) => {
                  const w = workflows.find((x) => x.id === id);
                  if (!w) return;
                  setLoaded(w.id);
                  change(keyed(w.steps));
                }}
              >
                <SelectTrigger aria-label="Load workflow" className="min-w-44">
                  <SelectValue placeholder="Load workflow" />
                </SelectTrigger>
                <SelectContent>
                  {workflows.map((w) => (
                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            <Button variant="outline" disabled={!steps.length} onClick={() => setSaving(true)}>
              <Save aria-hidden /> Save as workflow
            </Button>
          </div>
        </div>
        {steps.length ? (
          <StepList steps={steps} onChange={change} />
        ) : (
          <EmptyState icon={null} size="sm" title="No steps yet" description="Pick a tool and add it." />
        )}
      </Section>
      {renderError ? <p role="alert" className="text-sm text-destructive">{renderError}</p> : null}
      <PreviewCanvas raster={result} ready={!rendering} label="Edited image" />
      <ExportBar
        imageId={imageId}
        imageName={detail?.image.name ?? "image"}
        suffix="edited"
        result={rendering ? null : result}
        dpi={dpi}
        settings={{ mode: "editor", steps: pipeline }}
      />
      {saving ? (
        <WorkflowDialog
          title="Save as workflow"
          initial={{ name: "", description: "" }}
          onClose={() => setSaving(false)}
          onSave={async (value) => {
            await createWorkflow({ data: { ...value, steps: pipeline } });
            setSaving(false);
            toast.success("Workflow saved");
          }}
        />
      ) : null}
    </ModeFrame>
  );
}
