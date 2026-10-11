import { defineConfig, devices } from "@playwright/test";

// End-to-end tests drive the real app in a real browser. Locally they use the
// dev server (and reuse one that is already running); in CI they run against
// the production build. With BASE_URL set (for example the live site) they run
// against that address and start no server:
//   BASE_URL=https://footnote-ten.vercel.app npx playwright test
const BASE_URL = process.env.BASE_URL;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  expect: { timeout: 10_000 },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: BASE_URL ?? "http://localhost:3050",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } },
    },
  ],
  webServer: BASE_URL
    ? undefined
    : {
        command: process.env.CI ? "npm run start" : "npm run dev",
        url: "http://localhost:3050",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
