import { useState } from "react";
import type { CatalogEntry } from "../types";

interface Props {
  origins: CatalogEntry[];
  onClaim: (originId: string) => Promise<void>;
  onClose: () => void;
}

// Modal "Elige tu set inicial" — Paso 5.3 del plan.
// Se muestra cuando el usuario crea/entra a un mazo modo "normal" y todavía
// no reclamó ningún origen (su colección está vacía).
export default function ClaimOriginModal({ origins, onClaim, onClose }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    if (!selected) return;
    setLoading(true);
    setError(null);
    try {
      await onClaim(selected);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al reclamar el origen");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={s.overlay}>
      <div style={s.modal}>
        <h2 style={s.title}>Elige tu set inicial</h2>
        <p style={s.subtitle}>
          Vas a recibir automáticamente todas las cartas de este origen en tu colección.
          Esta elección es única, así que elegí con calma.
        </p>

        <div style={s.grid}>
          {origins.map((o) => (
            <button
              key={o.id}
              style={{ ...s.option, ...(selected === o.id ? s.optionActive : {}) }}
              onClick={() => setSelected(o.id)}
            >
              {o.name}
            </button>
          ))}
        </div>

        {error && <p style={s.error}>{error}</p>}

        <div style={s.actions}>
          <button style={s.cancelBtn} onClick={onClose} disabled={loading}>Cancelar</button>
          <button style={s.confirmBtn} onClick={handleConfirm} disabled={!selected || loading}>
            {loading ? "Reclamando..." : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
  },
  modal: {
    background: "#1e1510", border: "2px solid #c3a05b", borderRadius: 12,
    padding: "28px 32px", width: 420, fontFamily: "Georgia, serif", color: "#f3e8c0",
  },
  title: { margin: 0, color: "#f3d430", fontSize: "1.4rem" },
  subtitle: { color: "#ccc", fontSize: "0.85rem", lineHeight: 1.4 },
  grid: { display: "flex", flexWrap: "wrap", gap: 10, margin: "16px 0" },
  option: {
    background: "#2c241e", border: "2px solid #6b5730", borderRadius: 8,
    padding: "10px 16px", color: "#f3e8c0", cursor: "pointer", fontFamily: "Georgia, serif",
  },
  optionActive: { border: "2px solid #f3d430", background: "#3a2c1c", color: "#f3d430" },
  error: { color: "#e07070", fontSize: "0.85rem" },
  actions: { display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 },
  cancelBtn: {
    background: "transparent", border: "1px solid #6b5730", borderRadius: 6,
    padding: "8px 16px", color: "#ccc", cursor: "pointer",
  },
  confirmBtn: {
    background: "#3a2c1c", border: "2px solid #c3a05b", borderRadius: 6,
    padding: "8px 20px", color: "#f3d430", fontWeight: "bold", cursor: "pointer",
  },
};
