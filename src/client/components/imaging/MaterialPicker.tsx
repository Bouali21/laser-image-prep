import { Button } from "@/client/components/ui/button";
import { MATERIALS } from "@/shared/materials";

export function MaterialPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <div role="group" aria-label="Material" className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
      {MATERIALS.map((m) => (
        <Button
          key={m.id}
          type="button"
          size="sm"
          variant={m.id === value ? "default" : "outline"}
          aria-pressed={m.id === value}
          onClick={() => onChange(m.id)}
        >
          {m.label}
        </Button>
      ))}
    </div>
  );
}
