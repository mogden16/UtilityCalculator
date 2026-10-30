import { expect, test } from "@playwright/test";

test("core routes render and navigation works", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: /What do you want to calculate/i,
    }),
  ).toBeVisible();

  await page.locator("main").getByRole("link", { name: /Load Converter/ }).first().click();
  await expect(page).toHaveURL(/\/load-converter\/?$/);
  await expect(page.getByRole("heading", { name: "Gas Demand & Conversions" })).toBeVisible();

  const nav = page.locator("header nav");
  await expect(nav.getByRole("link").nth(1)).toHaveText("Load Converter");
  await expect(nav.getByRole("link", { name: "Gas Flow", exact: true })).toHaveCount(0);

  await nav.getByRole("link", { name: "CHP", exact: true }).click();
  await expect(page).toHaveURL(/\/chp\/?$/);
  await expect(page.getByRole("heading", { name: "CHP Feasibility" })).toBeVisible();

  await nav.getByRole("link", { name: "Emissions", exact: true }).click();
  await expect(page).toHaveURL(/\/emissions\/?$/);
  await expect(page.getByRole("heading", { name: "Emissions & Grid Analysis", exact: true })).toBeVisible();

  await nav.getByRole("link", { name: "Conversions", exact: true }).click();
  await expect(page).toHaveURL(/\/unit-conversions\/?$/);
  await expect(page.getByRole("heading", { name: "Unit Conversions" })).toBeVisible();
});
