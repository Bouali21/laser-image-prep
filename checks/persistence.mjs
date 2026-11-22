// Images, outputs and workflows survive a restart.
import { startRuntime, expect } from "/home/user/oss-new/control/runtime/index.mjs";
import { scenePng, upload, saveOutput, json, SAMPLE_STEPS } from "./fixtures.mjs";

const runtime = await startRuntime();
try {
  const source = scenePng(120, 90, 5);
  const { image } = await (await upload(runtime, "member", "garden-gate.png", source)).json();
  const rendered = scenePng(60, 45, 6);
  const { output } = await (await saveOutput(runtime, "member", image.id, rendered, {
    mode: "editor", widthMm: 60, heightMm: 45, dpi: 254, steps: SAMPLE_STEPS,
  })).json();
  const { workflow } = await (await json(runtime, "/api/workflows", "member", "POST", {
    name: "Leather patches", description: "Low contrast", steps: SAMPLE_STEPS,
  })).json();
  await json(runtime, `/api/workflows/${workflow.id}`, "member", "PATCH", { shared: true });

  await runtime.restart();

  const detail = await (await runtime.fetch(`/api/images/${image.id}`, { role: "member" })).json();
  expect(detail.image.name).toBe("garden-gate.png");
  expect(detail.outputs.map((o) => o.id)).toEqual([output.id]);
  expect(detail.outputs[0].settings.steps).toHaveLength(4);
  const file = Buffer.from(await (await runtime.fetch(`/api/images/${image.id}/file`, { role: "member" })).arrayBuffer());
  expect(file.equals(source)).toBe(true);
  const out = Buffer.from(await (await runtime.fetch(`/api/outputs/${output.id}/file`, { role: "member" })).arrayBuffer());
  expect(out.equals(rendered)).toBe(true);
  const wf = await (await runtime.fetch(`/api/workflows/${workflow.id}`, { role: "owner" })).json();
  expect(wf.workflow.name).toBe("Leather patches");
  expect(wf.workflow.shared).toBe(true);
  expect(wf.workflow.steps.map((s) => s.enabled)).toEqual([true, true, false, true]);

  const page = await (await runtime.context("member")).newPage();
  await page.goto(`/images/${image.id}`);
  await expect(page.getByRole("heading", { name: "garden-gate.png" })).toBeVisible();
  await expect(page.getByTestId("output-row")).toHaveCount(1);
} finally {
  await runtime.close();
}
