import { expect, test } from "@playwright/test";

const routes = [
  ["/load-converter", "Load Converter"],
  ["/energy-cost-comparison", "Energy Cost Comparison"],
  ["/chp", "CHP Feasibility Calculator"],
  ["/emissions", "Emissions"],
  ["/load-estimator", "Load Estimator"],
  ["/gas-flow", "Gas Flow"],
  ["/unit-conversions", "Unit Conversions"],
] as const;

test("every calculator route renders its primary workflow", async ({ page }) => {
  for (const [path, heading] of routes) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading, exact: true }).first()).toBeVisible();
  }
});

test("core calculation baselines remain correct", async ({ page }) => {
  await page.goto("/energy-cost-comparison");
  await expect(page.getByText(/77\.31 No\. 2 oil gal/).first()).toBeVisible();
  await page.getByLabel("Known primary-source usage").fill("20");
  await expect(page.getByText(/154\.61 No\. 2 oil gal/).first()).toBeVisible();

  await page.goto("/load-estimator");
  await expect(page.getByText("60,000 BTU/hr", { exact: true })).toBeVisible();
  await expect(page.getByText("40,000 BTU/hr", { exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: "Heating and cooling loads by building condition" })).toBeVisible();

  await page.goto("/gas-flow");
  await expect(page.getByText("CFH", { exact: true }).first().locator("..")).toContainText("242");

  await page.goto("/unit-conversions");
  await page.getByLabel("Input value").fill("100000");
  await expect(page.getByLabel("Output value")).toHaveValue("1.00");

  await page.goto("/chp");
  await expect(page.getByText("Recommended CHP Size (kW)")).toBeVisible();
  await expect(page.getByRole("img", { name: /percent electric offset/ })).toBeVisible();
  await expect(page.getByRole("img", { name: "Baseline and CHP gas use comparison" })).toBeVisible();

  await page.goto("/emissions");
  await expect(page.getByText("Natural Gas Customer Emissions")).toBeVisible();
  await expect(page.getByText("Electric vs. Gas Comparison")).toBeVisible();
});

test("visible calculator controls have accessible names", async ({ page }) => {
  for (const [path] of routes) {
    await page.goto(path);
    if (path === "/chp") {
      await page.getByRole("button", { name: "ADVANCED" }).click();
    }

    const controls = page.locator("input, button[role='combobox']");
    for (let index = 0; index < (await controls.count()); index += 1) {
      const control = controls.nth(index);
      if (!(await control.isVisible())) continue;
      const hasName = await control.evaluate((element) => {
        const labelledBy = element.getAttribute("aria-labelledby");
        const ariaLabel = element.getAttribute("aria-label");
        const labels = "labels" in element ? (element as HTMLInputElement).labels : null;
        return Boolean(ariaLabel?.trim() || labelledBy?.trim() || labels?.length);
      });
      expect(hasName, `${path} control ${index} should have an accessible name`).toBe(true);
    }
  }
});

test("route links do not prefetch unrelated calculator payloads", async ({ page }) => {
  const prefetchedRoutes: string[] = [];
  page.on("request", (request) => {
    const url = request.url();
    if (url.includes("_rsc") || /\/(?:chp|emissions|gas-flow|load-estimator|unit-conversions|energy-cost-comparison)\.txt/.test(url)) {
      prefetchedRoutes.push(url);
    }
  });

  await page.goto("/load-converter");
  await page.waitForTimeout(1000);
  expect(prefetchedRoutes).toEqual([]);
});

test("mobile navigation stays compact and usable", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto("/energy-cost-comparison");

  const headerHeight = await page.locator("header").evaluate((element) => element.getBoundingClientRect().height);
  expect(headerHeight).toBeLessThan(130);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

  await page.locator("header details summary").click();
  await expect(page.locator("header details").getByRole("link", { name: "Converter", exact: true })).toBeVisible();
  await page.locator("header details").getByRole("link", { name: "Gas Flow", exact: true }).click();
  await expect(page).toHaveURL(/\/gas-flow\/?$/);
  await expect(page.getByRole("heading", { name: "Gas Flow", exact: true })).toBeVisible();

  await context.close();
});
