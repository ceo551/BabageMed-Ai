import type { ReactElement } from "react";

// Shared line-icon set for the public marketing pages (Product / Pricing /
// About). Clean 24px stroke icons that inherit color from .mkt-card-ic (cyan),
// replacing the old emoji glyphs for a more professional, consistent look.

function svg(children: ReactElement | ReactElement[]): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const MktIcon: Record<string, ReactElement> = {
  // Multi-model chat
  chat: svg(<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />),
  // Spaces (stacked projects)
  spaces: svg(
    [
      <path key="a" d="M20 17a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3.9a2 2 0 0 1-1.69-.9l-.81-1.2a2 2 0 0 0-1.67-.9H8a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2Z" />,
      <path key="b" d="M2 8v11a2 2 0 0 0 2 2h14" />,
    ],
  ),
  // Skills (expertise)
  skills: svg(
    [
      <path key="a" d="M9.94 14.06A2 2 0 0 0 8.5 12.6l-5.2-1.34a.5.5 0 0 1 0-.96L8.5 8.94A2 2 0 0 0 9.94 7.5l1.34-5.2a.5.5 0 0 1 .96 0l1.34 5.2a2 2 0 0 0 1.44 1.44l5.2 1.34a.5.5 0 0 1 0 .96l-5.2 1.34a2 2 0 0 0-1.44 1.44l-1.34 5.2a.5.5 0 0 1-.96 0z" />,
      <path key="b" d="M19 4v3" />,
      <path key="c" d="M20.5 5.5h-3" />,
    ],
  ),
  // Connectors (plug)
  connectors: svg(
    [
      <path key="a" d="M12 22v-5" />,
      <path key="b" d="M9 8V2" />,
      <path key="c" d="M15 8V2" />,
      <path key="d" d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z" />,
    ],
  ),
  // Image & video (media)
  media: svg(
    [
      <rect key="a" width="18" height="18" x="3" y="3" rx="2" ry="2" />,
      <circle key="b" cx="9" cy="9" r="2" />,
      <path key="c" d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />,
    ],
  ),
  // Deep Research (search / scope)
  research: svg(
    [
      <circle key="a" cx="11" cy="11" r="7" />,
      <path key="b" d="m21 21-4.3-4.3" />,
    ],
  ),
  // Agent Mode (bot)
  agent: svg(
    [
      <path key="a" d="M12 8V4H8" />,
      <rect key="b" width="16" height="12" x="4" y="8" rx="2" />,
      <path key="c" d="M2 14h2" />,
      <path key="d" d="M20 14h2" />,
      <path key="e" d="M15 13v2" />,
      <path key="f" d="M9 13v2" />,
    ],
  ),
  // Bilingual (globe)
  globe: svg(
    [
      <circle key="a" cx="12" cy="12" r="10" />,
      <path key="b" d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />,
      <path key="c" d="M2 12h20" />,
    ],
  ),
  // Credits pool (wallet)
  wallet: svg(
    [
      <path key="a" d="M19 7V5a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1" />,
      <path key="b" d="M3 6v13a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-4" />,
    ],
  ),
  // Predictable (bar chart)
  chart: svg(
    [
      <line key="a" x1="12" x2="12" y1="20" y2="10" />,
      <line key="b" x1="18" x2="18" y1="20" y2="4" />,
      <line key="c" x1="6" x2="6" y1="20" y2="16" />,
    ],
  ),
  // More models as you grow (trending up)
  growth: svg(
    [
      <polyline key="a" points="22 7 13.5 15.5 8.5 10.5 2 17" />,
      <polyline key="b" points="16 7 22 7 22 13" />,
    ],
  ),
  // Many models (layers)
  layers: svg(
    [
      <path key="a" d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />,
      <path key="b" d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />,
      <path key="c" d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />,
    ],
  ),
  // Context (folder)
  folder: svg(<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />),
  // Privacy (shield with check)
  shield: svg(
    [
      <path key="a" d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />,
      <path key="b" d="m9 12 2 2 4-4" />,
    ],
  ),
  // Calm by design (compass)
  compass: svg(
    [
      <circle key="a" cx="12" cy="12" r="10" />,
      <polygon key="b" points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />,
    ],
  ),
};
