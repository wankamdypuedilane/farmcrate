import { expect, test } from "@playwright/test";

test("a visitor chooses a box and a pickup point; only ids are submitted", async ({ page }) => {
  await page.goto("/design/shop");
  await expect(page.getByRole("button", { name: "Subscribe for €18.00 a week" })).toBeVisible();
  await page.getByRole("radio", { name: /Family box/ }).check();
  await page.getByLabel("Pickup point").selectOption({ label: "Sizun community hall (Rue de l'Argoat, Sizun)" });
  await page.getByRole("button", { name: "Subscribe for €29.00 a week" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Preview" })).toHaveText(
    "Preview: Stripe Checkout would open for plan a2 at pickup b2.",
  );
});

test("a subscriber sees which deliveries can still be skipped, and skips one", async ({ page }) => {
  await page.goto("/design/account");
  const rows = page.getByRole("listitem");
  await expect(rows).toHaveCount(4);
  await expect(rows.nth(0)).toContainText("Being prepared"); // after Wednesday's cut-off
  await expect(rows.nth(2)).toContainText("Skipped: credited on your next payment");
  await rows.nth(1).getByRole("button", { name: "Skip this week" }).click();
  await expect(rows.nth(1)).toContainText("Skipped. The box price will be deducted from your next payment.");
});

test("the shop fits a 375-pixel phone screen", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/design/shop");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
});
