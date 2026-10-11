import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// The real site in a real browser. The filings load from static files next to
// the page, so nothing here touches the network beyond the server under test.

async function violations(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  return result.violations.map((v) => ({
    rule: v.id,
    impact: v.impact,
    where: v.nodes.map((n) => n.target.join(" ")).slice(0, 4),
  }));
}

async function ready(page: Page) {
  await page.goto("/");
  await expect(page.getByLabel("Your question")).toBeVisible();
}

test.describe("search", () => {
  test("loads the filings, then finds pages for a typed question", async ({ page }) => {
    await ready(page);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Find the page behind the figure");
    await page.getByLabel("Your question").fill("What was Best Buy's capital expenditure in fiscal 2023?");
    await page.getByRole("button", { name: "Find the pages" }).click();
    await expect(page.getByRole("heading", { name: /The 5 best pages/ })).toBeVisible();
    await expect(page.getByRole("article")).toHaveCount(5);
    // The company was recognised, so the search was narrowed to its filings.
    await expect(page.getByRole("status").filter({ hasText: "Recognised Best Buy" })).toBeVisible();
    // Words of the question are marked on the pages.
    expect(await page.locator("article mark").count()).toBeGreaterThan(0);
  });

  test("the button waits for a question", async ({ page }) => {
    await ready(page);
    await expect(page.getByRole("button", { name: "Find the pages" })).toBeDisabled();
    await page.getByLabel("Your question").fill("revenue");
    await expect(page.getByRole("button", { name: "Find the pages" })).toBeEnabled();
  });

  test("a benchmark question shows where FinanceBench says the answer is, and how this search ranks it", async ({ page }) => {
    await ready(page);
    await page.getByLabel(/Or try one of the/).selectOption({ index: 1 });
    await expect(page.getByText("What FinanceBench says")).toBeVisible();
    await expect(page.getByText(/marks page \d+ of/)).toBeVisible();
    await expect(page.getByText(/The same question three ways/)).toBeVisible();
    // The question was put into the box, so it can be edited and asked again.
    await expect(page.getByLabel("Your question")).not.toHaveValue("");
  });

  test("a page can be opened in full and closed again", async ({ page }) => {
    await ready(page);
    await page.getByLabel("Your question").fill("net income and revenue");
    await page.getByRole("button", { name: "Find the pages" }).click();
    const first = page.getByRole("article").first();
    const more = first.getByRole("button", { name: "Show the whole page" });
    await more.click();
    await expect(first.getByRole("button", { name: "Show less" })).toHaveAttribute("aria-expanded", "true");
    await first.getByRole("button", { name: "Show less" }).click();
    await expect(first.getByRole("button", { name: "Show the whole page" })).toBeVisible();
  });

  test("searching inside one filing, and turning the filter off", async ({ page }) => {
    await ready(page);
    await page.getByLabel("Your question").fill("What did 3M report about litigation?");
    await page.getByRole("button", { name: "Find the pages" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Recognised 3M" })).toBeVisible();

    await page.getByLabel("Narrow by the company and year in the question").uncheck();
    await expect(page.getByRole("status").filter({ hasText: "Searched all 7 filings" })).toBeVisible();

    await page.getByLabel("Search in").selectOption({ index: 2 });
    await expect(page.getByRole("status").filter({ hasText: /Searched inside/ })).toBeVisible();
    const docs = await page.getByRole("article").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label") ?? ""));
    // Each label reads "Rank 3: AMD_2022_10K, page 56"; every page is from one filing.
    expect(docs).toHaveLength(5);
    expect(new Set(docs.map((d) => d.split(": ")[1].split(",")[0])).size).toBe(1);
  });

  test("a question with no words in any page says so", async ({ page }) => {
    await ready(page);
    await page.getByLabel("Your question").fill("zzzzqqqq xxxxyyyy");
    await page.getByRole("button", { name: "Find the pages" }).click();
    await expect(page.getByRole("heading", { name: "No page matches" })).toBeVisible();
  });

  test("the theme can be switched and is remembered", async ({ page }) => {
    await ready(page);
    const before = await page.locator("html").getAttribute("data-theme");
    await page.getByRole("button", { name: /Switch to (dark|light) theme/ }).click();
    const after = await page.locator("html").getAttribute("data-theme");
    expect(after).not.toBe(before);
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", after!);
  });
});

test.describe("results", () => {
  test("shows the chart, the legend and the table, and the depth can be changed", async ({ page }) => {
    await page.goto("/results");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("What has been measured");
    await expect(page.getByRole("heading", { name: /top 10 results/ })).toBeVisible();
    await expect(page.getByRole("img", { name: /Bar chart/ })).toBeVisible();
    await expect(page.getByRole("list", { name: "Legend" }).getByRole("listitem")).toHaveCount(3);
    await page.locator("label", { hasText: "top 3" }).click();
    await expect(page.getByRole("heading", { name: /top 3 results/ })).toBeVisible();
    await expect(page.getByRole("table")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Not measured yet" })).toBeVisible();
  });

  test("the table's numbers are the ones in the chart's data", async ({ page }) => {
    await page.goto("/results");
    const rows = page.getByRole("table").locator("tbody tr");
    await expect(rows).toHaveCount(12); // 4 groups of questions x 3 ways of searching
    const overall = rows.first();
    await expect(overall).toContainText("All filings");
    await expect(overall).toContainText("13%");
  });
});

test.describe("how it works", () => {
  test("says which parts have not been run", async ({ page }) => {
    await page.goto("/how");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("How it works");
    await expect(page.getByRole("row", { name: /Judge/ })).toContainText("Built, not run");
    await expect(page.getByRole("row", { name: /Keyword search/ })).toContainText("Measured");
  });

  test("an unknown address gives the 404 page", async ({ page }) => {
    const res = await page.goto("/nothing-here");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "No such page" })).toBeVisible();
  });
});

for (const theme of ["light", "dark"] as const) {
  test.describe(`accessibility, ${theme} theme`, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript((value) => localStorage.setItem("footnote:theme", value), theme);
    });

    test("search, before and after asking", async ({ page }) => {
      await ready(page);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      expect(await violations(page)).toEqual([]);
      await page.getByLabel(/Or try one of the/).selectOption({ index: 3 });
      await expect(page.getByText("What FinanceBench says")).toBeVisible();
      await page.getByRole("article").first().getByRole("button", { name: "Show the whole page" }).click();
      expect(await violations(page)).toEqual([]);
    });

    test("results", async ({ page }) => {
      await page.goto("/results");
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expect(page.getByRole("img", { name: /Bar chart/ })).toBeVisible();
      expect(await violations(page)).toEqual([]);
    });

    test("how it works", async ({ page }) => {
      await page.goto("/how");
      expect(await violations(page)).toEqual([]);
    });
  });
}

test.describe("headers", () => {
  test("the content policy names no other site, and only the portfolio may frame the pages", async ({ request }) => {
    const res = await request.get("/");
    const csp = res.headers()["content-security-policy"];
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'self' https://uzair-khan-lac.vercel.app");
    expect(csp).not.toMatch(/https?:\/\/(?!uzair-khan-lac)/);
    expect(res.headers()["x-frame-options"]).toBeUndefined();
    expect(res.headers()["x-content-type-options"]).toBe("nosniff");
    expect(res.headers()["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(res.headers()["permissions-policy"]).toContain("camera=()");
  });

  test("the data files are served and are what the page expects", async ({ request }) => {
    const filings = await (await request.get("/data/filings.json")).json();
    expect(filings).toHaveLength(7);
    const pages = await (await request.get(`/data/pages/${filings[0].doc}.json`)).json();
    expect(pages.pages).toHaveLength(filings[0].pages);
  });

  test("no request leaves the site while using it", async ({ page, baseURL }) => {
    const own = new URL(baseURL!).hostname;
    const outside: string[] = [];
    page.on("request", (r) => {
      const url = new URL(r.url());
      if (url.hostname !== own && url.protocol.startsWith("http")) outside.push(r.url());
    });
    await ready(page);
    await page.getByLabel("Your question").fill("AMD revenue");
    await page.getByRole("button", { name: "Find the pages" }).click();
    await expect(page.getByRole("article").first()).toBeVisible();
    await page.goto("/results");
    expect(outside).toEqual([]);
  });
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const path of ["/", "/results", "/how"]) {
    test(`${path} does not scroll sideways, and the header fits`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(over).toBeLessThanOrEqual(0);
      // The theme button is the last thing in the header; it must be on screen.
      const box = await page.getByRole("button", { name: /Switch to (dark|light) theme/ }).boundingBox();
      expect(box!.x + box!.width).toBeLessThanOrEqual(390);
    });
  }

  test("a search result fits too", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Your question").fill("AMD revenue by segment");
    await page.getByRole("button", { name: "Find the pages" }).click();
    await expect(page.getByRole("article").first()).toBeVisible();
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(over).toBeLessThanOrEqual(0);
  });
});
