"use client";

import React, { useEffect, useState } from "react";
import { useUI } from "../lib/ui-context";
import { Modal } from "../components/Modal";
import "./spaces.css";

// CreateSpaceModal — shared create-space dialog used by both the /spaces index
// header and the sidebar's "+ New space" button. A stacked, labeled form
// (emoji field on its own line + a labeled name field) with a Cancel / Create
// footer. On submit it calls onCreate(name, icon); the caller decides where to
// navigate afterward.
export function CreateSpaceModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, icon: string) => Promise<void>;
}) {
  const { s } = useUI();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("📁");
  const [saving, setSaving] = useState(false);

  // Reset the form whenever the dialog (re)opens.
  useEffect(() => {
    if (open) { setName(""); setIcon("📁"); setSaving(false); }
  }, [open]);

  async function submit() {
    const n = name.trim();
    if (!n || saving) return;
    setSaving(true);
    try {
      await onCreate(n, icon.trim() || "📁");
      onClose();
    } catch {
      // Leave the dialog open so the user can retry.
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={s.createSpace} width={460}>
      <div className="sp-create-row">
        {/* Fixed, non-interactive space icon — purely decorative so a click
            never turns it into an editable text field. */}
        <div className="sp-icon-tile" aria-hidden="true">{icon}</div>
        <div className="sp-field" style={{ flex: 1, minWidth: 0 }}>
          <label className="sp-field-label" htmlFor="sp-name">{s.spaceNameLabel}</label>
          <input
            id="sp-name"
            type="text"
            className="feat-modal-input"
            placeholder={s.spaceNamePlaceholder}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
            autoFocus
          />
        </div>
      </div>
      <div className="feat-modal-foot">
        <button
          type="button"
          className="feat-btn-secondary"
          onClick={onClose}
          disabled={saving}
        >{s.cancel}</button>
        <button
          type="button"
          className="feat-btn-primary"
          onClick={submit}
          disabled={saving || !name.trim()}
        >{saving ? s.saving : s.createSpace}</button>
      </div>
    </Modal>
  );
}
