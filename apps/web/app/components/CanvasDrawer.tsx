"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useCanvas, type Artifact } from "../lib/canvas-context";
import { useUI } from "../lib/ui-context";

// CanvasDrawer — the right-side preview pane for an HTML/SVG artifact. Renders
// in a sandboxed iframe (allow-scripts, null origin) so the artifact is
// interactive but cannot reach the parent page, cookies, or storage. Mounted
// once at the app shell; opens whenever useCanvas().open(...) is called.
export function CanvasDrawer() {
  const { artifact, close } = useCanvas();
  const { s } = useUI();
  const [tab, setTab] = useState<"preview" | "code">("preview");

  useEffect(() => {
    if (!artifact) return;
    setTab("preview");
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") close(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [artifact, close]);

  const srcDoc = useMemo(() => (artifact ? buildSrcDoc(artifact) : ""), [artifact]);
  if (!artifact) return null;

  function copy() {
    if (artifact) navigator.clipboard?.writeText(artifact.code).catch(() => {});
  }
  function download() {
    if (!artifact) return;
    const ext = artifact.kind === "svg" ? "svg" : "html";
    const blob = new Blob([artifact.code], { type: artifact.kind === "svg" ? "image/svg+xml" : "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `artifact.${ext}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <>
      <div className="canvas-backdrop" onClick={close} aria-hidden="true" />
      <aside className="canvas-drawer" role="dialog" aria-label={s.canvasTitle}>
        {/*
          Touch-only dismiss affordance. On phones the drawer is width:100vw so it
          fully covers .canvas-backdrop — tap-outside-to-close is impossible and the
          header × can be clipped by the un-wrapped header on a 320px row, leaving a
          touch user with no reliable way out. This grab-handle + full-width Close is
          rendered always but only revealed on coarse-pointer phones via the scoped
          media query below, so desktop layout is byte-identical.
        */}
        <button
          type="button"
          className="canvas-touch-close"
          onClick={close}
          aria-label={s.close}
        >
          <span className="canvas-touch-grip" aria-hidden="true" />
          {s.close}
        </button>
        <header className="canvas-head">
          <span className="canvas-title">{artifact.title || s.canvasTitle}</span>
          <div className="canvas-tabs">
            <button type="button" data-active={tab === "preview"} onClick={() => setTab("preview")}>{s.canvasPreview}</button>
            <button type="button" data-active={tab === "code"} onClick={() => setTab("code")}>{s.canvasCode}</button>
          </div>
          <span className="canvas-spacer" />
          <button type="button" className="canvas-act" onClick={copy} title={s.copy}>{s.copy}</button>
          <button type="button" className="canvas-act" onClick={download} title={s.download}>{s.download}</button>
          <button type="button" className="canvas-act canvas-close" onClick={close} aria-label={s.close}>×</button>
        </header>
        <div className="canvas-body">
          {tab === "preview" ? (
            <iframe
              className="canvas-frame"
              title={s.canvasTitle}
              // allow-scripts only (null origin). Deliberately NOT granting
              // allow-popups/allow-modals — untrusted model HTML could otherwise
              // spoof native dialogs or auto-open phishing pages attributed to us.
              sandbox="allow-scripts"
              srcDoc={srcDoc}
            />
          ) : (
            <pre className="canvas-codeview" dir="ltr">{artifact.code}</pre>
          )}
        </div>
      </aside>
      {/*
        Scoped, self-contained styling for the touch-only close affordance above.
        Default (desktop) is display:none, so layout is unchanged at >=561px; the
        control is only revealed inside the phone media query. Kept in this file so
        it does not depend on dashboard.css (owned elsewhere).
      */}
      <style>{`
        .canvas-touch-close { display: none; }
        @media (max-width: 560px) {
          .canvas-touch-close {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            width: 100%;
            min-height: 44px;
            padding: 8px 12px;
            padding-top: max(8px, env(safe-area-inset-top));
            border: none;
            border-bottom: 1px solid var(--border, rgba(127,127,127,0.2));
            background: var(--panel-solid, var(--panel, transparent));
            color: inherit;
            font: inherit;
            font-size: 13px;
            cursor: pointer;
          }
          .canvas-touch-grip {
            width: 36px;
            height: 4px;
            border-radius: 999px;
            background: currentColor;
            opacity: 0.4;
          }
        }
      `}</style>
    </>
  );
}

function buildSrcDoc(a: Artifact): string {
  if (a.kind === "svg") {
    return `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;height:100%;display:flex;align-items:center;justify-content:center;background:#fff}svg{max-width:100%;max-height:100%}</style></head><body>${a.code}</body></html>`;
  }
  // html — if it already looks like a full document, use as-is; otherwise wrap.
  const looksFull = /<html[\s>]/i.test(a.code) || /<!doctype/i.test(a.code);
  if (looksFull) return a.code;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;padding:16px;font-family:system-ui,sans-serif;background:#fff;color:#111}</style></head><body>${a.code}</body></html>`;
}
