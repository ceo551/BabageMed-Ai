"use client";

import React, { useEffect, useRef } from "react";

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

  useEffect(() => {
    if (!open) return;
    triggerRef.current = document.activeElement;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

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
      document.removeEventListener("keydown", onKey);
      // Restore focus to the trigger element so keyboard users don't get
      // dumped at the top of the page after close.
      if (triggerRef.current && triggerRef.current instanceof HTMLElement) {
        try { triggerRef.current.focus(); } catch { /* element may be detached */ }
      }
      triggerRef.current = null;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
    >
      <div ref={cardRef} className="modal-card" style={{ width }} tabIndex={-1}>
        {title && (
          <div className="modal-header">
            <div className="modal-title">{title}</div>
            <button
              type="button"
              className="modal-close"
              onClick={onClose}
              aria-label="Close dialog"
            >
              ×
            </button>
          </div>
        )}
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
