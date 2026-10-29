import { expect, test } from "@playwright/test";

const routes = [
  ["/load-converter", "Gas Demand & Conversions"],
  ["/energy-cost-comparison", "Customer Energy Comparison"],
  ["/chp", "CHP Feasibility"],
  ["/emissions", "Emissions & Grid Analysis"],
  ["/load-estimator", "Facility Load Screening"],
  ["/gas-flow", "Gas Flow & Demand"],
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
  await expect(page.getByText(/77\.31/).first()).toBeVisible();
  await page.getByLabel("Annual primary-source usage").fill("20");
  await expect(page.getByText(/154\.61/).first()).toBeVisible();

  await page.goto("/load-estimator");
  const loadSummary = page.getByText("Estimated heating load").locator("..");
  await expect(loadSummary).toContainText("60.0");
  await expect(loadSummary).toContainText("3.33 cooling tons");
  await page.getByRole("button", { name: "Compare building-condition scenarios" }).click();
  await expect(page.getByText("Tight / New", { exact: true })).toBeVisible();

  await page.goto("/gas-flow");
  await expect(page.getByText("Required gas flow").locator("..")).toContainText("242");

  await page.goto("/unit-conversions");
  await page.getByLabel("Input value").fill("100000");
  await expect(page.getByLabel("Output value")).toHaveValue("1.00");

  await page.goto("/chp");
  await expect(page.getByText("Recommended CHP size")).toBeVisible();
  await expect(page.getByText("Annual savings")).toBeVisible();
  await expect(page.getByText("Net added gas")).toBeVisible();

  await page.goto("/emissions");
  await expect(page.getByText("Direct gas combustion")).toBeVisible();
  await expect(page.getByText("Grid-average heat pump")).toBeVisible();
});

test("visible calculator controls have accessible names", async ({ page }) => {
  for (const [path] of routes) {
    await page.goto(path);
    if (path === "/chp") {
      await page.getByRole("button", { name: "Detailed inputs" }).click();
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
  expect(headerHeight).toBeLessThanOrEqual(80);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

  const mobileNav = page.getByRole("navigation", { name: "Primary mobile navigation" });
  await expect(mobileNav.getByRole("link", { name: "Gas", exact: true })).toBeVisible();
  await mobileNav.getByRole("link", { name: "Gas", exact: true }).click();
  await expect(page).toHaveURL(/\/load-converter\/?$/);
  await expect(page.getByRole("heading", { name: "Gas Demand & Conversions", exact: true })).toBeVisible();

  await context.close();
});

for (const width of [360, 390, 430, 768, 1024, 1440]) {
  test(`routes have no horizontal overflow at ${width}px`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width, height: width < 768 ? 844 : 900 } });
    const page = await context.newPage();
    for (const [path] of [["/"], ...routes]) {
      await page.goto(path);
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `${path} at ${width}px`).toBeLessThanOrEqual(width);
    }
    await context.close();
  });
}

test("emissions exposes licensing and unavailable-data state", async ({ page }) => {
  await page.goto("/emissions");
  await expect(page.getByText("PJM live data: not displayed")).toBeVisible();
  await expect(page.getByText("Grid factor required")).toBeVisible();
  await page.getByLabel("Grid average factor").fill("800");
  await expect(page.getByText("Lower modeled emissions").locator("..")).not.toContainText("Grid factor required");
});

test("homepage search finds calculators by calculation term", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Find a calculator or calculation").fill("COP");
  await expect(page.getByRole("heading", { name: "Search results" })).toBeVisible();
  await expect(page.locator("main").getByRole("link", { name: /Energy Savings/ })).toBeVisible();
  await expect(page.locator("main").getByRole("link", { name: /Gas Demand/ })).toHaveCount(0);
});

test("homepage follows the shared light and dark color scheme", async ({ page }) => {
  await page.goto("/");
  const gasDemandCard = page.locator("main").getByRole("link", { name: /Gas Demand/ });
  const lightCardColor = await gasDemandCard.evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(lightCardColor).not.toBe("rgb(0, 0, 0)");

  await page.getByRole("button", { name: "Toggle theme" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  const darkCardColor = await gasDemandCard.evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(darkCardColor).not.toBe(lightCardColor);
});

test("gas demand routes do not show the retired workflow switcher", async ({ page }) => {
  for (const path of ["/load-converter", "/gas-flow"]) {
    await page.goto(path);
    await expect(page.getByRole("navigation", { name: "Gas demand workflow views" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Load & energy", exact: true })).toHaveCount(0);
  }
});
