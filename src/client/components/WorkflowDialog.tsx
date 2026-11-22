import { useState } from "react";
import { FormDialog } from "@/client/components/FormDialog";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { Textarea } from "@/client/components/ui/textarea";

/** Name and description of a workflow, for saving a new one or editing one. */
export function WorkflowDialog({
  title,
  initial,
  onSave,
  onClose,
}: {
  title: string;
  initial: { name: string; description: string };
  onSave: (value: { name: string; description: string }) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <FormDialog
      title={title}
      onClose={onClose}
      actions={
        <Button type="submit" form="workflow-form" pending={pending} disabled={!name.trim()}>
          Save
        </Button>
      }
    >
      <form
        id="workflow-form"
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setPending(true);
          setError(null);
          try {
            await onSave({ name: name.trim(), description: description.trim() });
          } catch (err) {
            setError(err instanceof Error ? err.message : "That didn't work.");
          } finally {
            setPending(false);
          }
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="workflow-name">Name</Label>
          <Input id="workflow-name" value={name} maxLength={120} autoFocus onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="workflow-description">Description</Label>
          <Textarea id="workflow-description" value={description} maxLength={1000} rows={3} onChange={(e) => setDescription(e.target.value)} />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </form>
    </FormDialog>
  );
}
