import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ImageIcon, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { AppNav } from "@/client/components/AppNav";
import { AppShell } from "@/client/components/AppShell";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { Button } from "@/client/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/client/components/ui/table";
import { ACCEPT, uploadImage } from "@/client/lib/api";
import { formatBytes, formatDate } from "@/client/lib/format";
import { getImages } from "@/serverFunctions/images";

export const Route = createFileRoute("/")({
  loader: () => getImages(),
  head: () => ({ meta: [{ title: "Images · Laser Image Prep" }] }),
  component: Library,
});



function Library() {
  const images = Route.useLoaderData();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      try {
        await uploadImage(file);
      } catch (e) {
        toast.error(`${file.name}: ${e instanceof Error ? e.message : "upload failed"}`);
      }
    }
    if (input.current) input.current.value = "";
    setUploading(false);
    await router.invalidate();
  }

  const uploadButton = (
    <>
      <input
        ref={input}
        data-testid="upload-input"
        type="file"
        accept={ACCEPT}
        multiple
        hidden
        onChange={(e) => upload(e.currentTarget.files)}
      />
      <Button onClick={() => input.current?.click()} pending={uploading}>
        <Upload aria-hidden /> Upload images
      </Button>
    </>
  );

  return (
    <AppShell nav={<AppNav />}>
      <PageHeader title="Images" description="JPEG, PNG, WebP or BMP, up to 25 MB each." actions={uploadButton} />
      {images.length === 0 ? (
        <EmptyState
          icon={ImageIcon}
          title="No images yet"
          description="Upload a photo to prepare it for engraving."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="text-right">Size</TableHead>
              <TableHead className="text-right">Uploaded</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {images.map((image) => (
              <TableRow key={image.id} data-testid="image-row">
                <TableCell className="max-w-0 truncate font-medium">
                  <Link to="/images/$imageId" params={{ imageId: image.id }} className="hover:underline">
                    {image.name}
                  </Link>
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">{formatBytes(image.size)}</TableCell>
                <TableCell className="text-right text-muted-foreground">{formatDate(image.createdAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </AppShell>
  );
}
