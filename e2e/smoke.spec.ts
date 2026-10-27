import { expect, test } from "@playwright/test";

test("两栏布局与统计、设置入口可见", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("pane-sessions")).toBeVisible();
  await expect(page.getByTestId("pane-conversation")).toBeVisible();
  await expect(page.getByTestId("nav-stats")).toBeVisible();
  await expect(page.getByTestId("settings-button")).toBeVisible();
});

test("统计按钮再次点击回到 Session", async ({ page }) => {
  await page.goto("/");
  const stats = page.getByTestId("nav-stats");
  await stats.click();
  await expect(stats).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("pane-sessions")).toBeHidden();
  await stats.click();
  await expect(page.getByTestId("pane-sessions")).toBeVisible();
});
