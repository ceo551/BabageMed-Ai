// Instant Suspense fallback shown the moment a user navigates to /mcps,
// before the page's data fetch resolves — gives immediate "loading" feedback.
export default function Loading() {
  return (
    <div className="ps-loading">
      <span className="ps-spinner" aria-hidden="true" />
      <span>Loading…</span>
    </div>
  );
}
