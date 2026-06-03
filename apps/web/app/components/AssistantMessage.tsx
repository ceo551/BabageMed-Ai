"use client";

import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ConnectorIcon } from "./ConnectorIcon";
import { safeUrlTransform } from "../lib/url-transform";
import { useUI } from "../lib/ui-context";

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
  const { s } = useUI();

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
        <SourceCards
          cards={normaliseCitations(citations)}
          label={s.sources}
          openIdx={openCitation}
          onToggle={(i) => setOpenCitation(openCitation === i ? null : i)}
        />
      )}
    </div>
  );
}

// ── Citations → numbered source cards ──────────────────────────────────────
// A flat, numbered list whose `n` matches the [n] markers the model is asked
// to emit (backend buildSystem uses the identical flattening + ordering):
// each web result is its own card; each MCP connector is one card.
type SourceCardData = {
  n: number;
  kind: "web" | "mcp";
  source: string;        // mcp id, or domain for web
  title?: string;
  url?: string;
  snippet?: string;
  raw?: unknown;         // mcp raw retrieval (expandable)
};

function normaliseCitations(citations: Citation[]): SourceCardData[] {
  const cards: SourceCardData[] = [];
  let n = 0;
  for (const c of citations) {
    if (c.source === "web-search" && Array.isArray(c.result)) {
      for (const w of c.result as Array<Record<string, unknown>>) {
        const url = typeof w.url === "string" ? w.url : "";
        n++;
        cards.push({
          n,
          kind: "web",
          source: domainOf(url) || "web",
          title: typeof w.title === "string" ? w.title : url,
          url,
          snippet: typeof w.description === "string" ? w.description : undefined,
        });
      }
      continue;
    }
    n++;
    cards.push({ n, kind: "mcp", source: c.source, raw: c.result });
  }
  return cards;
}

function SourceCards({
  cards,
  label,
  openIdx,
  onToggle,
}: {
  cards: SourceCardData[];
  label: string;
  openIdx: number | null;
  onToggle: (i: number) => void;
}) {
  if (cards.length === 0) return null;
  return (
    <div className="msg-sources">
      <div className="msg-sources-label">{label}</div>
      <div className="msg-sources-grid">
        {cards.map((card, i) =>
          card.kind === "web" ? (
            <a
              key={`w-${card.n}`}
              className="src-card"
              href={card.url}
              target="_blank"
              rel="noopener noreferrer"
              title={card.url}
            >
              <span className="src-card-head">
                <span className="src-num" aria-hidden="true">{card.n}</span>
                {card.url ? (
                  <img
                    className="src-fav"
                    src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(card.source)}&sz=32`}
                    alt=""
                    width={14}
                    height={14}
                    loading="lazy"
                  />
                ) : null}
                <span className="src-domain">{card.source}</span>
              </span>
              <span className="src-title">{card.title}</span>
              {card.snippet ? <span className="src-snippet">{card.snippet}</span> : null}
            </a>
          ) : (
            <div key={`m-${card.n}`} className="src-card src-card-mcp">
              <button
                type="button"
                className="src-card-head src-card-mcp-btn"
                aria-expanded={openIdx === i}
                onClick={() => onToggle(i)}
                title={openIdx === i ? "Hide raw retrieval" : "Show raw retrieval"}
              >
                <span className="src-num" aria-hidden="true">{card.n}</span>
                <ConnectorIcon id={card.source} name={card.source} size={14} />
                <span className="src-title">{card.source}</span>
              </button>
              {openIdx === i && card.raw !== undefined && (
                <pre className="msg-citation-detail" dir="ltr">{jsonPreview(card.raw)}</pre>
              )}
            </div>
          ),
        )}
      </div>
    </div>
  );
}

// domainOf extracts a bare host (no www.) for the favicon + label.
function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
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
  if (prev.citations.length !== next.citations.length) return false;
  // Length match alone fooled the comparator into skipping renders
  // when a stream emitted a same-count citations list with different
  // sources (e.g. an MCP swap mid-answer). Compare source IDs in
  // order — cheap (citations are typically ≤8) and catches the case.
  for (let i = 0; i < prev.citations.length; i++) {
    if (prev.citations[i].source !== next.citations[i].source) return false;
  }
  return true;
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
