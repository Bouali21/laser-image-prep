// The app's tools for AI clients, served by the Gateway at /mcp.
import { defineTools } from "@every-app/sdk/server";
import { isAdmin } from "@every-app/sdk/server";
import { z } from "zod";
import { listImages } from "@/server/images";
import { ensureUser } from "@/server/users";
import { listWorkflows } from "@/server/workflows";

export const tools = defineTools({
  list_images: {
    description: "List the user's uploaded images: id, name, type, size in bytes and upload time.",
    risk: "read",
    input: z.object({}).strict(),
    handler: async (_input, { user }) => {
      await ensureUser(user);
      return listImages(user.id);
    },
  },
  list_workflows: {
    description: "List the workflows the user can use: their own and those shared in the organization, with their steps.",
    risk: "read",
    input: z.object({}).strict(),
    handler: async (_input, { user }) => {
      await ensureUser(user);
      return listWorkflows({ id: user.id, admin: isAdmin(user) });
    },
  },
});
