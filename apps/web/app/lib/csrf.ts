// Same-origin check used by /api/backend/* on mutating methods. Pure
// function so it can be unit-tested without spinning up the Next.js
// route handler.
//
// The contract:
//   - Origin header present → must equal http(s)://<request-host>
//   - Origin absent BUT Referer present → Referer URL's host must
//     equal the request host
//   - Both absent → reject (real browsers always send one or the other
//     on a mutating request)

export interface CsrfHeaders {
  origin?: string | null;
  referer?: string | null;
  host?: string | null;
}

export function sameOrigin(h: CsrfHeaders): boolean {
  const origin = h.origin ?? null;
  const referer = h.referer ?? null;
  const host = h.host ?? null;
  if (!host) return false;
  if (origin) {
    return origin === `http://${host}` || origin === `https://${host}`;
  }
  if (referer) {
    try {
      return new URL(referer).host === host;
    } catch {
      return false;
    }
  }
  return false;
}
