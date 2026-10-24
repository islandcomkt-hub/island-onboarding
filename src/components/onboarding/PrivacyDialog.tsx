"use client";
import { forwardRef } from "react";
import PrivacyText from "./PrivacyText";

const PrivacyDialog = forwardRef<HTMLDialogElement, { onClose: () => void; onClearDraft: () => void }>(function PrivacyDialog(
  { onClose, onClearDraft },
  ref,
) {
  return (
    <dialog ref={ref} className="privacy" aria-labelledby="privacy-title" onClose={onClose}>
      <div className="privacy-in">
        <h2 id="privacy-title">Seus dados, com clareza</h2>
        <PrivacyText />
        <div style={{ display: "grid", gap: 10, marginTop: 6 }}>
          <button type="button" className="btn btn-ghost btn-wide" onClick={onClearDraft}>
            Apagar rascunho deste dispositivo
          </button>
          <button type="button" className="btn btn-primary btn-wide" onClick={onClose} autoFocus>
            Entendi
          </button>
        </div>
      </div>
    </dialog>
  );
});

export default PrivacyDialog;
