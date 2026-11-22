import { createServerFn } from "@tanstack/react-start";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import { z } from "zod";
import * as images from "@/server/images";
import { viewerOf } from "./viewer";

const idInput = z.object({ id: z.string().min(1).max(64) }).strict();

export const getImages = createServerFn()
  .middleware([ensureUserMiddleware])
  .handler(async ({ context }) => {
    const viewer = await viewerOf(context.user);
    return images.listImages(viewer.id);
  });

/** The image and its outputs, or null when the member has no such image. */
export const getImageDetail = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => idInput.parse(data))
  .handler(async ({ data, context }) => {
    const viewer = await viewerOf(context.user);
    const image = await images.getImage(viewer.id, data.id);
    if (!image) return null;
    return { image, outputs: await images.listOutputs(viewer.id, image.id) };
  });

export const renameImage = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => idInput.extend(images.renameImageInput.shape).parse(data))
  .handler(async ({ data, context }) => {
    const viewer = await viewerOf(context.user);
    const image = await images.renameImage(viewer.id, data.id, data.name);
    if (!image) throw new Error("Image not found");
    return image;
  });

export const deleteImage = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => idInput.parse(data))
  .handler(async ({ data, context }) => {
    const viewer = await viewerOf(context.user);
    if (!(await images.deleteImage(viewer.id, data.id))) throw new Error("Image not found");
    return null;
  });

export const deleteOutput = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => idInput.parse(data))
  .handler(async ({ data, context }) => {
    const viewer = await viewerOf(context.user);
    if (!(await images.deleteOutput(viewer.id, data.id))) throw new Error("Output not found");
    return null;
  });
