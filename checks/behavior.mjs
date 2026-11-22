// F001-F006: request-level checks on the server routes, the main browser
// journey through every mode, and a phone-sized smoke.
import { readFile } from "node:fs/promises";
import { startRuntime, expect } from "/home/user/oss-new/control/runtime/index.mjs";
import { scenePng, pngDpi, pngSize, upload, saveOutput, json, SAMPLE_STEPS } from "./fixtures.mjs";

const runtime = await startRuntime();
try {
  // ---- F001 over HTTP: upload, type checks, list, file, outputs, rename, delete.
  const bad = await upload(runtime, "member", "notes.txt", Buffer.from("hello"), "text/plain");
  expect(bad.status).toBe(415);
  const created = await upload(runtime, "member", "walnut-box-lid.png", scenePng(200, 120, 3));
  expect(created.status).toBe(201);
  const { image } = await created.json();
  expect(image.name).toBe("walnut-box-lid.png");
  expect(image.size).toBeGreaterThan(100);
  const listed = await (await runtime.fetch("/api/images", { role: "member" })).json();
  expect(listed.images.map((i) => i.id)).toContain(image.id);
  const file = await runtime.fetch(`/api/images/${image.id}/file`, { role: "member" });
  expect(file.status).toBe(200);
  expect(file.headers.get("content-type")).toContain("image/png");
  expect(pngSize(Buffer.from(await file.arrayBuffer()))).toEqual({ width: 200, height: 120 });

  const outBad = await saveOutput(runtime, "member", image.id, scenePng(10, 10), { mode: "nope" });
  expect(outBad.status).toBe(400);
  const out = await saveOutput(runtime, "member", image.id, scenePng(50, 30), {
    mode: "quick", material: "slate", widthMm: 50, heightMm: 30, dpi: 254, steps: SAMPLE_STEPS,
  });
  expect(out.status).toBe(201);
  const { output } = await out.json();
  const detail = await (await runtime.fetch(`/api/images/${image.id}`, { role: "member" })).json();
  expect(detail.outputs).toHaveLength(1);
  expect(detail.outputs[0].settings.material).toBe("slate");
  expect(detail.outputs[0].settings.dpi).toBe(254);
  expect((await runtime.fetch(`/api/outputs/${output.id}/file`, { role: "member" })).status).toBe(200);
  const renamed = await json(runtime, `/api/images/${image.id}`, "member", "PATCH", { name: "Walnut box lid" });
  expect(renamed.status).toBe(200);
  expect((await renamed.json()).image.name).toBe("Walnut box lid");
  expect((await runtime.fetch(`/api/images/${image.id}`, { role: "member", method: "DELETE" })).status).toBe(200);
  expect((await runtime.fetch(`/api/outputs/${output.id}/file`, { role: "member" })).status).toBe(404);
  expect((await runtime.fetch(`/api/images/${image.id}/file`, { role: "member" })).status).toBe(404);

  // ---- F005 over HTTP: validation on create/import, edit, duplicate, delete.
  const unknown = await json(runtime, "/api/workflows", "member", "POST", {
    name: "Broken", description: "", steps: [{ type: "vectorize", enabled: true, params: {} }],
  });
  expect(unknown.status).toBe(400);
  const outOfRange = await json(runtime, "/api/workflows", "member", "POST", {
    name: "Broken", description: "", steps: [{ type: "gamma", enabled: true, params: { gamma: 99 } }],
  });
  expect(outOfRange.status).toBe(400);
  const wfRes = await json(runtime, "/api/workflows", "member", "POST", {
    name: "Cork coasters", description: "Soft contrast for cork", steps: SAMPLE_STEPS,
  });
  expect(wfRes.status).toBe(201);
  const { workflow } = await wfRes.json();
  expect(workflow.steps).toHaveLength(4);
  expect(workflow.steps[2].enabled).toBe(false);
  const dup = await runtime.fetch(`/api/workflows/${workflow.id}/duplicate`, { role: "member", method: "POST" });
  expect(dup.status).toBe(201);
  const copy = (await dup.json()).workflow;
  expect(copy.name).toContain("Cork coasters");
  expect(copy.id).not.toBe(workflow.id);
  expect((await json(runtime, `/api/workflows/${copy.id}`, "member", "PATCH", { name: "Cork v2" })).status).toBe(200);
  expect((await runtime.fetch(`/api/workflows/${copy.id}`, { role: "member", method: "DELETE" })).status).toBe(200);

  // ---- The journey, as the owner.
  const context = await runtime.context("owner");
  const page = await context.newPage();
  await page.goto("/");
  await runtime.assertBackLink(page);
  await expect(page.getByRole("heading", { name: "Images" })).toBeVisible();
  await expect(page.getByText("No images yet")).toBeVisible();

  // F001: upload two photos.
  await page.getByTestId("upload-input").setInputFiles([
    { name: "lighthouse-sunset.png", mimeType: "image/png", buffer: scenePng(300, 200, 1) },
    { name: "family-cabin.png", mimeType: "image/png", buffer: scenePng(240, 180, 2) },
  ]);
  await expect(page.getByTestId("image-row")).toHaveCount(2);
  await expect(page.getByTestId("image-row").filter({ hasText: "lighthouse-sunset.png" })).toBeVisible();
  await page.getByRole("link", { name: "lighthouse-sunset.png" }).click();
  await expect(page.getByRole("heading", { name: "lighthouse-sunset.png" })).toBeVisible();
  await page.getByRole("button", { name: "Rename" }).click();
  await page.getByLabel("Name", { exact: true }).fill("Lighthouse at sunset");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("heading", { name: "Lighthouse at sunset" })).toBeVisible();
  await expect(page.getByText("No saved outputs yet")).toBeVisible();
  const imageUrl = page.url();

  // F002: one click with a material preset.
  await page.getByRole("link", { name: "One click" }).click();
  await expect(page.getByRole("heading", { name: "One click" })).toBeVisible();
  await page.getByRole("button", { name: "Slate", exact: true }).click();
  await page.getByLabel("Width").fill("100");
  await page.getByLabel("DPI").fill("254");
  await expect(page.getByTestId("pixel-size")).toHaveText("1000 × 667 px");
  await expect(page.getByTestId("preview")).toHaveAttribute("data-ready", "true");
  const [png] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download PNG" }).click()]);
  expect(png.suggestedFilename()).toMatch(/\.png$/);
  const pngBytes = await readFile(await png.path());
  expect(pngDpi(pngBytes)).toBe(254);
  expect(pngSize(pngBytes)).toEqual({ width: 1000, height: 667 });
  const [lbrn] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download LightBurn" }).click()]);
  expect(lbrn.suggestedFilename()).toMatch(/\.lbrn2$/);
  const project = await readFile(await lbrn.path(), "utf8");
  expect(project).toContain("<LightBurnProject");
  expect(project).toContain('Type="Bitmap"');
  await page.getByRole("button", { name: "Save to library" }).click();
  await expect(page.getByText("Saved to library")).toBeVisible();

  // F003: adjust mode.
  await page.goto(imageUrl);
  await page.getByRole("link", { name: "Adjust" }).click();
  await expect(page.getByRole("heading", { name: "Adjust" })).toBeVisible();
  await page.getByRole("button", { name: "Rotate right" }).click();
  await page.getByRole("button", { name: "Flip horizontal" }).click();
  await page.getByRole("button", { name: "Hardwood", exact: true }).click();
  await page.getByRole("slider", { name: "Contrast" }).focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("contrast-value")).toHaveText("2");
  await page.getByRole("button", { name: "Before", exact: true }).click();
  await expect(page.getByTestId("preview")).toHaveAttribute("data-showing", "before");
  await page.getByRole("button", { name: "After", exact: true }).click();
  await expect(page.getByTestId("preview")).toHaveAttribute("data-showing", "after");
  await page.getByRole("button", { name: "in", exact: true }).click();
  await page.getByLabel("Width").fill("2");
  await page.getByLabel("DPI").fill("300");
  // Rotated a quarter turn, the 300x200 photo stands upright: 2 in wide is 3 in tall.
  await expect(page.getByTestId("pixel-size")).toHaveText("600 × 900 px");
  await expect(page.getByTestId("preview")).toHaveAttribute("data-ready", "true");
  await page.getByRole("button", { name: "Save to library" }).click();
  await expect(page.getByText("Saved to library")).toBeVisible();
  const [adjPng] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download PNG" }).click()]);
  expect(pngDpi(await readFile(await adjPng.path()))).toBe(300);

  // F004: the step editor.
  await page.goto(imageUrl);
  await page.getByRole("link", { name: "Editor" }).click();
  await expect(page.getByRole("heading", { name: "Editor" })).toBeVisible();
  async function addStep(label) {
    await page.getByRole("combobox", { name: "Tool" }).click();
    await page.getByRole("option", { name: label, exact: true }).click();
    await page.getByRole("button", { name: "Add step" }).click();
  }
  await addStep("Grayscale");
  await addStep("Local contrast (CLAHE)");
  await addStep("Gamma");
  await addStep("Dither");
  const steps = page.getByTestId("step-row");
  await expect(steps).toHaveCount(4);
  await steps.nth(3).getByRole("combobox", { name: "Algorithm" }).click();
  await page.getByRole("option", { name: "Atkinson" }).click();
  await expect(steps.nth(3)).toContainText("Atkinson");
  await steps.nth(2).getByLabel("Gamma").fill("1.4");
  await steps.nth(1).getByRole("switch").click();
  await expect(steps.nth(1)).toHaveAttribute("data-enabled", "false");
  await steps.nth(2).getByRole("button", { name: "Move up" }).click();
  await expect(steps.nth(1)).toContainText("Gamma");
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(steps.nth(1)).toContainText("Local contrast");
  await page.getByRole("button", { name: "Redo" }).click();
  await expect(steps.nth(1)).toContainText("Gamma");
  await addStep("Sharpen");
  await steps.nth(4).getByRole("button", { name: "Remove step" }).click();
  await expect(steps).toHaveCount(4);
  await expect(page.getByTestId("preview")).toHaveAttribute("data-ready", "true");
  await page.getByRole("button", { name: "Save as workflow" }).click();
  await page.getByLabel("Name", { exact: true }).fill("Slate portrait");
  await page.getByLabel("Description").fill("Lifted shadows, Atkinson dither");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Workflow saved")).toBeVisible();
  await page.getByRole("button", { name: "Save to library" }).click();
  await expect(page.getByText("Saved to library")).toBeVisible();

  // F001 again: outputs listed under the image with their settings.
  await page.goto(imageUrl);
  const outputs = page.getByTestId("output-row");
  await expect(outputs).toHaveCount(3);
  await expect(outputs.filter({ hasText: "Slate" })).toContainText("254 DPI");
  await expect(outputs.filter({ hasText: "Hardwood" })).toContainText("300 DPI");
  await expect(outputs.filter({ hasText: "Editor" })).toContainText("4 steps");
  const [again] = await Promise.all([page.waitForEvent("download"), outputs.filter({ hasText: "Slate" }).getByRole("link", { name: "Download" }).click()]);
  expect(pngDpi(await readFile(await again.path()))).toBe(254);
  await outputs.filter({ hasText: "Editor" }).getByRole("button", { name: "Delete output" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).last().click();
  await expect(outputs).toHaveCount(2);

  // F005: workflows page.
  await page.getByRole("link", { name: "Workflows" }).click();
  await expect(page.getByRole("heading", { name: "Workflows" })).toBeVisible();
  const wfRow = page.getByTestId("workflow-row").filter({ hasText: "Slate portrait" });
  await expect(wfRow).toContainText("4 steps");
  await wfRow.getByRole("link", { name: "Slate portrait" }).click();
  await expect(page.getByRole("heading", { name: "Slate portrait" })).toBeVisible();
  await expect(page.getByTestId("step-pill")).toHaveCount(4);
  await expect(page.getByTestId("step-pill").nth(2)).toContainText("off");
  const [exported] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export JSON" }).click()]);
  const exportedJson = JSON.parse(await readFile(await exported.path(), "utf8"));
  expect(exportedJson.steps).toHaveLength(4);
  expect(exportedJson.steps[2].enabled).toBe(false);
  await page.getByRole("switch", { name: "Share with organization" }).click();
  await expect(page.getByText("Shared with everyone in the organization")).toBeVisible();
  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Name", { exact: true }).fill("Slate portraits");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("heading", { name: "Slate portraits" })).toBeVisible();
  await page.getByRole("button", { name: "Duplicate" }).click();
  await expect(page.getByRole("heading", { name: "Slate portraits (copy)" })).toBeVisible();
  await page.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).last().click();
  await expect(page.getByRole("heading", { name: "Workflows" })).toBeVisible();
  await page.getByTestId("import-input").setInputFiles({
    name: "bad.json", mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ name: "x", steps: [{ type: "teleport", enabled: true, params: {} }] })),
  });
  await expect(page.getByRole("alert")).toContainText("isn't a valid workflow");
  await page.getByTestId("import-input").setInputFiles({
    name: "glass-etch.json", mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ ...exportedJson, name: "Glass etch" })),
  });
  await expect(page.getByTestId("workflow-row").filter({ hasText: "Glass etch" })).toBeVisible();
  await expect(page.getByTestId("workflow-row")).toHaveCount(2);

  // F006: run a workflow over a batch.
  await page.getByRole("link", { name: "Run workflow" }).click();
  await expect(page.getByRole("heading", { name: "Run workflow" })).toBeVisible();
  await page.getByRole("combobox", { name: "Workflow" }).click();
  await page.getByRole("option", { name: "Slate portraits" }).click();
  const pills = page.getByTestId("step-pill");
  await expect(pills).toHaveCount(4);
  await expect(pills.filter({ hasText: "Dither" })).toContainText("skipped");
  await page.getByRole("button", { name: "Batch", exact: true }).click();
  await page.getByRole("checkbox", { name: "Lighthouse at sunset" }).click();
  await page.getByRole("checkbox", { name: "family-cabin.png" }).click();
  await page.getByTestId("local-input").setInputFiles({ name: "harbor-boats.png", mimeType: "image/png", buffer: scenePng(260, 180, 4) });
  await page.getByRole("checkbox", { name: "Resize output" }).click();
  await page.getByLabel("Width").fill("100");
  await page.getByLabel("DPI").fill("300");
  await expect(page.getByTestId("upscale-warning")).toBeVisible();
  await page.getByLabel("Width").fill("20");
  await expect(page.getByTestId("upscale-warning")).toHaveCount(0);
  await expect(page.getByRole("checkbox", { name: "Final Jarvis dither" })).toBeChecked();
  await page.getByRole("checkbox", { name: "Save outputs to library" }).click();
  await page.getByRole("button", { name: "Run", exact: true }).click();
  const jobs = page.getByTestId("job-row");
  await expect(jobs).toHaveCount(3);
  await expect(jobs.filter({ hasText: "Done" })).toHaveCount(3, { timeout: 20000 });
  const [zip] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download all (ZIP)" }).click()]);
  expect(zip.suggestedFilename()).toMatch(/\.zip$/);
  const zipBytes = await readFile(await zip.path());
  expect(zipBytes.subarray(0, 4).toString("hex")).toBe("504b0304");
  expect(zipBytes.toString("latin1")).toContain("harbor-boats");
  const [single] = await Promise.all([page.waitForEvent("download"), jobs.first().getByRole("button", { name: "Download" }).click()]);
  const singleBytes = await readFile(await single.path());
  expect(pngDpi(singleBytes)).toBe(300);
  expect(pngSize(singleBytes).width).toBe(236);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.locator("main").evaluate((el) => el.parentElement.scrollTo(0, el.parentElement.scrollHeight));
  await runtime.screenshot(page);

  // Saved run outputs land under their images, local files included.
  const mine = await (await runtime.fetch("/api/images", { role: "owner" })).json();
  expect(mine.images.map((i) => i.name)).toContain("harbor-boats.png");
  await context.close();

  // ---- Phone-sized smoke.
  const phone = await runtime.context("member", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const small = await phone.newPage();
  await small.goto("/");
  await expect(small.getByRole("heading", { name: "Images" })).toBeVisible();
  await expect(small.getByRole("link", { name: "Workflows" })).toBeVisible();
  await small.goto("/workflows");
  await expect(small.getByTestId("workflow-row").filter({ hasText: "Slate portraits" })).toBeVisible();
  await phone.close();
} finally {
  await runtime.close();
}
