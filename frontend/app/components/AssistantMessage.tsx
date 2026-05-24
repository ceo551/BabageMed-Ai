"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ConnectorIcon } from "./ConnectorIcon";

// Citation as returned by the backend's /api/chat[/stream] handler. The
// `source` field is the MCP id (e.g. "pubmed", "fda"); `result` is whatever
// the MCP's search tool returned. We only render the source pill today;
// expanding the raw result inline is a future iteration.
export type Citation = {
  source: string;
  result?: unknown;
};

// AssistantMessage — renders one assistant turn with full markdown (GFM
// extension: tables, task lists, strikethrough, autolinks) plus the source
// chips for any MCP that fed the response. Mirrors how Claude / Gemini
// present a turn — text first, then a tidy footer of provenance.
export function AssistantMessage({
  content,
  citations,
}: {
  content: string;
  citations?: Citation[];
}) {
  return (
    <div className="msg msg-assistant">
      {/* dir="auto" lets the browser pick per-paragraph direction from the
        * first strong character — Arabic answers render RTL, English LTR,
        * mixed paragraphs flip individually. */}
      <div className="md-body" dir="auto">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            // Strip default <p> margins so the assistant turn flows compactly.
            a: ({ href, children }) => (
              <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
            ),
          }}
        >
          {content || ""}
        </ReactMarkdown>
      </div>
      {citations && citations.length > 0 && (
        <div className="msg-citations">
          <div className="msg-citations-label">Sources</div>
          <div className="msg-citations-list">
            {citations.map((c, i) => (
              <span key={`${c.source}-${i}`} className="msg-citation">
                <ConnectorIcon id={c.source} name={c.source} size={14} />
                <span>{c.source}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
