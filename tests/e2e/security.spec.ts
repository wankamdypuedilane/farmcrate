import { expect, test } from "@playwright/test";

test("every page is served with the security headers", async ({ request }) => {
  for (const path of ["/", "/sign-in", "/api/health"]) {
    const response = await request.get(path);
    const headers = response.headers();
    expect(headers["content-security-policy"], path).toContain("frame-ancestors 'none'");
    expect(headers["x-content-type-options"], path).toBe("nosniff");
    expect(headers["referrer-policy"], path).toBe("strict-origin-when-cross-origin");
    expect(headers["x-frame-options"], path).toBe("DENY");
  }
});

test("the pages work under the Content Security Policy", async ({ page }) => {
  const violations: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && message.text().includes("Content Security Policy")) {
      violations.push(message.text());
    }
  });
  for (const path of ["/", "/sign-in", "/design/shop", "/design/account"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
  }
  // The theme menu runs client-side code: it must still work.
  await page.getByRole("button", { name: "Change colour theme" }).click();
  await page.getByRole("menuitemradio", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  expect(violations).toEqual([]);
});

test("the health check answers without revealing configuration", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(Object.keys(await response.json()).sort()).toEqual(["database", "status", "version"]);
});
