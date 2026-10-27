import { differenceInCalendarDays, differenceInMinutes, format } from "date-fns";
import { zhCN } from "date-fns/locale";

/** 48300 -> "48.3K"，1210000 -> "1.21M"。 */
export function formatTokens(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${trim(n / 1000, 1)}K`;
  return `${trim(n / 1_000_000, 2)}M`;
}

/** 美元金额：0 -> "$0"，0.004 -> "<$0.01"，12.345 -> "$12.35"，1234.5 -> "$1,235"。 */
export function formatCost(usd: number): string {
  if (usd <= 0) return "$0";
  if (usd < 0.01) return "<$0.01";
  if (usd < 1000) return `$${usd.toFixed(2)}`;
  return `$${Math.round(usd).toLocaleString("en-US")}`;
}

function trim(v: number, digits: number): string {
  return v.toFixed(digits).replace(/\.?0+$/, "");
}

/** 毫秒 -> "1 小时 12 分"、"5 分"、"30 秒"。 */
export function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h > 0) return m > 0 ? `${h} 小时 ${m} 分` : `${h} 小时`;
  if (m > 0) return `${m} 分`;
  return `${totalSec} 秒`;
}

/** 刚刚 / N 分钟前 / N 小时前 / 昨天 / 周X（一周内）/ M月D日。 */
export function formatRelative(date: Date | number, now: Date | number = new Date()): string {
  const mins = differenceInMinutes(now, date);
  if (mins < 1) return "刚刚";
  if (mins < 60) return `${mins} 分钟前`;
  const days = differenceInCalendarDays(now, date);
  if (days === 0) return `${Math.floor(mins / 60)} 小时前`;
  if (days === 1) return "昨天";
  if (days < 7) return format(date, "EEEE", { locale: zhCN }).replace("星期", "周");
  return format(date, "M月d日", { locale: zhCN });
}

/** A time span `[fromMs, toMs)`: `10月22日 04:00–05:00` within a day, `10月22日` for a whole day, `10月20日–10月26日` across days. */
export function formatSpan(fromMs: number, toMs: number): string {
  const s = new Date(fromMs);
  const last = new Date(toMs - 1);
  const end = new Date(toMs);
  const md = (d: Date) => `${d.getMonth() + 1}月${d.getDate()}日`;
  const hm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  if (md(s) !== md(last)) return `${md(s)}–${md(last)}`;
  if (s.getHours() === 0 && s.getMinutes() === 0 && end.getHours() === 0 && end.getMinutes() === 0) return md(s);
  return `${md(s)} ${hm(s)}–${end.getHours() === 0 && end.getMinutes() === 0 ? "24:00" : hm(end)}`;
}
