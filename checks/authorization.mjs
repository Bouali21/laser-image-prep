// X001 and the ownership rules of F001-F006: the Gateway admits members only,
// images and outputs are their owner's alone, workflows are private until
// shared, shared ones are read-only to others, and admins may unshare or
// delete shared ones.
import { startRuntime, expect } from "/home/user/oss-new/control/runtime/index.mjs";
import { scenePng, upload, saveOutput, json, SAMPLE_STEPS } from "./fixtures.mjs";

const runtime = await startRuntime();
try {
  await runtime.assertPrivateAccess(["/", "/workflows", "/run", "/api/images", "/api/workflows"]);

  // Anonymous and outsider callers get nothing from the API, writes included.
  for (const role of [undefined, "outsider"]) {
    const res = await upload(runtime, role, "x.png", scenePng(10, 10));
    expect([401, 403]).toContain(res.status);
    const wf = await json(runtime, "/api/workflows", role, "POST", { name: "x", description: "", steps: [] });
    expect([401, 403]).toContain(wf.status);
  }

  // Images and outputs belong to their owner.
  const { image } = await (await upload(runtime, "owner", "private-portrait.png", scenePng(80, 60))).json();
  const { output } = await (await saveOutput(runtime, "owner", image.id, scenePng(40, 30), {
    mode: "quick", material: "plywood", widthMm: 40, heightMm: 30, dpi: 254, steps: SAMPLE_STEPS,
  })).json();
  const memberList = await (await runtime.fetch("/api/images", { role: "member" })).json();
  expect(memberList.images.map((i) => i.id)).not.toContain(image.id);
  for (const path of [`/api/images/${image.id}`, `/api/images/${image.id}/file`, `/api/outputs/${output.id}/file`]) {
    expect((await runtime.fetch(path, { role: "member" })).status).toBe(404);
  }
  expect((await json(runtime, `/api/images/${image.id}`, "member", "PATCH", { name: "mine now" })).status).toBe(404);
  expect((await runtime.fetch(`/api/images/${image.id}`, { role: "member", method: "DELETE" })).status).toBe(404);
  expect((await runtime.fetch(`/api/outputs/${output.id}`, { role: "member", method: "DELETE" })).status).toBe(404);
  expect((await saveOutput(runtime, "member", image.id, scenePng(10, 10), {
    mode: "quick", material: "plywood", widthMm: 10, heightMm: 10, dpi: 254, steps: [],
  })).status).toBe(404);
  const ownerDetail = await (await runtime.fetch(`/api/images/${image.id}`, { role: "owner" })).json();
  expect(ownerDetail.outputs).toHaveLength(1);
  expect(ownerDetail.image.name).toBe("private-portrait.png");

  // The member's browser can't open the owner's image page either.
  const memberContext = await runtime.context("member");
  const memberPage = await memberContext.newPage();
  await memberPage.goto(`/images/${image.id}`);
  await expect(memberPage.getByText("Image not found")).toBeVisible();
  await expect(memberPage.getByText("private-portrait.png")).toHaveCount(0);

  // Workflows: private by default.
  const { workflow } = await (await json(runtime, "/api/workflows", "owner", "POST", {
    name: "Owner bamboo", description: "", steps: SAMPLE_STEPS,
  })).json();
  expect((await runtime.fetch(`/api/workflows/${workflow.id}`, { role: "member" })).status).toBe(404);
  expect((await runtime.fetch(`/api/workflows/${workflow.id}/duplicate`, { role: "member", method: "POST" })).status).toBe(404);
  const listBefore = await (await runtime.fetch("/api/workflows", { role: "member" })).json();
  expect(listBefore.workflows.map((w) => w.id)).not.toContain(workflow.id);

  // Shared: others view and duplicate, but cannot change, unshare or delete it.
  expect((await json(runtime, `/api/workflows/${workflow.id}`, "owner", "PATCH", { shared: true })).status).toBe(200);
  const seen = await runtime.fetch(`/api/workflows/${workflow.id}`, { role: "member" });
  expect(seen.status).toBe(200);
  expect((await seen.json()).workflow.canEdit).toBe(false);
  expect((await json(runtime, `/api/workflows/${workflow.id}`, "member", "PATCH", { name: "Hijacked" })).status).toBe(403);
  expect((await json(runtime, `/api/workflows/${workflow.id}`, "member", "PATCH", { shared: false })).status).toBe(403);
  expect((await runtime.fetch(`/api/workflows/${workflow.id}`, { role: "member", method: "DELETE" })).status).toBe(403);
  const copied = await runtime.fetch(`/api/workflows/${workflow.id}/duplicate`, { role: "member", method: "POST" });
  expect(copied.status).toBe(201);
  const copy = (await copied.json()).workflow;
  expect(copy.canEdit).toBe(true);
  expect(copy.shared).toBe(false);
  expect((await runtime.fetch(`/api/workflows/${workflow.id}`, { role: "owner" })).status).toBe(200);
  expect((await (await runtime.fetch(`/api/workflows/${workflow.id}`, { role: "owner" })).json()).workflow.name).toBe("Owner bamboo");
  // The copy stays the member's own.
  expect((await runtime.fetch(`/api/workflows/${copy.id}`, { role: "owner" })).status).toBe(404);

  // In the browser, a shared workflow is read-only to a non-owner.
  await memberPage.goto(`/workflows/${workflow.id}`);
  await expect(memberPage.getByRole("heading", { name: "Owner bamboo" })).toBeVisible();
  await expect(memberPage.getByRole("button", { name: "Duplicate" })).toBeVisible();
  await expect(memberPage.getByRole("button", { name: "Edit" })).toHaveCount(0);
  await expect(memberPage.getByRole("button", { name: "Delete" })).toHaveCount(0);
  await memberContext.close();

  // Admin (the org owner) may unshare or delete a member's shared workflow, but not edit it.
  const { workflow: memberWf } = await (await json(runtime, "/api/workflows", "member", "POST", {
    name: "Member slate", description: "", steps: SAMPLE_STEPS,
  })).json();
  expect((await runtime.fetch(`/api/workflows/${memberWf.id}`, { role: "owner", method: "DELETE" })).status).toBe(404);
  expect((await json(runtime, `/api/workflows/${memberWf.id}`, "member", "PATCH", { shared: true })).status).toBe(200);
  expect((await json(runtime, `/api/workflows/${memberWf.id}`, "owner", "PATCH", { name: "Admin rename" })).status).toBe(403);
  expect((await json(runtime, `/api/workflows/${memberWf.id}`, "owner", "PATCH", { shared: false })).status).toBe(200);
  expect((await runtime.fetch(`/api/workflows/${memberWf.id}`, { role: "owner" })).status).toBe(404);
  expect((await json(runtime, `/api/workflows/${memberWf.id}`, "member", "PATCH", { shared: true })).status).toBe(200);
  expect((await runtime.fetch(`/api/workflows/${memberWf.id}`, { role: "owner", method: "DELETE" })).status).toBe(200);
  expect((await runtime.fetch(`/api/workflows/${memberWf.id}`, { role: "member" })).status).toBe(404);

  // The app has no sign-in of its own.
  for (const path of ["/login", "/signin", "/sign-in", "/signup", "/register", "/auth/login"]) {
    const res = await runtime.fetch(path, { role: "member" });
    expect(res.status).toBe(404);
    expect(await res.text()).not.toMatch(/type="password"/i);
  }
} finally {
  await runtime.close();
}
