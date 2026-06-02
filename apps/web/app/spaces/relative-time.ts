import type { Locale } from "../i18n";

// relativeTime — render an ISO timestamp as a short, human "… ago" phrase.
// Uses Intl.RelativeTimeFormat so plurals are correct in every locale (Arabic
// has distinct singular/dual/plural forms the old hand-rolled strings got
// wrong — e.g. "٢ يوم" vs the correct "يومان"), and now covers minutes →
// years instead of capping at days (a 3-month-old space read "92 days ago").
// Unparseable input and future timestamps (clock skew) both fall back to
// "just now".
export function relativeTime(iso: string, locale: Locale = "en"): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return locale === "ar" ? "الآن" : "just now";

  const sec = Math.floor((Date.now() - then) / 1000);
  // Under a minute, or a future timestamp from clock skew → "just now".
  if (sec < 60) return locale === "ar" ? "الآن" : "just now";

  const rtf = new Intl.RelativeTimeFormat(locale === "ar" ? "ar" : "en", {
    numeric: "always",
    style: "long",
  });

  // Largest unit that yields a value ≥ 1. Months/years use the conventional
  // 30-day / 365-day approximations — accurate enough for a "… ago" footer.
  const min = Math.floor(sec / 60);
  if (min < 60) return rtf.format(-min, "minute");
  const hr = Math.floor(min / 60);
  if (hr < 24) return rtf.format(-hr, "hour");
  const day = Math.floor(hr / 24);
  if (day < 30) return rtf.format(-day, "day");
  const month = Math.floor(day / 30);
  if (month < 12) return rtf.format(-month, "month");
  return rtf.format(-Math.floor(day / 365), "year");
}
