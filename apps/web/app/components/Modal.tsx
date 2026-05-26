"use client";

import React, { useEffect } from "react";

// Modal — minimal dialog primitive used by the New-Space form (and any
// future create / edit dialogs). Renders a centered card over a dimmed
// backdrop. ESC and backdrop-click close. Body scroll locks while open so
// the page underneath doesn't drift.

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  /** Optional title shown in the header row. */
  title?: React.ReactNode;
  /** Width in px; defaults to 540 which fits the new-space form well. */
  width?: number;
  children: React.ReactNode;
};

export function Modal({ open, onClose, title, width = 540, children }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
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
      <div className="modal-card" style={{ width }}>
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
