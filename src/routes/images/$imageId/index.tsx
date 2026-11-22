import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { Download, Pencil, SlidersHorizontal, Trash2, Wand2, Workflow } from "lucide-react";
import { useState } from "react";
import { AppNav } from "@/client/components/AppNav";
import { AppShell } from "@/client/components/AppShell";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { EmptyState } from "@/client/components/EmptyState";
import { FormDialog } from "@/client/components/FormDialog";
import { PageHeader } from "@/client/components/PageHeader";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/client/components/ui/card";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { imageFileUrl, outputFileUrl } from "@/client/lib/api";
import { formatBytes, formatDate } from "@/client/lib/format";
import { outputName } from "@/client/lib/imaging/browser";
import { materialById } from "@/shared/materials";
import type { OutputRow } from "@/server/images";
import { deleteImage, deleteOutput, getImageDetail, renameImage } from "@/serverFunctions/images";

export const Route = createFileRoute("/images/$imageId/")({
  loader: ({ params }) => getImageDetail({ data: { id: params.imageId } }),
  head: ({ loaderData }) => ({ meta: [{ title: `${loaderData?.image.name ?? "Image"} · Laser Image Prep` }] }),
  component: ImagePage,
});

const MODE_LABELS = { quick: "One click", adjust: "Adjust", editor: "Editor", run: "Workflow run" } as const;

function ImagePage() {
  const detail = Route.useLoaderData();
  const router = useRouter();
  const [dialog, setDialog] = useState<"rename" | "delete" | { output: OutputRow } | null>(null);
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!detail) {
    return (
      <AppShell nav={<AppNav />}>
        <PageHeader title="Image not found" actions={<Button render={<Link to="/" />}>Back to images</Button>} />
      </AppShell>
    );
  }
  const { image, outputs } = detail;

  async function run(work: () => Promise<unknown>, after?: () => Promise<unknown>) {
    setPending(true);
    setError(null);
    try {
      await work();
      setDialog(null);
      await (after ? after() : router.invalidate());
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work.");
    } finally {
      setPending(false);
    }
  }

  const modes = [
    { to: "/images/$imageId/quick", label: "One click", icon: Wand2 },
    { to: "/images/$imageId/adjust", label: "Adjust", icon: SlidersHorizontal },
    { to: "/images/$imageId/edit", label: "Editor", icon: Workflow },
  ] as const;

  return (
    <AppShell nav={<AppNav />}>
      <PageHeader
        title={image.name}
        description={`${formatBytes(image.size)} · uploaded ${formatDate(image.createdAt)}`}
        actions={
          <>
            <Button variant="outline" onClick={() => { setName(image.name); setDialog("rename"); }}>
              <Pencil aria-hidden /> Rename
            </Button>
            <Button variant="outline" onClick={() => setDialog("delete")}>
              <Trash2 aria-hidden /> Delete
            </Button>
          </>
        }
      />
      {error && !dialog ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {modes.map((m) => (
          <Button key={m.to} variant="secondary" render={<Link to={m.to} params={{ imageId: image.id }} />}>
            <m.icon aria-hidden /> {m.label}
          </Button>
        ))}
      </div>

      <div className="flex justify-center rounded-lg border border-border bg-muted p-2">
        <img src={imageFileUrl(image.id)} alt={image.name} className="max-h-[50vh] max-w-full object-contain" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Saved outputs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {outputs.length === 0 ? (
            <EmptyState variant="plain" size="sm" icon={null} title="No saved outputs yet" description="Save a result from any mode and it appears here." />
          ) : (
            <ul className="divide-y divide-border">
              {outputs.map((output) => (
                <OutputItem key={output.id} output={output} imageName={image.name} onDelete={() => setDialog({ output })} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {dialog === "rename" ? (
        <FormDialog
          title="Rename image"
          onClose={() => setDialog(null)}
          actions={
            <Button form="rename-form" type="submit" pending={pending}>
              Save
            </Button>
          }
        >
          <form
            id="rename-form"
            className="space-y-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              void run(() => renameImage({ data: { id: image.id, name } }));
            }}
          >
            <Label htmlFor="image-name">Name</Label>
            <Input id="image-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} autoFocus />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </form>
        </FormDialog>
      ) : null}
      {dialog === "delete" ? (
        <ConfirmDialog
          title="Delete this image?"
          confirmLabel="Delete"
          destructive
          pending={pending}
          onClose={() => setDialog(null)}
          onConfirm={() => run(() => deleteImage({ data: { id: image.id } }), () => router.navigate({ to: "/" }))}
        >
          {outputs.length ? `Its ${outputs.length === 1 ? "saved output goes" : `${outputs.length} saved outputs go`} with it.` : undefined}
        </ConfirmDialog>
      ) : null}
      {dialog && typeof dialog === "object" ? (
        <ConfirmDialog
          title="Delete this output?"
          confirmLabel="Delete"
          destructive
          pending={pending}
          onClose={() => setDialog(null)}
          onConfirm={() => run(() => deleteOutput({ data: { id: dialog.output.id } }))}
        />
      ) : null}
    </AppShell>
  );
}

function OutputItem({ output, imageName, onDelete }: { output: OutputRow; imageName: string; onDelete: () => void }) {
  const s = output.settings;
  const material = s.material ? materialById(s.material)?.label : undefined;
  const count = s.steps.length;
  return (
    <li data-testid="output-row" className="flex flex-wrap items-center gap-3 py-3">
      <img src={outputFileUrl(output.id)} alt="" className="size-14 rounded border border-border bg-muted object-contain" />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
          {MODE_LABELS[s.mode]}
          {material ? <Badge variant="secondary">{material}</Badge> : null}
          {s.workflowName ? <Badge variant="secondary">{s.workflowName}</Badge> : null}
        </div>
        <p className="text-xs text-muted-foreground tabular-nums">
          {s.widthMm} × {s.heightMm} mm · {output.width} × {output.height} px · {s.dpi} DPI · {count} {count === 1 ? "step" : "steps"} · {formatDate(output.createdAt)}
        </p>
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" render={<a href={outputFileUrl(output.id)} download={outputName(imageName, s.material ?? s.mode, "png")} />}>
          <Download aria-hidden /> Download
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="Delete output" onClick={onDelete}>
          <Trash2 aria-hidden />
        </Button>
      </div>
    </li>
  );
}
