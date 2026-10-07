import { format } from "date-fns";

/** 毫秒时间戳 -> "10:42"。 */
export const clock = (ms: number | null | undefined): string => (ms == null ? "" : format(ms, "HH:mm"));

/** Pretty-prints JSON text; returns the input unchanged when it does not parse. */
export function prettyJson(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}
