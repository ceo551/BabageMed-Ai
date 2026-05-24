"use client";

import React, { useState } from "react";
import { Modal } from "../components/Modal";
import { spaces as spacesApi, type Space } from "../lib/api";

// NewSpaceModal — Perplexity-style create dialog: emoji icon picker, title,
// description (optional), custom instructions (optional). Submitting calls
// the new Spaces API (icon + instructions added in migration 004) and
// returns the created Space to the parent via onCreated.
//
// The icon palette is hard-coded; the user picks one (the chosen glyph
// appears large in the corner) or leaves the default. Empty string is a
// valid "no icon" — the rest of the UI falls back to the first letter of
// the name in that case.

const ICONS = [
  "📚", "💼", "💡", "🚀", "📊", "🎯", "🔬", "🌱", "🎨",
  "💰", "🏠", "🌍", "💪", "🧠", "💯", "📝", "🩺", "💊",
  "🧪", "🩻", "📓", "🗂️", "🧬", "⚕️",
];

export type NewSpaceModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (sp: Space) => void;
};

export function NewSpaceModal({ open, onClose, onCreated }: NewSpaceModalProps) {
  const [icon, setIcon] = useState<string>(ICONS[0]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setIcon(ICONS[0]);
    setName("");
    setDescription("");
    setInstructions("");
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const sp = await spacesApi.create({
        name: name.trim(),
        description: description.trim(),
        icon,
        instructions: instructions.trim(),
      });
      onCreated(sp);
      reset();
      onClose();
    } catch (e: any) {
      setError(e?.error || String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={() => { if (!busy) { reset(); onClose(); } }} title="Create a new Space">
      <form className="new-space-form" onSubmit={submit}>
        {/* Icon picker — selected glyph rendered large on the left, the rest
            of the palette to the right. */}
        <label className="field-label">Icon</label>
        <div className="icon-row">
          <span className="icon-preview" aria-hidden="true">{icon}</span>
          <div className="icon-palette">
            {ICONS.map((g) => (
              <button
                key={g}
                type="button"
                className="icon-chip"
                data-active={g === icon}
                onClick={() => setIcon(g)}
                aria-label={`Pick ${g}`}
              >
                {g}
              </button>
            ))}
            <button
              type="button"
              className="icon-chip"
              onClick={() => setIcon("")}
              data-active={icon === ""}
              aria-label="No icon"
              title="No icon"
            >
              ⌀
            </button>
          </div>
        </div>

        <label className="field-label" htmlFor="ns-title">Title</label>
        <input
          id="ns-title"
          type="text"
          className="field-input"
          placeholder="Name this Space"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={200}
          autoFocus
        />

        <label className="field-label" htmlFor="ns-desc">
          Description <span className="optional">(optional)</span>
        </label>
        <textarea
          id="ns-desc"
          className="field-input"
          placeholder="Describe what this Space is for"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />

        <label className="field-label" htmlFor="ns-instr">
          Instructions <span className="optional">(optional)</span>
        </label>
        <textarea
          id="ns-instr"
          className="field-input"
          placeholder="Custom instructions for the agent in this Space"
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={4}
        />

        {error && <div className="new-space-error">{error}</div>}

        <div className="new-space-actions">
          <button
            type="button"
            className="ghost-btn"
            onClick={() => { if (!busy) { reset(); onClose(); } }}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="primary-btn"
            disabled={!name.trim() || busy}
          >
            {busy ? "Creating…" : "Create"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
