import type { Locale } from "../i18n";

// relativeTime — render an ISO timestamp as a short, human "… ago" phrase.
// Buckets: just now / N minutes / N hours / N days ago. Bilingual (EN/AR)
// so the spaces index footer reads naturally in both locales. Falls back to
// "just now" for unparseable / future timestamps.
export function relativeTime(iso: string, locale: Locale = "en"): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return locale === "ar" ? "الآن" : "just now";

  const diffMs = Date.now() - then;
  const sec = Math.floor(diffMs / 1000);

  if (sec < 60) return locale === "ar" ? "الآن" : "just now";

  const min = Math.floor(sec / 60);
  if (min < 60) {
    return locale === "ar"
      ? `منذ ${min} ${min === 1 ? "دقيقة" : "دقائق"}`
      : `${min} ${min === 1 ? "minute" : "minutes"} ago`;
  }

  const hr = Math.floor(min / 60);
  if (hr < 24) {
    return locale === "ar"
      ? `منذ ${hr} ${hr === 1 ? "ساعة" : "ساعات"}`
      : `${hr} ${hr === 1 ? "hour" : "hours"} ago`;
  }

  const day = Math.floor(hr / 24);
  return locale === "ar"
    ? `منذ ${day} ${day === 1 ? "يوم" : "أيام"}`
    : `${day} ${day === 1 ? "day" : "days"} ago`;
}
