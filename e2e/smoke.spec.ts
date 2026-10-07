import { expect, test } from "@playwright/test";

test("三栏布局与统计入口可见", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("pane-projects")).toBeVisible();
  await expect(page.getByTestId("pane-sessions")).toBeVisible();
  await expect(page.getByTestId("pane-conversation")).toBeVisible();
  await expect(page.getByTestId("nav-stats")).toBeVisible();
});
