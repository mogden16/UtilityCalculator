import { expect, test } from "@playwright/test";

test("core routes render and navigation works", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: "Utility workflows split into focused pages, with live PJM data where server-side logic actually helps.",
    }),
  ).toBeVisible();

  const nav = page.locator("header nav");

  await nav.getByRole("link", { name: "Converter", exact: true }).click();
  await expect(page).toHaveURL(/\/load-converter\/?$/);
  await expect(page.getByRole("heading", { name: "Load Converter" })).toBeVisible();

  await nav.getByRole("link", { name: "CHP", exact: true }).click();
  await expect(page).toHaveURL(/\/chp\/?$/);
  await expect(page.getByRole("heading", { name: "CHP Feasibility Calculator" })).toBeVisible();

  await nav.getByRole("link", { name: "Gas Flow", exact: true }).click();
  await expect(page).toHaveURL(/\/gas-flow\/?$/);
  await expect(page.getByRole("heading", { name: "Gas Flow" })).toBeVisible();

  await nav.getByRole("link", { name: "Conversions", exact: true }).click();
  await expect(page).toHaveURL(/\/unit-conversions\/?$/);
  await expect(page.getByRole("heading", { name: "Unit Conversions" })).toBeVisible();
});
