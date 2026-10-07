import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  use: { baseURL: "http://localhost:1421" },
  projects: [{ name: "webkit", use: { ...devices["Desktop Safari"] } }],
  webServer: {
    command: "pnpm dev:mock --port 1421",
    url: "http://localhost:1421",
    reuseExistingServer: !process.env.CI,
  },
});
