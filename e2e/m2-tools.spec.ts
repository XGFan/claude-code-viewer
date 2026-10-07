import { expect, test, type Page } from "@playwright/test";

const RICH_TITLE = "为 /v1/chat 接口增加令牌桶限流中间件";

async function openRich(page: Page) {
  await page.goto("/");
  await page.getByTestId("session-row").filter({ hasText: RICH_TITLE }).click();
  await expect(page.getByTestId("header").getByRole("heading", { name: RICH_TITLE })).toBeVisible();
}


test("失败的 Bash 默认展开并渲染 ANSI 颜色", async ({ page }) => {
  await openRich(page);
  const failed = page.locator('[data-tool="Bash"][data-failed]').first();
  await failed.scrollIntoViewIfNeeded();
  const term = failed.getByTestId("terminal");
  await expect(term).toContainText("unresolved import");
  await expect(failed).toContainText("退出码 101");
  const colored = term.locator("span[style*='color']").filter({ hasText: "error[E0432]" });
  await expect(colored).toBeVisible();
  const color = await colored.evaluate((e) => getComputedStyle(e).color);
  expect(color).not.toBe(await term.evaluate((e) => getComputedStyle(e).color));
});

test("Edit 展开后显示带 +/- 的 diff", async ({ page }) => {
  await openRich(page);
  const edit = page.locator('[data-tool="Edit"]').filter({ hasText: "mod.rs" }).first();
  await edit.scrollIntoViewIfNeeded();
  await edit.getByRole("button").first().click();
  await expect(edit.locator('[data-diff="add"]')).toHaveCount(1);
  await expect(edit.locator('[data-diff="del"]')).toHaveCount(1);
  await expect(edit.locator('[data-diff="add"]')).toContainText("rate_limit::layer()");
  await expect(edit).toContainText("+1");
  await expect(edit).toContainText("−1");
});

test("持久化输出可点击加载完整内容", async ({ page }) => {
  await openRich(page);
  const bash = page.locator('[data-tool="Bash"]').filter({ hasText: "cargo test --workspace" });
  await bash.scrollIntoViewIfNeeded();
  await bash.getByRole("button").first().click();
  await expect(bash).toContainText("来源：tool-results/bd2x9k1.txt");
  await bash.getByRole("button", { name: /加载完整输出（共 180\.0 KB）/ }).click();
  await expect(bash).toContainText("412 passed");
  await expect(bash).toContainText("中间");
  await expect(bash.getByRole("button", { name: /加载完整输出/ })).toHaveCount(0);
});

test("图片缩略图渲染并可放大", async ({ page }) => {
  await openRich(page);
  const read = page.locator('[data-tool="Read"]').filter({ hasText: "grafana-ratelimit.png" });
  await read.scrollIntoViewIfNeeded();
  await read.getByRole("button").first().click();
  const thumb = read.getByTestId("image-thumb").locator("img");
  await expect(thumb).toBeVisible();
  await read.getByTestId("image-thumb").click();
  await expect(page.getByTestId("image-large")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("image-large")).toHaveCount(0);
});

test("AskUserQuestion 标出所选答案，任务清单显示状态", async ({ page }) => {
  await openRich(page);
  const ask = page.locator('[data-tool="AskUserQuestion"]');
  await ask.scrollIntoViewIfNeeded();
  await ask.getByRole("button").first().click();
  await expect(ask.locator("[data-chosen]")).toContainText("429 + Retry-After");
  const todo = page.locator('[data-tool="TodoWrite"]');
  await todo.getByRole("button").first().click();
  await expect(todo.getByTestId("checklist").locator("li")).toHaveCount(3);
});
