import { expect, test, type Page } from "@playwright/test";
import { composeEnd, composeStart, queriesOf } from "./ime";

async function openSearch(page: Page) {
  await page.goto("/");
  await expect(page.getByTestId("session-row").first()).toBeVisible();
  await page.keyboard.press("Meta+k");
  await expect(page.getByTestId("search")).toBeVisible();
}

const input = (page: Page) => page.locator("[cmdk-input]");

test("⌘K 打开，输入后按 Session 分组并高亮命中，esc 关闭", async ({ page }) => {
  await openSearch(page);
  await input(page).fill("rate_limit");
  const groups = page.getByTestId("search-group");
  await expect(groups.first()).toBeVisible();
  await expect(groups.first().locator("mark").first()).toBeVisible();
  await expect(page.getByTestId("search-summary")).toContainText("个 Session");
  await expect(page.getByTestId("search")).toContainText("↵ 打开并定位");
  await page.screenshot({ path: process.env.SHOT ?? "test-results/m3-search.png" });
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("search")).toHaveCount(0);
});

test("Enter 打开命中所在 Session", async ({ page }) => {
  await openSearch(page);
  await input(page).fill("令牌桶");
  const first = page.getByTestId("search-hit").first();
  await expect(first).toBeVisible();
  const title = await page.getByTestId("search-group").first().locator("span.font-semibold").innerText();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("search")).toHaveCount(0);
  await expect(page.getByTestId("header").getByRole("heading", { name: title })).toBeVisible();
});

test("Subagent 内的命中带 Subagent 标签，点击后跳转", async ({ page }) => {
  await openSearch(page);
  await input(page).fill("cors");
  const tag = page.getByTestId("tag-subagent").first();
  await expect(tag).toContainText(/Subagent · \S+/);
  await tag.click();
  await expect(page.getByTestId("search")).toHaveCount(0);
  await expect(page.getByTestId("header")).toBeVisible();
});

test("包含工具输出：流式出现进度与新分组", async ({ page }) => {
  await openSearch(page);
  await input(page).fill("File created");
  await expect(page.getByTestId("search-empty")).toBeVisible();
  await page.getByRole("button", { name: "包含工具输出重新搜索" }).click();
  await expect(page.getByTestId("search-progress")).toContainText("正在扫描工具输出");
  await expect(page.getByTestId("search-group").first()).toBeVisible();
  await expect(page.getByTestId("search-progress")).toHaveCount(0);
});

test("无结果时仅陈述事实并提供清除时间过滤", async ({ page }) => {
  await openSearch(page);
  await page.getByRole("button", { name: /时间：/ }).click();
  await page.getByRole("menuitem", { name: "近 7 天" }).click();
  await input(page).fill("zzz_no_such_text");
  await expect(page.getByTestId("search-empty")).toContainText("时间范围为近 7 天");
  await page.getByRole("button", { name: "清除时间过滤" }).click();
  await expect(page.getByRole("button", { name: /时间：全部/ })).toBeVisible();
});

test("输入法组字期间不发起搜索，确认后才按确认的文字搜索", async ({ page }) => {
  await openSearch(page);
  await composeStart(input(page), ["l", "ling", "ling pai tong"]);
  await expect(input(page)).toHaveValue("ling pai tong");
  // Longer than the 200 ms debounce: nothing may be queried while composing.
  await page.waitForTimeout(600);
  expect(await queriesOf(page, "search")).toEqual([]);
  await composeEnd(input(page), "令牌桶");
  await expect(page.getByTestId("search-hit").first()).toBeVisible();
  expect(await queriesOf(page, "search")).toEqual(["令牌桶"]);
});
