import { expect, test, type Page } from "@playwright/test";

// Added with the redesign (DESIGN.md): the first screen, layout at phone and
// window widths, targets, keyboard and focus, the re-sort, and what a link shows.
// site.spec.ts is unchanged apart from the strings listed in the README.

async function ready(page: Page) {
  await page.goto("/");
  await expect(page.getByLabel("Your question")).toBeVisible();
}

const SEARCH_PATH = "/?q=What%20was%20Best%20Buy%27s%20capital%20expenditure%20in%20fiscal%202023%3F";

test.describe("the first screen", () => {
  test("shows a real page of a filing, computed from the data, before anything is asked", async ({ page }) => {
    await ready(page);
    const sample = page.getByRole("figure");
    await expect(sample).toBeVisible();
    await expect(sample).toContainText("p. 30");
    await expect(sample).toContainText("Best Buy, 10-K 2023");
    await expect(sample).toContainText(/#\d+/);
    await expect(sample).toContainText(/score \d+\.\d/);
    expect(await sample.locator("mark").count()).toBeGreaterThan(0);
    // The caption says it is a sample, not the visitor's search, and says where the page ranked.
    await expect(page.getByText(/A sample, not your search: this question, searched in Best Buy, 10-K 2023 only\. This page came \w+\./)).toBeVisible();
    // A sample is not a result: nothing counts it as one.
    await expect(page.getByRole("article")).toHaveCount(0);
    // The sentence about limits, the question field and the head of the page are all on the first screen.
    await expect(page.getByText(/browser search returns source pages/)).toBeInViewport();
    await expect(page.getByLabel("Your question")).toBeInViewport();
    await expect(sample.locator("header")).toBeInViewport();
  });

  test("the sample is there while the filings are still loading", async ({ page }) => {
    await page.route("**/data/filings.json", async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route.continue();
    });
    await page.goto("/");
    await expect(page.getByRole("status").filter({ hasText: /Loading the filings/ }).first()).toBeVisible();
    await expect(page.getByRole("figure")).toContainText("p. 30");
    await expect(page.getByLabel("Your question")).toBeVisible();
  });

  test("on a phone the limits come straight after the headline and are on the first screen", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await ready(page);
    const limits = page.getByText(/browser search returns source pages/);
    await expect(limits).toBeInViewport();
    const h1 = await page.getByRole("heading", { level: 1 }).boundingBox();
    const note = await limits.boundingBox();
    expect(note!.y).toBeGreaterThan(h1!.y);
    await context.close();
  });
});

test.describe("layout", () => {
  for (const width of [390, 800]) {
    test.describe(`at ${width} px`, () => {
      test.use({ viewport: { width, height: 844 } });

      for (const path of ["/", SEARCH_PATH, "/results", "/how"]) {
        test(`${path.slice(0, 12)} does not scroll sideways`, async ({ page }) => {
          await page.goto(path);
          await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
          if (path.includes("?q=")) await expect(page.getByRole("article").first()).toBeVisible();
          const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
          expect(over).toBeLessThanOrEqual(0);
          // Nothing sticks out past the right edge, except inside a region that scrolls on its own.
          const wide = await page.evaluate(() =>
            [...document.querySelectorAll<HTMLElement>("main *")]
              .filter((el) => {
                if (el.closest("[role=region]")) return false;
                const r = el.getBoundingClientRect();
                return r.width > 0 && r.right > window.innerWidth + 1;
              })
              .map((el) => `${el.tagName}.${el.className}`)
              .slice(0, 5),
          );
          expect(wide).toEqual([]);
        });
      }
    });
  }

  test("a wide table scrolls inside its own labelled, focusable region and never widens the page", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    for (const [path, name] of [
      ["/results", /Table of every number/],
      ["/how", /Parts of Footnote/],
    ] as const) {
      await page.goto(path);
      const region = page.getByRole("region", { name });
      await expect(region).toBeVisible();
      expect(await region.getAttribute("tabindex")).toBe("0");
      const [scroll, client] = await region.evaluate((el) => [el.scrollWidth, el.clientWidth]);
      expect(scroll).toBeGreaterThan(client);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    }
    await context.close();
  });

  test("on a phone the controls are big enough to hit", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await page.goto(SEARCH_PATH);
    await expect(page.getByRole("article").first()).toBeVisible();
    const height = async (loc: ReturnType<Page["locator"]>) => (await loc.boundingBox())!.height;
    // The primary control: 44 px.
    expect(await height(page.getByRole("button", { name: "Find the pages" }))).toBeGreaterThanOrEqual(44);
    // The checkbox is a 20 px square in a 44 px row.
    const box = await page.getByLabel("Narrow by the company and year in the question").boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(20);
    expect(await height(page.locator("label", { hasText: "Narrow by the company and year" }))).toBeGreaterThanOrEqual(44);
    // The summary, the footer links, the example links, the links on a result.
    expect(await height(page.getByText("Which filings can I ask about?"))).toBeGreaterThanOrEqual(44);
    for (const link of await page.getByRole("contentinfo").getByRole("link").all()) expect(await height(link)).toBeGreaterThanOrEqual(32);
    for (const b of await page.getByRole("group", { name: "Try an example" }).getByRole("button").all()) expect(await height(b)).toBeGreaterThanOrEqual(44);
    const first = page.getByRole("article").first();
    for (const c of [first.getByRole("link", { name: /Open the filing/ }), first.getByRole("button", { name: "Copy citation" }), first.getByRole("button", { name: "Show the whole page" })])
      expect(await height(c)).toBeGreaterThanOrEqual(32);
    // The header's links, and the top-k toggles on Results.
    for (const link of await page.getByRole("banner").getByRole("link").all()) expect(await height(link)).toBeGreaterThanOrEqual(32);
    await page.goto("/results");
    for (const label of await page.locator("fieldset label").all()) expect(await height(label)).toBeGreaterThanOrEqual(44);
    await context.close();
  });
});

test.describe("keyboard", () => {
  const active = (page: Page) => page.evaluate(() => (document.activeElement as HTMLElement | null)?.id || document.activeElement?.tagName || "none");

  test("a skip link is the first stop and moves the focus into the page", async ({ page }) => {
    await ready(page);
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to the content" });
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    await page.keyboard.press("Enter");
    await expect(page.locator("main")).toBeFocused();
  });

  test("focus never falls to the page after a search, a scope change, a filter change or a re-sort", async ({ page }) => {
    await ready(page);
    const box = page.getByLabel("Your question");
    await box.fill("What did 3M report about litigation?");
    await box.press("Enter");
    await expect(page.getByRole("heading", { name: /The 5 best pages/ })).toBeFocused();

    // The scope select keeps the focus while the list re-sorts under it.
    const scope = page.getByLabel("Search in");
    await scope.focus();
    await scope.selectOption({ index: 2 });
    await expect(page.getByRole("status").filter({ hasText: /Searched inside/ })).toBeVisible();
    expect(await active(page)).toBe("scope");
    await page.waitForTimeout(400);
    expect(await active(page)).toBe("scope");

    // So does the filter checkbox.
    await scope.selectOption({ index: 0 });
    const narrow = page.getByLabel("Narrow by the company and year in the question");
    await narrow.focus();
    await narrow.press("Space");
    await expect(narrow).not.toBeChecked();
    await expect(narrow).toBeFocused();
    await page.waitForTimeout(400);
    await expect(narrow).toBeFocused();

    // Opening a page keeps the focus on the button that did it.
    const more = page.getByRole("article").first().getByRole("button", { name: "Show the whole page" });
    await more.focus();
    await more.press("Enter");
    await expect(page.getByRole("article").first().getByRole("button", { name: "Show less" })).toBeFocused();

    // "Start over" hands the focus to the question.
    await page.getByRole("button", { name: "Start over" }).press("Enter");
    await expect(box).toBeFocused();
  });

  test("a failed load and its retry keep the keyboard in the page, and the message is in plain words", async ({ page }) => {
    await page.route("**/data/filings.json", (route) => route.fulfill({ status: 500, body: "boom" }));
    await page.goto("/");
    const alert = page.getByRole("alert").filter({ hasText: "could not be loaded" });
    await expect(alert).toBeVisible();
    const said = (await alert.textContent()) ?? "";
    expect(said).not.toMatch(/TypeError|Failed to fetch|500|undefined|\.json/);
    await page.unroute("**/data/filings.json");
    const retry = page.getByRole("button", { name: "Try again" });
    await retry.focus();
    await retry.press("Enter");
    await expect(page.getByLabel("Your question")).toBeFocused();
  });

  test("every kind of control shows a focus ring when reached with the keyboard", async ({ page }) => {
    await ready(page);
    await page.getByLabel("Your question").fill("AMD revenue");
    await page.getByLabel("Your question").press("Enter");
    await expect(page.getByRole("article").first()).toBeVisible();
    const targets = [
      page.getByRole("button", { name: "Find the pages" }),
      page.getByRole("group", { name: "Try an example" }).getByRole("button").first(),
      page.getByLabel("Search in"),
      page.getByLabel("Narrow by the company and year in the question"),
      page.getByRole("button", { name: "Copy link to this search" }),
      page.getByRole("article").first().getByRole("button", { name: "Copy citation" }),
      page.getByRole("article").first().getByRole("link", { name: /Open the filing/ }),
      page.getByRole("banner").getByRole("link", { name: "Results" }),
      page.getByRole("button", { name: /Switch to (dark|light) theme/ }),
    ];
    for (const t of targets) {
      await t.focus();
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.press("Tab"); // arrives by keyboard, so :focus-visible applies
      await expect(t).toBeFocused();
      const ring = await t.evaluate((el) => {
        const s = getComputedStyle(el);
        return { style: s.outlineStyle, width: parseFloat(s.outlineWidth) };
      });
      expect(ring.style).not.toBe("none");
      expect(ring.width).toBeGreaterThanOrEqual(2);
    }
  });
});

test.describe("the re-sort", () => {
  test("pages that stay slide to their new rank, and nothing is left running afterwards", async ({ page }) => {
    await ready(page);
    await page.getByLabel("Your question").fill("What did 3M report about litigation?");
    await page.getByLabel("Narrow by the company and year in the question").uncheck();
    await page.getByLabel("Your question").press("Enter");
    await expect(page.getByRole("article")).toHaveCount(5);
    await page.getByLabel("Search in").selectOption({ index: 3 });
    await expect(page.getByRole("status").filter({ hasText: /Searched inside/ })).toBeVisible();
    await expect(page.getByRole("article")).toHaveCount(5);
    await expect.poll(() => page.evaluate(() => document.getAnimations().length), { timeout: 3000 }).toBe(0);
  });

  test("under reduced motion nothing moves at all", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await ready(page);
    await page.getByLabel("Your question").fill("What did 3M report about litigation?");
    await page.getByLabel("Your question").press("Enter");
    await expect(page.getByRole("article")).toHaveCount(5);
    await page.getByLabel("Narrow by the company and year in the question").uncheck();
    const sliding = await page.evaluate(
      () => document.getAnimations().filter((a) => (a.effect as KeyframeEffect | null)?.getKeyframes().some((k) => "translate" in k)).length,
    );
    expect(sliding).toBe(0);
  });
});

test.describe("what a link to the site shows", () => {
  for (const [path, title] of [
    ["/", /Footnote: the page behind the figure/],
    ["/results", /^Results · Footnote$/],
    ["/how", /^How it works · Footnote$/],
  ] as const) {
    test(`${path} has its own title, a description and a share image that is served`, async ({ page, request }) => {
      await page.goto(path);
      await expect(page).toHaveTitle(title);
      expect(((await page.locator('meta[name="description"]').getAttribute("content")) ?? "").length).toBeGreaterThan(40);
      const image = await page.locator('meta[property="og:image"]').getAttribute("content");
      expect(image).toBeTruthy();
      const res = await request.get(new URL(image!).pathname);
      expect(res.status()).toBe(200);
      expect(res.headers()["content-type"]).toContain("image/png");
      expect(await page.locator('meta[property="og:image:alt"]').getAttribute("content")).toBeTruthy();
      expect(await page.locator('link[rel="icon"]').count()).toBeGreaterThan(0);
    });
  }
});
