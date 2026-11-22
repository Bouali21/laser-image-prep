import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { FileUp, Workflow as WorkflowIcon } from "lucide-react";
import { useRef, useState } from "react";
import { AppNav } from "@/client/components/AppNav";
import { AppShell } from "@/client/components/AppShell";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/client/components/ui/table";
import { formatDate } from "@/client/lib/format";
import { readWorkflowFile } from "@/client/lib/workflowFile";
import { createWorkflow, getWorkflows } from "@/serverFunctions/workflows";

export const Route = createFileRoute("/workflows/")({
  loader: () => getWorkflows(),
  head: () => ({ meta: [{ title: "Workflows · Laser Image Prep" }] }),
  component: WorkflowsPage,
});

function WorkflowsPage() {
  const workflows = Route.useLoaderData();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  async function importFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setImporting(true);
    try {
      await createWorkflow({ data: await readWorkflowFile(file) });
      await router.invalidate();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That file isn't a valid workflow.");
    } finally {
      setImporting(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <AppShell nav={<AppNav />}>
      <PageHeader
        title="Workflows"
        actions={
          <>
            <input ref={input} data-testid="import-input" type="file" accept="application/json,.json" hidden onChange={(e) => importFile(e.currentTarget.files?.[0])} />
            <Button variant="outline" pending={importing} onClick={() => input.current?.click()}>
              <FileUp aria-hidden /> Import JSON
            </Button>
          </>
        }
      />
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {workflows.length === 0 ? (
        <EmptyState
          icon={WorkflowIcon}
          title="No workflows yet"
          description="Save the steps of an image in the editor as a workflow, or import a workflow file."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Steps</TableHead>
              <TableHead className="hidden sm:table-cell">Owner</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workflows.map((w) => (
              <TableRow key={w.id} data-testid="workflow-row">
                <TableCell className="font-medium">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link to="/workflows/$workflowId" params={{ workflowId: w.id }} className="hover:underline">
                      {w.name}
                    </Link>
                    {w.shared ? <Badge variant="secondary">Shared</Badge> : null}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground tabular-nums">
                  {w.steps.length} {w.steps.length === 1 ? "step" : "steps"}
                </TableCell>
                <TableCell className="hidden max-w-48 truncate text-muted-foreground sm:table-cell">{w.canEdit ? "You" : w.ownerEmail}</TableCell>
                <TableCell className="hidden text-right text-muted-foreground sm:table-cell">{formatDate(w.updatedAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </AppShell>
  );
}
