// Instant Suspense fallback shown the moment a user navigates to /mcps,
// before the page's data fetch resolves — gives immediate "loading" feedback.
export default function Loading() {
  return (
    <div className="bb-loading">
      <span className="bb-spinner" aria-hidden="true" />
      <span>Loading…</span>
    </div>
  );
}
