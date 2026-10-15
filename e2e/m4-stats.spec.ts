import { expect, test } from "@playwright/test";

test("统计面板渲染卡片与图表", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("nav-stats").click();
  const panel = page.getByTestId("stats");
  await expect(panel.getByRole("heading", { name: "统计" })).toBeVisible();
  await expect(page.getByTestId("pane-sessions")).toBeHidden(); // stats spans the session list column
  await expect(page.getByTestId("stat-card")).toHaveCount(5);
  await expect(page.locator('[data-card="sessions"]')).toContainText("10");
  await expect(page.locator('[data-card="cost"]')).toContainText("$412.37");
  await expect(page.getByTestId("daily-chart").locator("canvas").first()).toBeVisible();
  await expect(page.getByTestId("heat-chart").locator("canvas").first()).toBeVisible();
  await expect(page.getByTestId("project-rank-row")).toHaveCount(3);
  await expect(page.getByTestId("project-rank-row").first()).toContainText("$236.40");
  await expect(page.getByTestId("tool-row").filter({ hasText: "Bash" })).toHaveAttribute("data-high-failure", "true");
  await expect(page.getByTestId("agent-row").first()).toContainText("Explore");

  await page.getByRole("button", { name: "按日" }).click();
  await expect(page.getByTestId("heat-chart").locator("canvas").first()).toBeVisible();
  await page.getByRole("button", { name: "7 天" }).click();
  await expect(page.getByTestId("stat-card")).toHaveCount(5);
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

test("统计页铺满对话区，上下没有空白", async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("/");
  await page.getByTestId("nav-stats").click();
  await page.getByTestId("daily-chart").locator("canvas").first().waitFor();
  const pane = (await page.getByTestId("pane-conversation").boundingBox())!;
  const stats = (await page.getByTestId("stats").boundingBox())!;
  expect(stats.y).toBe(pane.y); // no blank strip above the stats header
  expect(stats.y + stats.height).toBeGreaterThanOrEqual(pane.y + pane.height - 1); // no blank area below
});

test("窗口变高时图表不随之拉高", async ({ page }) => {
  const heights = async () => [
    (await page.getByTestId("daily-chart").boundingBox())!.height,
    (await page.getByTestId("heat-chart").boundingBox())!.height,
  ];
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("/");
  await page.getByTestId("nav-stats").click();
  await page.getByTestId("daily-chart").locator("canvas").first().waitFor();
  const before = await heights();
  await page.setViewportSize({ width: 1400, height: 1400 });
  await expect.poll(heights).toEqual(before);
  expect(before[0]).toBeLessThanOrEqual(260);
});

test("滚动统计内容时，标题、时间范围与 Project 筛选固定不动", async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 620 });
  await page.goto("/");
  await page.getByTestId("nav-stats").click();
  await page.getByTestId("daily-chart").locator("canvas").first().waitFor();
  const range = page.getByRole("button", { name: "30 天" });
  const before = (await range.boundingBox())!.y;
  const body = page.getByTestId("stats-scroll");
  await body.evaluate((e) => (e.scrollTop = e.scrollHeight));
  await expect.poll(() => body.evaluate((e) => e.scrollTop)).toBeGreaterThan(0);
  expect((await range.boundingBox())!.y).toBe(before);
  await expect(page.getByRole("heading", { name: "统计" })).toBeInViewport();
  await expect(range).toBeInViewport();
});

test("本周期：按设定的每周重置时间统计，设置会被记住", async ({ page }) => {
  // A Thursday morning; with a Monday 14:00 reset the cycle began three days ago.
  await page.clock.setFixedTime(new Date("2026-10-15T10:00:00"));
  await page.goto("/");
  await page.getByTestId("nav-stats").click();
  await page.getByRole("button", { name: "本周期" }).click();
  await page.getByLabel("重置日").selectOption("0");
  await page.getByLabel("重置时间").fill("14:00");
  const span = page.getByTestId("cycle-span");
  await expect(span).toHaveText("本周期 10月12日 周一 14:00 至 10月19日 周一 14:00，还剩 4 天 4 小时");
  await expect(page.getByTestId("stat-card")).toHaveCount(5);

  await page.getByLabel("重置日").selectOption("3");
  // Thursday 14:00 is still ahead today, so the cycle began last Thursday.
  await expect(span).toContainText("本周期 10月8日 周四 14:00");

  await page.reload();
  await page.getByTestId("nav-stats").click();
  await page.getByRole("button", { name: "本周期" }).click();
  await expect(page.getByLabel("重置时间")).toHaveValue("14:00");
  await expect(span).toContainText("至 10月15日 周四 14:00，还剩 4 小时 0 分");
});

test("切到本周期时，标题栏不移动", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("nav-stats").click();
  const heading = page.getByRole("heading", { name: "统计" });
  const range = page.getByRole("group", { name: "时间范围" });
  const before = [(await heading.boundingBox())!.y, (await range.boundingBox())!.y];
  await page.getByRole("button", { name: "本周期" }).click();
  await expect(page.getByTestId("cycle-bar")).toBeVisible();
  expect([(await heading.boundingBox())!.y, (await range.boundingBox())!.y]).toEqual(before);
});

test("卡片高度随自身内容，不被同行更高的卡片撑高", async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("/");
  await page.getByTestId("nav-stats").click();
  await page.getByTestId("daily-chart").locator("canvas").first().waitFor();
  // Blank space below each card's last child: its 12px bottom padding plus the border, nothing more.
  const slack = await page.getByTestId("stats").locator("section").evaluateAll((cards) =>
    cards.map((c) => c.getBoundingClientRect().bottom - c.lastElementChild!.getBoundingClientRect().bottom),
  );
  expect(slack.length).toBeGreaterThanOrEqual(5);
  for (const s of slack) expect(s).toBeLessThanOrEqual(14);
});
