// (auth) route group — bypass the AppShell so login / signup render
// chrome-free (no sidebar, full-width). Re-mounts AuthProvider implicitly
// via the parent root layout.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="auth-wrapper">{children}</div>;
}
