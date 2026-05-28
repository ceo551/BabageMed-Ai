"use client";

import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ConnectorIcon } from "./ConnectorIcon";
import { safeUrlTransform } from "../lib/url-transform";

// Citation as returned by the backend's /api/chat[/stream] handler. The
// `source` field is the MCP id (e.g. "pubmed", "fda"); `result` is whatever
// the MCP's search tool returned — the chip is now clickable and expanding
// it inline shows a JSON preview of the underlying retrieval.
export type Citation = {
  source: string;
  result?: unknown;
};

// AssistantMessage — renders one assistant turn with full markdown (GFM
// extension: tables, task lists, strikethrough, autolinks) plus the source
// chips for any MCP that fed the response. Mirrors how Claude / Gemini
// present a turn — text first, then a tidy footer of provenance.
//
// Wrapped in React.memo (see export at bottom) because the parent
// <Transcript> re-renders on every streamed token; without memo every
// previous assistant turn re-runs react-markdown on each delta — a
// measurable perf hit at 5+ turns. Referential-equality check on props
// works because content is a primitive and citations are a stable array
// reference from the SSE handler until a new one is emitted.
function AssistantMessageInner({
  content,
  citations,
}: {
  content: string;
  citations?: Citation[];
}) {
  const [openCitation, setOpenCitation] = useState<number | null>(null);

  return (
    <div className="msg msg-assistant">
      <div className="md-body" dir="auto">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          // Allow only http(s):, mailto:, and relative URLs. Defence in depth
          // against a future regression where the backend forwards user-
          // controlled markdown — javascript:, data:, and chrome-extension:
          // URLs are stripped (rendered as plain text). Tested by
          // apps/web/app/lib/url-transform.test.ts.
          urlTransform={safeUrlTransform}
          components={{
            a: ({ href, children }) => (
              <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
            ),
            // Wrap multi-line code fences with a hover-revealed Copy button.
            // ReactMarkdown gives us a <pre><code class="language-x">; we
            // intercept <pre> so the button sits in the corner of the block
            // (not next to inline `code`).
            pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
          }}
        >
          {content || ""}
        </ReactMarkdown>
      </div>
      {citations && citations.length > 0 && (
        <div className="msg-citations">
          <div className="msg-citations-label">{(typeof window !== "undefined" && document.documentElement.lang === "ar") ? "المصادر" : "Sources"}</div>
          <div className="msg-citations-list">
            {citations.map((c, i) => {
              const isOpen = openCitation === i;
              return (
                <React.Fragment key={`${c.source}-${i}`}>
                  <button
                    type="button"
                    className="msg-citation"
                    data-open={isOpen}
                    aria-expanded={isOpen}
                    onClick={() => setOpenCitation(isOpen ? null : i)}
                    title={isOpen ? "Hide details" : "Show raw retrieval"}
                  >
                    <ConnectorIcon id={c.source} name={c.source} size={14} />
                    <span>{c.source}</span>
                  </button>
                  {isOpen && c.result !== undefined && (
                    <pre className="msg-citation-detail" dir="ltr">
                      {jsonPreview(c.result)}
                    </pre>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// React.memo wrapper — primitive `content` + stable citations reference
// short-circuit re-render when nothing relevant changed. The custom
// equality fn is necessary because citations defaults to undefined and
// the default shallow compare treats undefined as equal-to-undefined,
// but we want a length+ref check on the array too.
export const AssistantMessage = React.memo(AssistantMessageInner, (prev, next) => {
  if (prev.content !== next.content) return false;
  if (prev.citations === next.citations) return true;
  if (!prev.citations || !next.citations) return false;
  return prev.citations.length === next.citations.length;
});

// CodeBlock — pre tag with a Copy button revealed on hover. Pure CSS reveal
// would have worked but we also need to swap the label to "Copied!" for two
// seconds after a successful write, which needs JS state. The button skips
// rendering when the block contains no text (defensive — react-markdown
// occasionally passes empty children for unclosed fences mid-stream).
function CodeBlock({ children }: { children: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const ref = React.useRef<HTMLPreElement>(null);

  async function onCopy() {
    const text = ref.current?.innerText ?? "";
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard API blocked (insecure context, permission denied). Fall
      // back to a manual select-all so the user can ctrl-c themselves.
      const sel = window.getSelection();
      const range = document.createRange();
      if (ref.current) {
        range.selectNodeContents(ref.current);
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }
  }

  return (
    <pre ref={ref} className="md-code">
      <button
        type="button"
        className="md-code-copy"
        onClick={onCopy}
        aria-label={copied ? "Copied" : "Copy code"}
      >
        {copied ? "Copied ✓" : "Copy"}
      </button>
      {children}
    </pre>
  );
}

// Format the citation's raw result for the expand-on-click panel. Capped at
// 2 KB so a 50 KB PubMed JSON dump doesn't blow up the chat column.
function jsonPreview(v: unknown): string {
  try {
    const s = JSON.stringify(v, null, 2);
    return s.length > 2048 ? s.slice(0, 2048) + "\n… (truncated)" : s;
  } catch {
    return String(v);
  }
}
