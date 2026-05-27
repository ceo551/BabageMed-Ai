"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { I } from "../../icons";
import { useUI } from "../../lib/ui-context";
import { useAuth } from "../../lib/auth-context";
import { chats as chatsApi, type Chat } from "../../lib/api";
import type { FeatureMeta } from "../../i18n";

// FeatureSubSidebar — left column of the feature page, designed to read
// as "glued" to the main app sidebar. Shows the feature's name, a New
// chat button for that feature, and a chats-for-this-feature history
// list. Per-feature chats are filtered via ?feature=<slug>, which the
// general History row (?feature=general) excludes.
export function FeatureSubSidebar({ meta }: { meta: FeatureMeta }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { user } = useAuth();
  const { s } = useUI();
  const activeChatId = params?.get("c") || "";

  const [items, setItems] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) { setItems([]); return; }
    let cancelled = false;
    setLoading(true);
    chatsApi.list(meta.slug)
      .then((list) => { if (!cancelled) setItems(list); })
      .catch(() => { if (!cancelled) setItems([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user, pathname, params, meta.slug]);

  function startNewChat() {
    // Push the same /features/<slug> URL with a nonce param so the
    // FeatureChat effect re-fires and clears the transcript. Drops any
    // ?c=<id> in the process.
    router.push(`/features/${encodeURIComponent(meta.slug)}?n=${Date.now()}`);
  }

  async function removeChat(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    let removed: Chat | undefined;
    setItems((cur) => {
      removed = cur.find((c) => c.id === id);
      return cur.filter((c) => c.id !== id);
    });
    try {
      await chatsApi.remove(id);
      if (id === activeChatId) router.push(`/features/${encodeURIComponent(meta.slug)}`);
    } catch {
      if (removed) {
        const r = removed;
        setItems((cur) => (cur.some((c) => c.id === r.id) ? cur : [r, ...cur]));
      }
    }
  }

  return (
    <aside className="feat-subsb" aria-label={meta.label} data-color={meta.color}>
      <header className="feat-subsb-head">
        <span className="feat-subsb-emoji" aria-hidden="true">{meta.emoji}</span>
        <div className="feat-subsb-title">
          <span className="t">{meta.label}</span>
          <span className="sub">{s.workspace}</span>
        </div>
      </header>

      <button className="feat-subsb-new" type="button" onClick={startNewChat}>
        {I.plus}
        <span>{s.new}</span>
      </button>

      <div className="feat-subsb-section-label">{s.recent}</div>
      {!user ? (
        <div className="feat-subsb-empty">{s.signInToKeepHistory}</div>
      ) : loading && items.length === 0 ? (
        <div className="feat-subsb-empty">{s.loadingChats}</div>
      ) : items.length === 0 ? (
        <div className="feat-subsb-empty">{s.noChatsYet}</div>
      ) : (
        <ul className="feat-subsb-list">
          {items.slice(0, 50).map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className="feat-subsb-item"
                data-active={c.id === activeChatId}
                onClick={() => router.push(`/features/${encodeURIComponent(meta.slug)}?c=${encodeURIComponent(c.id)}`)}
                title={c.title || "Untitled chat"}
              >
                <span className="feat-subsb-item-title">{c.title || "Untitled chat"}</span>
                <span
                  className="feat-subsb-item-del"
                  role="button"
                  tabIndex={0}
                  aria-label="Delete chat"
                  onClick={(e) => removeChat(c.id, e)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      removeChat(c.id, e as unknown as React.MouseEvent);
                    }
                  }}
                  title="Delete chat"
                >×</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
