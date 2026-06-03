"use client";

import React, { createContext, useCallback, useContext, useState } from "react";

// Canvas / Artifacts — render a model-generated HTML/SVG code block in a
// sandboxed iframe split-pane, à la Claude Artifacts / ChatGPT Canvas.
//
// The app CSP allows 'unsafe-inline' scripts, so inline-script HTML artifacts
// run inside a `sandbox="allow-scripts"` (null-origin) iframe — interactive
// without being able to touch the parent page or cookies. External CDNs are
// CSP-blocked, so mermaid / React-via-CDN are deferred to a later pass.
export type ArtifactKind = "html" | "svg";
export type Artifact = { code: string; kind: ArtifactKind; title?: string };

type CanvasCtx = {
  artifact: Artifact | null;
  open: (a: Artifact) => void;
  close: () => void;
};

const Ctx = createContext<CanvasCtx | null>(null);

// useCanvas returns a safe no-op shape outside a provider so shared components
// (AssistantMessage) don't crash on pages that didn't mount the provider.
export function useCanvas(): CanvasCtx {
  return useContext(Ctx) ?? { artifact: null, open: () => {}, close: () => {} };
}

// renderableKind maps a fenced-code language to an artifact kind, or null when
// the block isn't something we can preview.
export function renderableKind(lang: string | undefined): ArtifactKind | null {
  const l = (lang || "").toLowerCase();
  if (l === "html" || l === "htm") return "html";
  if (l === "svg") return "svg";
  return null;
}

export function CanvasProvider({ children }: { children: React.ReactNode }) {
  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const open = useCallback((a: Artifact) => setArtifact(a), []);
  const close = useCallback(() => setArtifact(null), []);
  return <Ctx.Provider value={{ artifact, open, close }}>{children}</Ctx.Provider>;
}
