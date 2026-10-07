import { expect, test, type Page } from "@playwright/test";

const RICH_TITLE = "为 /v1/chat 接口增加令牌桶限流中间件";

async function openRich(page: Page) {
  await page.goto("/");
  const row = page.getByTestId("session-row").filter({ hasText: RICH_TITLE });
  await row.click();
  await expect(page.getByTestId("header").getByRole("heading", { name: RICH_TITLE })).toBeVisible();
  return (await row.getAttribute("data-session-id"))!;
}

test("选择项目后会话列表被过滤", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("session-row").filter({ hasText: RICH_TITLE })).toBeVisible();
  await page.getByTestId("project-item").filter({ hasText: "orbit-web" }).click();
  await expect(page.getByTestId("session-row").filter({ hasText: "迁移表单校验到 zod" })).toBeVisible();
  await expect(page.getByTestId("session-row").filter({ hasText: RICH_TITLE })).toHaveCount(0);
  await page.getByTestId("project-all").click();
  await expect(page.getByTestId("session-row").filter({ hasText: RICH_TITLE })).toBeVisible();
});

test("打开会话后渲染标题栏与消息", async ({ page }) => {
  await openRich(page);
  await expect(page.getByTestId("live-state")).toContainText("进行中");
  await expect(page.getByTestId("header")).toContainText("复制 resume 命令");
  await expect(page.locator('[data-kind="userPrompt"]').first()).toBeVisible();
  await expect(page.locator('[data-kind="assistant"]').first()).toBeVisible();
  await expect(page.getByTestId("tool-call").first()).toBeVisible();
});

test("实时追加消息后新内容出现且停留在底部", async ({ page }) => {
  const id = await openRich(page);
  const scroller = page.getByTestId("transcript");
  await expect.poll(() => scroller.evaluate((e) => e.scrollHeight - e.scrollTop - e.clientHeight)).toBeLessThan(60);

  await page.evaluate((sid) => {
    window.__cvMock!.appendNode(sid, {
      id: "e2e-new",
      timestampMs: Date.now(),
      hidden: false,
      inherited: false,
      body: { kind: "assistant", messageId: "m-e2e", model: null, usage: null, isApiError: false, blocks: [{ kind: "text", text: "E2E 追加的新消息" }] },
    });
    window.__cvMock!.emit("sessionsChanged", { changed: [sid], removed: [], projectsChanged: false });
  }, id);

  await expect(page.getByText("E2E 追加的新消息")).toBeVisible();
  await expect.poll(() => scroller.evaluate((e) => e.scrollHeight - e.scrollTop - e.clientHeight)).toBeLessThan(60);
});

test("离开底部时出现新消息提示", async ({ page }) => {
  const id = await openRich(page);
  const scroller = page.getByTestId("transcript");
  await scroller.evaluate((e) => (e.scrollTop = 0));
  await expect.poll(() => scroller.evaluate((e) => e.scrollTop)).toBeLessThan(5);
  await page.evaluate((sid) => {
    window.__cvMock!.appendNode(sid, {
      id: "e2e-new2",
      timestampMs: Date.now(),
      hidden: false,
      inherited: false,
      body: { kind: "assistant", messageId: "m-e2e2", model: null, usage: null, isApiError: false, blocks: [{ kind: "text", text: "另一条新消息" }] },
    });
    window.__cvMock!.emit("sessionsChanged", { changed: [sid], removed: [], projectsChanged: false });
  }, id);
  await expect(page.getByTestId("new-messages")).toBeVisible();
  await page.getByTestId("new-messages").click();
  await expect(page.getByText("另一条新消息")).toBeVisible();
});

test("setLive 切换进行中标记", async ({ page }) => {
  const id = await openRich(page);
  const dot = page.getByTestId("session-row").filter({ hasText: RICH_TITLE }).getByTestId("live-dot");
  await expect(dot).toHaveAttribute("data-state", "busy");
  await page.evaluate((sid) => window.__cvMock!.setLive(sid, { status: "idle", rawStatus: "idle", pid: null, source: "recentWrite" }), id);
  await expect(dot).toHaveAttribute("data-state", "idle");
  await expect(page.getByTestId("live-state")).toContainText("等待输入");
  await page.evaluate((sid) => window.__cvMock!.setLive(sid, null), id);
  await expect(dot).toHaveCount(0);
  await expect(page.getByTestId("live-state")).toContainText("已结束");
});

test("显示系统消息后出现隐藏节点", async ({ page }) => {
  await openRich(page);
  const hidden = page.getByText("可用技能：review、simplify、security-review");
  await expect(hidden).toHaveCount(0);
  await page.getByRole("checkbox", { name: "显示系统消息" }).click();
  // The refetch with hidden nodes may land after our scroll while the view is still pinned to the bottom.
  const transcript = page.getByTestId("transcript");
  await expect
    .poll(async () => {
      await transcript.evaluate((e) => (e.scrollTop = 0));
      return hidden.isVisible();
    })
    .toBe(true);
});

test("斜杠命令只显示一个斜杠，命令名高亮", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("session-row").filter({ hasText: "/review 订单列表页" }).click();
  const transcript = page.getByTestId("transcript");
  const name = transcript.getByTestId("command-name");
  await expect(name).toHaveText("/review");
  await expect(name.locator("..")).toHaveText("/review 订单列表页");
  // Highlighted like the terminal: the command token is coloured differently from its arguments.
  const [cmdColor, argColor] = await name.evaluate((e) => [getComputedStyle(e).color, getComputedStyle(e.parentElement!).color]);
  expect(cmdColor).not.toBe(argColor);
});
