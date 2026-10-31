import { expect, test } from "@playwright/test";

const routes = [
  ["/load-converter", "Gas Demand & Conversions"],
  ["/gas-equipment-sizing", "Gas Service, Meter & Regulator Sizing"],
  ["/energy-cost-comparison", "Customer Energy Comparison"],
  ["/feasibility-studio", "Feasibility Studio"],
  ["/chp", "CHP Feasibility"],
  ["/emissions", "Emissions & Grid Analysis"],
  ["/load-estimator", "Facility Load Screening"],
  ["/unit-conversions", "Unit Conversions"],
] as const;

function createSyntheticUtilityPdf(lines: string[]): Buffer {
  const escapeText = (value: string) => value.replace(/([\\()])/g, "\\$1");
  const textCommands = lines.map((line, index) => `${index ? "0 -18 Td " : ""}(${escapeText(line)}) Tj`).join("\n");
  const stream = `BT\n/F1 12 Tf\n72 720 Td\n${textCommands}\nET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}

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

  await page.goto("/load-converter");
  await expect(page.getByText("Required gas flow").locator("..")).toContainText("242");

  await page.goto("/gas-equipment-sizing");
  await expect(page.getByText("Qualifying service").locator("..")).toContainText('1 1/4" IPS');
  await expect(page.getByText("452 CFH", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Meter" }).click();
  await expect(page.getByText("Turbine · 45° rotor")).toBeVisible();
  await expect(page.getByText("18,000 CFH", { exact: true }).first()).toBeVisible();

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

test("feasibility studio completes a traceable fuel-conversion screening", async ({ page }) => {
  await page.goto("/feasibility-studio");
  await page.getByLabel("Project name *").fill("Boiler conversion");
  await page.getByLabel("Facility name *").fill("Test facility");
  await page.getByRole("button", { name: /Continue/ }).click();

  await page.getByLabel("Account name / ID").fill("Oil account");
  await page.getByLabel("Utility", { exact: true }).selectOption("fuel_oil_no2");
  await page.getByLabel("Period start").fill("2025-01-01");
  await page.getByLabel("Period end").fill("2025-12-31");
  await page.getByLabel("Usage", { exact: true }).fill("10000");
  await page.getByLabel("Total charges").fill("40000");
  await page.getByRole("button", { name: "Add billing period" }).click();
  await expect(page.getByText("1 billing period", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: /Continue/ }).click();

  await page.getByRole("button", { name: /No\. 2 fuel oil → natural gas/ }).click();
  await page.getByRole("button", { name: /Continue/ }).click();
  await page.getByRole("button", { name: "Use 1 bill" }).click();
  await page.getByRole("button", { name: /Continue/ }).click();
  await expect(page.getByText("Expected annual net operating savings")).toBeVisible();
  await expect(page.getByText("1,160 MCF/yr")).toBeVisible();
  await page.getByRole("button", { name: /Continue/ }).click();
  await expect(page.getByRole("heading", { name: "Version provenance" })).toBeVisible();
  await expect(page.getByRole("row", { name: /Calculation engine 1\.0\.0/ })).toBeVisible();
  await expect(page.getByText(/UCFS-[0-9A-F]{8}/).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Versioned project JSON" })).toBeEnabled();
});

test("feasibility studio extracts a searchable PDF locally and requires review", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto("/feasibility-studio");
  await page.getByLabel("Project name *").fill("PDF bill intake");
  await page.getByLabel("Facility name *").fill("Synthetic facility");
  await page.getByRole("button", { name: /Continue/ }).click();

  const pdf = createSyntheticUtilityPdf([
    "Account Number: ELEC-1001",
    "Billing Period: 01/01/2025 - 01/31/2025",
    "Current Usage 120000 kWh",
    "Billing Demand 420 kW",
    "Energy Charges $12000.00",
    "Demand Charges $5000.00",
    "Total Amount Due $18500.00",
    "Rate Class: GS-2",
  ]);
  await page.getByLabel("Upload PDF utility bills").setInputFiles({ name: "synthetic-electric.pdf", mimeType: "application/pdf", buffer: pdf });

  await expect(page.getByText("Review PDF extraction", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Account name / ID").first()).toHaveValue("ELEC-1001");
  await expect(page.getByLabel("Period start").first()).toHaveValue("2025-01-01");
  await expect(page.getByLabel("Usage", { exact: true }).first()).toHaveValue("120000");
  await expect(page.getByLabel("Total charges").first()).toHaveValue("18500");
  await page.getByText("Source evidence for extracted values").click();
  await expect(page.getByText(/synthetic-electric\.pdf, page 1, line 3/).first()).toBeVisible();
  await page.getByRole("button", { name: "Add reviewed bill" }).click();

  await expect(page.getByText("1 billing period", { exact: false })).toBeVisible();
  await expect(page.getByText("synthetic-electric.pdf, page 1", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/requires review before it is treated as confirmed/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await context.close();
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
    if (url.includes("_rsc") || /\/(?:chp|emissions|load-estimator|unit-conversions|energy-cost-comparison)\.txt/.test(url)) {
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
  await expect(mobileNav.getByRole("link", { name: "Size", exact: true })).toBeVisible();
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
  await expect(page.locator("main").getByRole("link", { name: /Load Converter/ })).toHaveCount(0);
});

test("homepage follows the shared light and dark color scheme", async ({ page }) => {
  await page.goto("/");
  const loadConverterCard = page.locator("main").getByRole("link", { name: /Load Converter/ }).first();
  const lightCardColor = await loadConverterCard.evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(lightCardColor).not.toBe("rgb(0, 0, 0)");

  await page.getByRole("button", { name: "Toggle theme" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  const darkCardColor = await loadConverterCard.evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(darkCardColor).not.toBe(lightCardColor);
});

test("homepage promotes exactly the four requested primary tools", async ({ page }) => {
  await page.goto("/");
  const primarySection = page.getByRole("heading", { name: "What do you want to calculate?" }).locator("..");
  const primaryHrefs = await primarySection.locator("a").evaluateAll((links) => links.map((link) => link.getAttribute("href")?.replace(/\/$/, "")));
  expect(primaryHrefs).toEqual(["/load-converter", "/gas-equipment-sizing", "/energy-cost-comparison", "/unit-conversions"]);

  const moreSection = page.getByRole("heading", { name: "More engineering tools" }).locator("..");
  const moreHrefs = await moreSection.locator("a").evaluateAll((links) => links.map((link) => link.getAttribute("href")?.replace(/\/$/, "")));
  expect(moreHrefs).toEqual(["/chp", "/emissions", "/load-estimator", "/feasibility-studio"]);
  await expect(page.locator('main a[href="/gas-flow"]')).toHaveCount(0);
});

test("top navigation uses Load Converter in position two and omits Gas Flow", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto("/load-converter");
  const desktopNav = page.getByRole("navigation", { name: "Calculator tools" });
  const navLinks = desktopNav.getByRole("link");
  await expect(navLinks.nth(1)).toHaveText("Load Converter");
  await expect(desktopNav.getByRole("link", { name: "Gas Flow", exact: true })).toHaveCount(0);
  await context.close();
});

test("legacy gas-flow URL renders the unified load converter", async ({ page }) => {
  await page.goto("/gas-flow");
  await expect(page.getByRole("heading", { name: "Gas Demand & Conversions", exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Gas demand workflow views" })).toHaveCount(0);
});
