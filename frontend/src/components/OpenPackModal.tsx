import { useState } from "react";
import type { CardData } from "../types";
import { openPack, resolveImageUrl } from "../api";

interface Props {
  onClose: () => void;
  onOpened: () => void; // para refrescar packs_available en el padre
}

export default function OpenPackModal({ onClose, onOpened }: Props) {
  const [cards, setCards] = useState<CardData[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleOpen() {
    setLoading(true);
    setError(null);
    try {
      const result = await openPack();
      setCards(result.cards as CardData[]);
      onOpened();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al abrir el sobre");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={s.overlay}>
      <div style={s.modal}>
        <h2 style={s.title}>Sobre de cartas</h2>

        {!cards && (
          <>
            <p style={s.subtitle}>Vas a recibir 5 cartas al azar de todo el catálogo.</p>
            {error && <p style={s.error}>{error}</p>}
            <div style={s.actions}>
              <button style={s.cancelBtn} onClick={onClose} disabled={loading}>Cancelar</button>
              <button style={s.confirmBtn} onClick={handleOpen} disabled={loading}>
                {loading ? "Abriendo..." : "Abrir sobre"}
              </button>
            </div>
          </>
        )}

        {cards && (
          <>
            <div style={s.grid}>
              {cards.map((c, i) => (
                <div key={i} style={s.cardPreview}>
                  {c.image_url && (
                    <img src={resolveImageUrl(c.image_url)} alt={c.name} style={s.img} />
                  )}
                  <span style={s.cardName}>{c.name}</span>
                </div>
              ))}
            </div>
            <div style={s.actions}>
              <button style={s.confirmBtn} onClick={onClose}>Cerrar</button>
            </div>
          </>
        )}
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
    padding: "28px 32px", width: 480, fontFamily: "Georgia, serif", color: "#f3e8c0",
  },
  title: { margin: 0, color: "#f3d430", fontSize: "1.4rem" },
  subtitle: { color: "#ccc", fontSize: "0.85rem", lineHeight: 1.4 },
  grid: { display: "flex", flexWrap: "wrap", gap: 10, margin: "16px 0" },
  cardPreview: {
    width: 84, display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
  },
  img: { width: 80, height: 100, objectFit: "cover", borderRadius: 6, border: "2px solid #6b5730" },
  cardName: { fontSize: 11, textAlign: "center", color: "#f3e8c0" },
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
