import { expect, test } from "@playwright/test";

test("real-model results show sample sizes and a downloadable score artifact", async ({
  page,
  request,
}) => {
  await page.goto("/results");
  await expect(
    page.getByRole("heading", {
      name: "Real-model answers: retrieval versus the agent",
    }),
  ).toBeVisible();
  const table = page.getByRole("table", {
    name: "Real-model evaluation results",
  });
  await expect(table).toContainText("C1 · basic retrieval");
  await expect(table).toContainText("C5 · agent");
  const response = await request.get("/data/live-evaluation.json");
  expect(response.ok()).toBe(true);
  const result = await response.json();
  expect(result.manifest.questionIds).toHaveLength(50);
  expect(Object.keys(result.summary)).toEqual(["C1", "C5"]);
  expect(JSON.stringify(result)).not.toContain("Reference answer:");
});
