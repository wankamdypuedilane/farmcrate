import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Automated checks find about a third of accessibility problems (contrast, names,
// landmarks, ARIA misuse); keyboard and screen-reader tests are still needed.
const pages = ["/", "/sign-in", "/sign-up", "/design/shop", "/design/account"];

for (const path of pages) {
  for (const colorScheme of ["light", "dark"] as const) {
    test(`${path} has no detectable WCAG A/AA violations (${colorScheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto(path);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      // On failure, the message lists each rule, its impact and the elements concerned.
      expect(
        results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`),
      ).toEqual([]);
    });
  }
}
