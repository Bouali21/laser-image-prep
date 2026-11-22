import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ChevronLeft, Copy, Download, Pencil, Play, Trash2 } from "lucide-react";
import { useState } from "react";
import { AppNav } from "@/client/components/AppNav";
import { AppShell } from "@/client/components/AppShell";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { PageHeader } from "@/client/components/PageHeader";
import { WorkflowDialog } from "@/client/components/WorkflowDialog";
import { StepPills } from "@/client/components/imaging/StepPills";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Button } from "@/client/components/ui/button";
import { Label } from "@/client/components/ui/label";
import { Switch } from "@/client/components/ui/switch";
import { downloadWorkflow } from "@/client/lib/workflowFile";
import { deleteWorkflow, duplicateWorkflow, getWorkflow, updateWorkflow } from "@/serverFunctions/workflows";

export const Route = createFileRoute("/workflows/$workflowId")({
  loader: ({ params }) => getWorkflow({ data: { id: params.workflowId } }),
  head: ({ loaderData }) => ({ meta: [{ title: `${loaderData?.name ?? "Workflow"} · Laser Image Prep` }] }),
  component: WorkflowPage,
});

function WorkflowPage() {
  const workflow = Route.useLoaderData();
  const router = useRouter();
  const [dialog, setDialog] = useState<"edit" | "delete" | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const back = (
    <Link to="/workflows" className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
      <ChevronLeft className="size-4" aria-hidden />
      Workflows
    </Link>
  );
  if (!workflow) {
    return (
      <AppShell nav={<AppNav />}>
        <PageHeader title="Workflow not found" backLink={back} />
      </AppShell>
    );
  }
  const w = workflow;

  async function run(work: () => Promise<unknown>) {
    setPending(true);
    setError(null);
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work.");
    } finally {
      setPending(false);
    }
  }

  const canToggleShare = w.canEdit || (w.shared && w.canModerate);

  return (
    <AppShell nav={<AppNav />}>
      <PageHeader
        title={w.name}
        backLink={back}
        description={
          <>
            {w.description ? <p>{w.description}</p> : null}
            {!w.canEdit ? <p>By {w.ownerEmail}</p> : null}
          </>
        }
        actions={
          <>
            <Button render={<Link to="/run" search={{ workflow: w.id }} />}>
              <Play aria-hidden /> Run
            </Button>
            {w.canEdit ? (
              <Button variant="outline" onClick={() => setDialog("edit")}>
                <Pencil aria-hidden /> Edit
              </Button>
            ) : null}
            <Button
              variant="outline"
              pending={pending && dialog === null}
              onClick={() =>
                run(async () => {
                  const copy = await duplicateWorkflow({ data: { id: w.id } });
                  await router.navigate({ to: "/workflows/$workflowId", params: { workflowId: copy.id } });
                })
              }
            >
              <Copy aria-hidden /> Duplicate
            </Button>
            <Button variant="outline" onClick={() => downloadWorkflow(w)}>
              <Download aria-hidden /> Export JSON
            </Button>
            {w.canModerate ? (
              <Button variant="outline" onClick={() => setDialog("delete")}>
                <Trash2 aria-hidden /> Delete
              </Button>
            ) : null}
          </>
        }
      />
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-4">
        <Switch
          id="share"
          aria-label="Share with organization"
          checked={w.shared}
          disabled={!canToggleShare || pending}
          onCheckedChange={(shared) =>
            run(async () => {
              await updateWorkflow({ data: { id: w.id, change: { shared } } });
              await (w.canEdit || shared ? router.invalidate() : router.navigate({ to: "/workflows" }));
            })
          }
        />
        <Label htmlFor="share" className="font-normal">
          {w.shared ? "Shared with everyone in the organization" : "Only you can see it"}
        </Label>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Steps</h2>
        {w.steps.length ? <StepPills steps={w.steps} /> : <p className="text-sm text-muted-foreground">No steps.</p>}
      </section>

      {dialog === "edit" ? (
        <WorkflowDialog
          title="Edit workflow"
          initial={{ name: w.name, description: w.description }}
          onClose={() => setDialog(null)}
          onSave={async (value) => {
            await updateWorkflow({ data: { id: w.id, change: value } });
            setDialog(null);
            await router.invalidate();
          }}
        />
      ) : null}
      {dialog === "delete" ? (
        <ConfirmDialog
          title={`Delete ${w.name}?`}
          confirmLabel="Delete"
          destructive
          pending={pending}
          onClose={() => setDialog(null)}
          onConfirm={() =>
            run(async () => {
              await deleteWorkflow({ data: { id: w.id } });
              setDialog(null);
              await router.navigate({ to: "/workflows" });
            })
          }
        >
          {w.canEdit ? undefined : "It's deleted for its owner too."}
        </ConfirmDialog>
      ) : null}
    </AppShell>
  );
}
