"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { MODELS, type Locale, type LocaleStrings } from "./i18n";
import { I } from "./icons";
import { useUI } from "./lib/ui-context";
import { ConnectorIcon } from "./components/ConnectorIcon";
import {
  spaces as spacesApi,
  connectors as connectorsApi,
  type Space,
  type Connector,
} from "./lib/api";

// Dashboard — root page content. The surrounding shell (sidebar, theme
// attributes, locale wiring) lives in AppShell (root layout), so this
// component only renders the greeting + composer. Reads the active locale
// from the UI context so the composer payloads + placeholders stay in sync
// with the sidebar's language toggle.
export default function Dashboard() {
  const { locale, s } = useUI();
  const [model, setModel] = useState<string>("opus-4.7");
  const [mode, setMode] = useState<string>("bedside");
  // Per-message overrides chosen from the composer "+" popover. Both reset on
  // every new chat (which today just clears the input + reply).
  const [activeSpaceId, setActiveSpaceId] = useState<string>("");
  const [activeConnectorIds, setActiveConnectorIds] = useState<string[]>([]);

  return (
    <section className="stage" data-screen-label="01 Dashboard home">
      <div className="stage-inner">
        <h1 className="greet">
          {I.star}
          <span className="brand-greet">
            <span className="b1">Babage</span>
            <span className="b2">Med</span>
            <em className="b3"> Ai</em>
          </span>
        </h1>
        <Composer
          s={s}
          locale={locale}
          model={model}
          setModel={setModel}
          mode={mode}
          setMode={setMode}
          activeSpaceId={activeSpaceId}
          setActiveSpaceId={setActiveSpaceId}
          activeConnectorIds={activeConnectorIds}
          setActiveConnectorIds={setActiveConnectorIds}
        />
      </div>
    </section>
  );
}

// ─── Composer ────────────────────────────────────────────────────────────────
function Composer({
  s, locale, model, setModel,
  activeSpaceId, setActiveSpaceId,
  activeConnectorIds, setActiveConnectorIds,
}: {
  s: LocaleStrings;
  locale: Locale;
  model: string;
  setModel: (m: string) => void;
  mode: string;
  setMode: (m: string) => void;
  activeSpaceId: string;
  setActiveSpaceId: (id: string) => void;
  activeConnectorIds: string[];
  setActiveConnectorIds: React.Dispatch<React.SetStateAction<string[]>>;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [value, setValue] = useState("");
  const [voiceOn, setVoiceOn] = useState(false);
  const [sending, setSending] = useState(false);
  const [reply, setReply] = useState<string>("");
  const [userSpaces, setUserSpaces] = useState<Space[]>([]);
  const [userConnectors, setUserConnectors] = useState<Connector[]>([]);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);

  // Pull the user's spaces + connectors once. Both endpoints require auth; if
  // they 401 the popover just shows the empty-state CTA.
  useEffect(() => {
    spacesApi.list().then(setUserSpaces).catch(() => setUserSpaces([]));
    connectorsApi.list().then(setUserConnectors).catch(() => setUserConnectors([]));
  }, []);

  const activeSpace = useMemo(
    () => userSpaces.find((sp) => sp.id === activeSpaceId),
    [userSpaces, activeSpaceId]
  );

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!composerRef.current?.contains(e.target as Node)) {
        setAddOpen(false);
        setModelOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 280) + "px";
  }, [value]);

  const currentModel = MODELS.find((m) => m.id === model) || MODELS[0];

  // Maps the MODELS entry's `brand` field to the matching SVG mark in
  // icons.tsx. Returns a sensible placeholder so the picker still renders
  // if a new vendor is added before its logo lands.
  function brandMark(brand: string): React.ReactNode {
    switch (brand) {
      case "anthropic": return I.anthropicMark;
      case "google":    return I.geminiMark;
      default:          return <span className="brand-fallback" />;
    }
  }

  function toggleConnector(id: string) {
    setActiveConnectorIds((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
    );
  }

  async function send() {
    if (!value.trim() || sending) return;
    setSending(true);
    setReply("");
    try {
      let spaceContext: unknown[] = [];
      if (activeSpaceId) {
        try {
          spaceContext = await spacesApi.context(activeSpaceId, value);
        } catch {
          // Non-fatal: chat still proceeds without space grounding.
        }
      }
      const useMcps = activeConnectorIds.length > 0 ? activeConnectorIds : ["pubmed"];
      const r = await fetch("/api/backend/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          model,
          mode: "bedside",
          locale,
          messages: [{ role: "user", content: value }],
          useMcps,
          spaceContext,
          spaceName: activeSpace?.name || "",
        }),
      });
      const j = await r.json();
      setReply(j?.completion?.content || j?.error || "(no response)");
    } catch (e: any) {
      setReply("Error: " + e.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <div className="composer" ref={composerRef}>
        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={s.placeholder}
          rows={1}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              send();
            }
          }}
        />
        <div className="composer-bar">
          <button
            className="add-btn"
            type="button"
            data-open={addOpen}
            onClick={() => { setAddOpen((v) => !v); setModelOpen(false); }}
            aria-label="Add"
          >
            {I.plus}
          </button>

          {activeSpace && (
            <button
              type="button"
              className="model-pill"
              onClick={() => setActiveSpaceId("")}
              title="Clear space"
              style={{ background: "var(--cyan-soft)", color: "var(--cyan)", borderColor: "var(--cyan-line)" }}
            >
              📁 {activeSpace.name} ×
            </button>
          )}
          {activeConnectorIds.slice(0, 3).map((id) => {
            const c = userConnectors.find((x) => x.mcpId === id);
            if (!c) return null;
            return (
              <button
                key={id}
                type="button"
                className="model-pill"
                onClick={() => toggleConnector(id)}
                title="Remove from this chat"
                style={{ background: "var(--cyan-soft)", color: "var(--cyan)", borderColor: "var(--cyan-line)", display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <ConnectorIcon id={c.mcpId} name={c.name} iconUrl={c.iconUrl} size={16} />
                {c.name} ×
              </button>
            );
          })}
          {activeConnectorIds.length > 3 && (
            <span className="model-pill" style={{ background: "var(--cyan-soft)", color: "var(--cyan)" }}>
              +{activeConnectorIds.length - 3}
            </span>
          )}

          {addOpen && (
            <div className="popover" role="menu" style={{ maxHeight: 460, overflowY: "auto" }}>
              <div className="pop-header">{s.addConnector}</div>

              <Link href="/spaces" className="popover-row" style={{ textDecoration: "none" }}>
                {I.folder}
                <span className="col">
                  <span className="ttl">{s.addFile}</span>
                  <span className="desc">{s.addFileDesc}</span>
                </span>
              </Link>

              {userSpaces.length > 0 && (
                <>
                  <div className="popover-sep" />
                  <div className="pop-header">{s.spaces}</div>
                  {userSpaces.map((sp) => (
                    <button
                      key={sp.id}
                      type="button"
                      className="popover-row"
                      data-active={activeSpaceId === sp.id}
                      onClick={() => {
                        setActiveSpaceId(activeSpaceId === sp.id ? "" : sp.id);
                        setAddOpen(false);
                      }}
                    >
                      {I.spaces}
                      <span className="col">
                        <span className="ttl">{sp.name}</span>
                        <span className="desc">{sp.fileCount} file{sp.fileCount === 1 ? "" : "s"}</span>
                      </span>
                      {activeSpaceId === sp.id && <span className="check" style={{ color: "var(--cyan)" }}>{I.check}</span>}
                    </button>
                  ))}
                </>
              )}

              <div className="popover-sep" />
              <div className="pop-header">{s.connectors}</div>
              {userConnectors.length === 0 ? (
                <Link href="/mcps" className="popover-row" style={{ textDecoration: "none" }}>
                  {I.link}
                  <span className="col">
                    <span className="ttl">{s.addConnector}</span>
                    <span className="desc">{s.addConnectorDesc}</span>
                  </span>
                </Link>
              ) : (
                <>
                  {userConnectors.map((c) => {
                    const on = activeConnectorIds.includes(c.mcpId);
                    return (
                      <button
                        key={c.mcpId}
                        type="button"
                        className="popover-row"
                        data-active={on}
                        onClick={() => toggleConnector(c.mcpId)}
                      >
                        <ConnectorIcon id={c.mcpId} name={c.name} iconUrl={c.iconUrl} size={22} />
                        <span className="col">
                          <span className="ttl">{c.name}</span>
                          <span className="desc">{c.category}</span>
                        </span>
                        {on && <span className="check" style={{ color: "var(--cyan)" }}>{I.check}</span>}
                      </button>
                    );
                  })}
                  <Link href="/mcps" className="popover-row" style={{ textDecoration: "none", borderTop: "1px solid var(--border)" }}>
                    {I.plus}
                    <span className="col"><span className="ttl">{s.addConnector}</span></span>
                  </Link>
                </>
              )}
            </div>
          )}

          <span className="spacer" />
          <div style={{ position: "relative" }}>
            <button className="model-pill" type="button" data-open={modelOpen} onClick={() => { setModelOpen((v) => !v); setAddOpen(false); }}>
              <span className="brand-mark">{brandMark(currentModel.brand)}</span>
              <span>{currentModel.short}</span>
              {I.chev}
            </button>
            {modelOpen && (
              <div className="model-pop" role="menu">
                <div className="pop-header">{s.modelHeader}</div>
                {MODELS.map((m) => (
                  <button key={m.id} className="model-row" type="button" data-active={model === m.id} onClick={() => { setModel(m.id); setModelOpen(false); }}>
                    <span className="brand-mark">{brandMark(m.brand)}</span>
                    <span className="col">
                      <span className="nm">{m.name}</span>
                      <span className="meta-row">
                        {m.pills[locale].map((p, i) => <span key={i} className="pill">{p}</span>)}
                      </span>
                    </span>
                    <span className="check">{I.check}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className="cmpr-icon" type="button" data-on={voiceOn} onClick={() => setVoiceOn((v) => !v)} aria-label="Mic">{I.mic}</button>
          <button className="cmpr-icon" type="button" aria-label="Voice">{I.voice}</button>
          <button
            className="cmpr-icon"
            type="button"
            onClick={send}
            aria-label="Send"
            disabled={sending}
            style={{ width: "auto", padding: "0 10px", color: "var(--cyan)", borderColor: "var(--cyan-line)", background: "var(--cyan-soft)" }}
          >
            {sending ? "…" : "↵"}
          </button>
        </div>
      </div>
      {reply && (
        <div style={{ background: "var(--panel-solid)", border: "1px solid var(--border)", borderRadius: 14, padding: 16, color: "var(--ink)", whiteSpace: "pre-wrap", lineHeight: 1.6, fontSize: 14 }}>
          {reply}
        </div>
      )}
    </>
  );
}
