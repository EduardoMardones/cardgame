import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import type { Deck, DeckMode } from "../types";
import { fetchMyDecks, deleteDeck } from "../api";

export default function DeckListPage() {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      setDecks(await fetchMyDecks());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar mazos");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Borrar este mazo?")) return;
    try {
      await deleteDeck(id);
      setDecks((prev) => prev.filter((d) => d.id !== id));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error al borrar");
    }
  }

  function handleCreate(mode: DeckMode) {
    navigate(`/mazos/nuevo?mode=${mode}`);
  }

  return (
    <div style={s.wrap}>
      <div style={s.topBar}>
        <Link to="/" style={s.back}>← Menú</Link>
        <h1 style={s.title}>Mis mazos</h1>
        <div style={{ display: "flex", gap: 10 }}>
          <button style={s.newBtn} onClick={() => handleCreate("normal")}>+ Mazo normal</button>
          <button style={s.newBtnAlt} onClick={() => handleCreate("free")}>+ Mazo libre</button>
        </div>
      </div>

      {loading && <p style={{ color: "#ccc" }}>Cargando...</p>}
      {error && <p style={{ color: "#e07070" }}>{error}</p>}

      {!loading && decks.length === 0 && (
        <p style={{ color: "#aaa" }}>Todavía no creaste ningún mazo.</p>
      )}

      <div style={s.grid}>
        {decks.map((d) => (
          <div key={d.id} style={s.card}>
            <strong style={s.deckName}>{d.name}</strong>
            <span style={s.mode}>{d.mode === "free" ? "Libre" : "Normal"}</span>
            <span style={s.count}>{d.cards.reduce((a, c) => a + c.quantity, 0)} / 30 cartas</span>
            <div style={s.actions}>
              <button style={s.btn} onClick={() => navigate(`/mazos/${d.id}`)}>Editar</button>
              <button style={{ ...s.btn, background: "#7a1f1f" }} onClick={() => handleDelete(d.id)}>Borrar</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  wrap: { minHeight: "100vh", background: "#171310", padding: "24px 32px", fontFamily: "Georgia, serif" },
  topBar: { display: "flex", alignItems: "center", gap: 20, marginBottom: 24, flexWrap: "wrap" },
  back: { color: "#c3a05b", textDecoration: "none" },
  title: { color: "#f3d430", margin: 0, flex: 1 },
  newBtn: {
    background: "#3a2c1c", border: "2px solid #c3a05b", borderRadius: 6,
    padding: "8px 16px", color: "#f3d430", fontWeight: "bold", cursor: "pointer",
  },
  newBtnAlt: {
    background: "transparent", border: "2px solid #6b5730", borderRadius: 6,
    padding: "8px 16px", color: "#ccc", cursor: "pointer",
  },
  grid: { display: "flex", flexWrap: "wrap", gap: 14 },
  card: {
    background: "#2c241e", border: "2px solid #c3a05b", borderRadius: 8,
    padding: 16, width: 200, display: "flex", flexDirection: "column", gap: 6, color: "#fff",
  },
  deckName: { fontSize: "1.05rem", color: "#f3d430" },
  mode: { fontSize: 12, color: "#c3a05b" },
  count: { fontSize: 12, color: "#ccc" },
  actions: { display: "flex", gap: 6, marginTop: 8 },
  btn: {
    flex: 1, padding: "5px 6px", fontSize: 11, background: "#444",
    border: "1px solid #c3a05b", borderRadius: 4, color: "#fff", cursor: "pointer",
  },
};
