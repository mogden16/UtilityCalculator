import { defineConfig, devices } from "@playwright/test";

const port = 3000;
const useCloudflarePreview = process.env.CI === "true" || process.env.E2E_USE_CF_PREVIEW === "1";

export default defineConfig({
  testDir: "./e2e",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "on-first-retry",
  },
  webServer: {
    command: useCloudflarePreview ? "npm run preview" : "npm run start",
    port,
    reuseExistingServer: !process.env.CI,
    timeout: useCloudflarePreview ? 240000 : 120000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
