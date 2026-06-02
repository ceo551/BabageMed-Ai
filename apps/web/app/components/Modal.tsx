"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useUI } from "../lib/ui-context";

// Modal — minimal dialog primitive used by the New-Space form (and any
// future create / edit dialogs). Renders a centered card over a dimmed
// backdrop. ESC and backdrop-click close. Body scroll locks while open so
// the page underneath doesn't drift.
//
// Accessibility: focus is moved into the dialog on open, trapped inside
// while open, and restored to the originally-focused element on close.

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  /** Optional title shown in the header row. */
  title?: React.ReactNode;
  /** Width in px; defaults to 540 which fits the new-space form well. */
  width?: number;
  children: React.ReactNode;
};

const FOCUSABLE =
  'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({ open, onClose, title, width = 540, children }: ModalProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<Element | null>(null);
  // These two hooks MUST run on every render — before the `if (!open)`
  // early-return below. Calling them after a conditional return is a Rules-
  // of-Hooks violation: while the modal is closed they don't run, and the
  // first time `open` flips true React sees "more hooks than last render"
  // and throws (the whole feature page crashed into the ErrorBoundary the
  // moment any modal-opening button — Instructions / Files / Skills — was
  // clicked).
  const titleId = useId();
  const { s } = useUI();
  // Render into document.body via a portal so the fixed-position backdrop
  // escapes any ancestor that establishes a containing block for fixed
  // elements (the sidebar uses backdrop-filter, which would otherwise trap
  // and shrink the modal into the sidebar's corner — the New-space dialog
  // bug). Gate on mount so SSR/first paint doesn't touch document.body.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open) return;
    triggerRef.current = document.activeElement;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Flag the dialog as open on <body> so global chrome (the mobile sidebar
    // toggle buttons, which are position:fixed at a higher z-index than the
    // sub-sidebar drawer the modal lives in) can hide itself and stop
    // bleeding over the dialog. See .modal-open rules in the CSS.
    document.body.classList.add("modal-open");

    // Move focus into the dialog on the next tick so the card has mounted.
    queueMicrotask(() => {
      const card = cardRef.current;
      if (!card) return;
      const first = card.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? card).focus();
    });

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      // Focus trap: when Tab would leave the modal, wrap to the other end.
      if (e.key !== "Tab") return;
      const card = cardRef.current;
      if (!card) return;
      const items = Array.from(card.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => !el.hasAttribute("disabled"));
      if (items.length === 0) {
        e.preventDefault();
        card.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.body.classList.remove("modal-open");
      document.removeEventListener("keydown", onKey);
      // Restore focus to the trigger element so keyboard users don't get
      // dumped at the top of the page after close.
      if (triggerRef.current && triggerRef.current instanceof HTMLElement) {
        try { triggerRef.current.focus(); } catch { /* element may be detached */ }
      }
      triggerRef.current = null;
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  // Stable id for aria-labelledby — screen readers announce the dialog
  // with its title text instead of just "dialog". When `title` is a non-
  // string ReactNode we fall back to aria-label="dialog" (no good way to
  // serialise arbitrary JSX into an accessible name). titleId/s are
  // computed above (before the early return) to satisfy the Rules of Hooks.
  const labelProps = title
    ? (typeof title === "string"
        ? { "aria-label": title }
        : { "aria-labelledby": titleId })
    : { "aria-label": "Dialog" };
  return createPortal((
    <div
      className="modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      {...labelProps}
    >
      <div ref={cardRef} className="modal-card" style={{ width }} tabIndex={-1}>
        {title && (
          <div className="modal-header">
            <div className="modal-title" id={titleId}>{title}</div>
            <button
              type="button"
              className="modal-close"
              onClick={onClose}
              aria-label={s.closeDialog}
            >
              ×
            </button>
          </div>
        )}
        <div className="modal-body">{children}</div>
      </div>
    </div>
  ), document.body);
}
