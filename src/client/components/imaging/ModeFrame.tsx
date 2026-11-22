import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { AppNav } from "@/client/components/AppNav";
import { AppShell } from "@/client/components/AppShell";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";

/** The frame of a preparation mode: back to the image, title, then the mode. */
export function ModeFrame({
  imageId,
  imageName,
  title,
  actions,
  error,
  children,
}: {
  imageId: string;
  imageName: string | null;
  title: string;
  actions?: ReactNode;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <AppShell nav={<AppNav />}>
      <PageHeader
        title={imageName === null ? "Image not found" : title}
        description={imageName ?? undefined}
        actions={actions}
        backLink={
          <Link to="/images/$imageId" params={{ imageId }} className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
            <ChevronLeft className="size-4" aria-hidden />
            Image
          </Link>
        }
      />
      {imageName === null ? null : error ? (
        <EmptyState kind="error" title="This image couldn't be opened" description={error} />
      ) : (
        children
      )}
    </AppShell>
  );
}
