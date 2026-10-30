import { expect, test } from "@playwright/test";

test("the header offers navigation and a working dark mode", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(nav.getByRole("link", { name: "Monts d'Arrée" })).toBeVisible();

  await page.getByRole("button", { name: "Change colour theme" }).click();
  await page.getByRole("menuitemradio", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);

  // The choice survives a reload (stored by next-themes).
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
});
