import { expect, test } from "@playwright/test";

test("统计面板渲染卡片与图表", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("nav-stats").click();
  const panel = page.getByTestId("stats");
  await expect(panel.getByRole("heading", { name: "统计" })).toBeVisible();
  await expect(page.getByTestId("stat-card")).toHaveCount(4);
  await expect(page.locator('[data-card="sessions"]')).toContainText("10");
  await expect(page.getByTestId("daily-chart").locator("canvas").first()).toBeVisible();
  await expect(page.getByTestId("heat-chart").locator("canvas").first()).toBeVisible();
  await expect(page.getByTestId("project-rank-row")).toHaveCount(3);
  await expect(page.getByTestId("tool-row").filter({ hasText: "Bash" })).toHaveAttribute("data-high-failure", "true");
  await expect(page.getByTestId("agent-row").first()).toContainText("Explore");

  await page.getByRole("button", { name: "按日" }).click();
  await expect(page.getByTestId("heat-chart").locator("canvas").first()).toBeVisible();
  await page.getByRole("button", { name: "7 天" }).click();
  await expect(page.getByTestId("stat-card")).toHaveCount(4);
});

test("点击 Project 排行跳到被过滤的会话列表", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("nav-stats").click();
  await page.getByTestId("project-rank-row").filter({ hasText: "orbit-web" }).click();
  await expect(page.getByTestId("stats")).toHaveCount(0);
  await expect(page.getByTestId("session-row").filter({ hasText: "迁移表单校验到 zod" })).toBeVisible();
  await expect(page.getByTestId("session-row").filter({ hasText: "为 /v1/chat 接口增加令牌桶限流中间件" })).toHaveCount(0);
});

test("点击工具行按 tool 下钻会话列表", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("nav-stats").click();
  await page.getByTestId("tool-row").filter({ hasText: "Bash" }).click();
  await expect(page.getByTestId("stats")).toHaveCount(0);
  await expect(page.getByTestId("session-row").first()).toBeVisible();
  const chip = page.getByTestId("drill-chip");
  await expect(chip).toContainText("工具 Bash");
  const filtered = await page.getByTestId("session-row").count();
  await chip.getByRole("button", { name: "清除筛选" }).click();
  await expect(chip).toHaveCount(0);
  await expect.poll(() => page.getByTestId("session-row").count()).toBeGreaterThanOrEqual(filtered);
});

test("下钻带上统计的时间范围", async ({ page }) => {
  await page.goto("/");
  const review = page.getByTestId("session-row").filter({ hasText: "/review 订单列表页" }); // last active 8 days ago

  await page.getByTestId("nav-stats").click();
  await page.getByRole("group", { name: "时间范围" }).getByRole("button", { name: "全部" }).click();
  await page.getByTestId("tool-row").filter({ hasText: /^Read/ }).click();
  await expect(review).toBeVisible();

  await page.getByTestId("nav-stats").click();
  await page.getByRole("button", { name: "7 天" }).click();
  await page.getByTestId("tool-row").filter({ hasText: /^Read/ }).click();
  await expect(page.getByTestId("drill-chip")).toBeVisible();
  await expect(review).toHaveCount(0);
});
