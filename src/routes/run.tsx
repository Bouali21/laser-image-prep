import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, CircleAlert, Download, FileArchive, ImagePlus, Loader2, Play } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { AppNav } from "@/client/components/AppNav";
import { AppShell } from "@/client/components/AppShell";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { SegmentedToggle } from "@/client/components/SegmentedToggle";
import { Section } from "@/client/components/imaging/Section";
import { SizeFields, validSize } from "@/client/components/imaging/SizeFields";
import { StepPills } from "@/client/components/imaging/StepPills";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Button } from "@/client/components/ui/button";
import { Checkbox } from "@/client/components/ui/checkbox";
import { Progress } from "@/client/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/client/components/ui/select";
import { ACCEPT, fetchImage, saveOutput, uploadImage } from "@/client/lib/api";
import { decode, downloadBytes, encodePng, outputName } from "@/client/lib/imaging/browser";
import { appliedSteps, runWorkflow, type RunOptions } from "@/client/lib/imaging/run";
import { pixelsToMm, sizeToPixels, upscalesTooMuch } from "@/client/lib/imaging/size";
import { makeZip } from "@/client/lib/imaging/zip";
import type { OutputSize } from "@/shared/materials";
import { skipReason } from "@/shared/steps";
import { getImages } from "@/serverFunctions/images";
import { getWorkflows } from "@/serverFunctions/workflows";

export const Route = createFileRoute("/run")({
  ssr: false,
  validateSearch: z.object({ workflow: z.string().optional() }),
  loader: async () => {
    const [workflows, images] = await Promise.all([getWorkflows(), getImages()]);
    return { workflows, images };
  },
  head: () => ({ meta: [{ title: "Run workflow · Laser Image Prep" }] }),
  component: RunPage,
});

type Source = { key: string; name: string } & ({ kind: "library"; id: string } | { kind: "local"; file: File });
type Status = "waiting" | "processing" | "done" | "failed";
interface Job {
  source: Source;
  status: Status;
  png?: Uint8Array<ArrayBuffer>;
  preview?: string;
  error?: string;
}

function RunPage() {
  const { workflows, images } = Route.useLoaderData();
  const search = Route.useSearch();
  const [workflowId, setWorkflowId] = useState<string | null>(workflows.some((w) => w.id === search.workflow) ? search.workflow! : null);
  const [mode, setMode] = useState<"single" | "batch">("single");
  const [picked, setPicked] = useState<string[]>([]);
  const [locals, setLocals] = useState<Source[]>([]);
  const [resizeOn, setResizeOn] = useState(false);
  const [size, setSize] = useState<OutputSize>({ width: 100, height: 0, unit: "mm", dpi: 254 });
  const [finalDither, setFinalDither] = useState(true);
  const [saveOn, setSaveOn] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [running, setRunning] = useState(false);
  const [dims, setDims] = useState<Record<string, { width: number; height: number }>>({});
  const localInput = useRef<HTMLInputElement>(null);
  const workflow = workflows.find((w) => w.id === workflowId) ?? null;

  const sources: Source[] = useMemo(
    () => [
      ...images.filter((i) => picked.includes(i.id)).map((i): Source => ({ key: i.id, name: i.name, kind: "library", id: i.id })),
      ...locals,
    ],
    [images, picked, locals],
  );

  // Pixel sizes of the picked images, for the upscale warning.
  useEffect(() => {
    if (!resizeOn) return;
    for (const s of sources) {
      if (dims[s.key]) continue;
      (s.kind === "library" ? fetchImage(s.id) : Promise.resolve(s.file))
        .then((blob) => createImageBitmap(blob))
        .then((bitmap) => {
          const size = { width: bitmap.width, height: bitmap.height };
          bitmap.close();
          setDims((d) => ({ ...d, [s.key]: size }));
        })
        .catch(() => undefined);
    }
  }, [resizeOn, sources, dims]);

  const sizeOk = validSize(size);
  const options: RunOptions = { size: resizeOn && sizeOk ? size : null, finalDither };
  const tooSmall = options.size
    ? sources.filter((s) => dims[s.key] && upscalesTooMuch(dims[s.key]!.width, dims[s.key]!.height, sizeToPixels(options.size!, dims[s.key]!.width, dims[s.key]!.height)))
    : [];
  const firstDims = sources[0] ? dims[sources[0].key] : undefined;

  function choose(next: string[], nextLocals: Source[]) {
    if (mode === "single") {
      const all = [...next.map((id) => ({ id })), ...nextLocals.map((l) => ({ local: l }))];
      const last = all.at(-1);
      setPicked(last && "id" in last ? [last.id] : []);
      setLocals(last && "local" in last ? [last.local] : []);
    } else {
      setPicked(next);
      setLocals(nextLocals);
    }
    setJobs([]);
  }

  async function run() {
    if (!workflow || !sources.length) return;
    const list: Job[] = sources.map((source) => ({ source, status: "waiting" }));
    setJobs(list);
    setRunning(true);
    const update = (i: number, change: Partial<Job>) => {
      list[i] = { ...list[i]!, ...change };
      setJobs([...list]);
    };
    for (let i = 0; i < list.length; i++) {
      const { source } = list[i]!;
      update(i, { status: "processing" });
      // Let the "processing" state paint before the work blocks the page.
      await new Promise((resolve) => setTimeout(resolve, 0));
      try {
        const blob = source.kind === "library" ? await fetchImage(source.id) : source.file;
        const result = runWorkflow(await decode(blob), workflow.steps, options);
        const png = await encodePng(result, size.dpi);
        if (saveOn) {
          const imageId = source.kind === "library" ? source.id : (await uploadImage(source.file)).id;
          await saveOutput(imageId, png, {
            mode: "run",
            workflowName: workflow.name,
            widthMm: Number(pixelsToMm(result.width, size.dpi).toFixed(2)),
            heightMm: Number(pixelsToMm(result.height, size.dpi).toFixed(2)),
            dpi: size.dpi,
            steps: appliedSteps(workflow.steps, options),
          });
        }
        update(i, { status: "done", png, preview: URL.createObjectURL(new Blob([png], { type: "image/png" })) });
      } catch (e) {
        update(i, { status: "failed", error: e instanceof Error ? e.message : "Processing failed" });
      }
    }
    setRunning(false);
  }

  const done = jobs.filter((j) => j.status === "done" || j.status === "failed").length;
  const zipName = (job: Job) => outputName(job.source.name, "laser", "png");

  return (
    <AppShell nav={<AppNav />}>
      <PageHeader title="Run workflow" />
      {workflows.length === 0 ? (
        <EmptyState
          title="No workflows yet"
          description="Save one from the editor or import a file on the Workflows page."
          action={<Button render={<Link to="/workflows" />}>Workflows</Button>}
        />
      ) : (
        <>
          <Section title="Workflow">
            <Select items={workflows.map((w) => ({ value: w.id, label: w.name }))} value={workflowId} onValueChange={(v) => { setWorkflowId(v); setJobs([]); }}>
              <SelectTrigger aria-label="Workflow" className="min-w-60">
                <SelectValue placeholder="Choose a workflow" />
              </SelectTrigger>
              <SelectContent>
                {workflows.map((w) => (
                  <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {workflow ? <StepPills steps={workflow.steps} skip={skipReason} /> : null}
          </Section>

          <Section title="Images">
            <SegmentedToggle
              showLabels
              value={mode}
              onChange={(m) => {
                setMode(m);
                if (m === "single" && sources.length > 1) {
                  setPicked(picked.slice(0, 1));
                  setLocals(picked.length ? [] : locals.slice(0, 1));
                }
                setJobs([]);
              }}
              items={[
                { value: "single", label: "Single", icon: null },
                { value: "batch", label: "Batch", icon: null },
              ]}
            />
            {images.length ? (
              <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded-lg border border-border">
                {images.map((image) => (
                  <li key={image.id}>
                    <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm">
                      <Checkbox
                        aria-label={image.name}
                        checked={picked.includes(image.id)}
                        onCheckedChange={(on) => choose(on ? [...picked, image.id] : picked.filter((id) => id !== image.id), locals)}
                      />
                      <span className="truncate">{image.name}</span>
                    </label>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={localInput}
                data-testid="local-input"
                type="file"
                accept={ACCEPT}
                multiple={mode === "batch"}
                hidden
                onChange={(e) => {
                  const files = Array.from(e.currentTarget.files ?? []);
                  choose(picked, [...locals, ...files.map((file, n): Source => ({ key: `local-${Date.now()}-${n}`, name: file.name, kind: "local", file }))]);
                  e.currentTarget.value = "";
                }}
              />
              <Button variant="outline" onClick={() => localInput.current?.click()}>
                <ImagePlus aria-hidden /> Add files from this device
              </Button>
              {locals.map((l) => (
                <span key={l.key} className="text-sm text-muted-foreground">{l.name}</span>
              ))}
            </div>
          </Section>

          <Section title="Output">
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox aria-label="Resize output" checked={resizeOn} onCheckedChange={(on) => setResizeOn(on)} />
                Resize output
              </label>
              {resizeOn ? (
                <SizeFields
                  size={size}
                  onChange={setSize}
                  withHeight
                  pixels={firstDims && sizeOk ? sizeToPixels(size, firstDims.width, firstDims.height) : null}
                />
              ) : null}
              {tooSmall.length ? (
                <Alert data-testid="upscale-warning">
                  <CircleAlert aria-hidden />
                  <AlertDescription>
                    Too small for this size: {tooSmall.map((s) => s.name).join(", ")} would be enlarged by more than 30% and look soft.
                  </AlertDescription>
                </Alert>
              ) : null}
              <label className="flex items-center gap-2 text-sm">
                <Checkbox aria-label="Final Jarvis dither" checked={finalDither} onCheckedChange={(on) => setFinalDither(on)} />
                Final Jarvis dither
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox aria-label="Save outputs to library" checked={saveOn} onCheckedChange={(on) => setSaveOn(on)} />
                Save outputs to library
              </label>
            </div>
          </Section>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={run} disabled={!workflow || !sources.length || running || (resizeOn && !sizeOk)} pending={running}>
              <Play aria-hidden /> Run
            </Button>
            {jobs.length && !running && jobs.some((j) => j.png) ? (
              <Button
                variant="outline"
                onClick={() =>
                  downloadBytes(
                    makeZip(jobs.filter((j) => j.png).map((j) => ({ name: zipName(j), data: j.png! }))),
                    outputName(workflow?.name ?? "workflow", "outputs", "zip"),
                    "application/zip",
                  )
                }
              >
                <FileArchive aria-hidden /> Download all (ZIP)
              </Button>
            ) : null}
          </div>

          {jobs.length ? (
            <section className="space-y-3">
              <Progress value={(done / jobs.length) * 100} aria-label="Progress" />
              <ul className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                {jobs.map((job) => (
                  <li key={job.source.key} data-testid="job-row" className="space-y-2 rounded-lg border border-border bg-card p-2">
                    <div className="flex h-40 items-center justify-center rounded bg-muted">
                      {job.preview ? <img src={job.preview} alt={`${job.source.name} result`} className="max-h-full max-w-full object-contain" /> : null}
                    </div>
                    <div className="flex items-center gap-2 px-1">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{job.source.name}</p>
                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                          {job.status === "processing" ? <Loader2 className="size-3 animate-spin" aria-hidden /> : null}
                          {job.status === "done" ? <CheckCircle2 className="size-3 text-primary" aria-hidden /> : null}
                          {STATUS[job.status]}
                          {job.error ? `: ${job.error}` : null}
                        </p>
                      </div>
                      {job.png ? (
                        <Button variant="ghost" size="sm" onClick={() => downloadBytes(job.png!, zipName(job), "image/png")}>
                          <Download aria-hidden /> Download
                        </Button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </AppShell>
  );
}

const STATUS: Record<Status, string> = { waiting: "Waiting", processing: "Processing", done: "Done", failed: "Failed" };
