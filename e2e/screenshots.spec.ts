import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";

const routes = ["home", "load-converter", "energy-cost-comparison", "chp", "emissions", "load-estimator", "gas-flow", "unit-conversions"];

for (const width of [390, 1440]) {
  test(`capture primary routes at ${width}px`, async ({ browser }) => {
    const output = path.join(process.cwd(), "artifacts", "screenshots");
    await mkdir(output, { recursive: true });
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1000 }, colorScheme: "light" });
    const page = await context.newPage();
    for (const route of routes) {
      await page.goto(route === "home" ? "/" : `/${route}`);
      await expect(page.locator("h1").first()).toBeVisible();
      await page.screenshot({ path: path.join(output, `${route}-${width}.png`), fullPage: true });
    }
    await context.close();
  });
}

test("capture homepage dark mode at 390px", async ({ browser }) => {
  const output = path.join(process.cwd(), "artifacts", "screenshots");
  await mkdir(output, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: "dark" });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.screenshot({ path: path.join(output, "home-dark-390.png"), fullPage: true });
  await context.close();
});
