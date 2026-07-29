import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import type { Deck } from "../types";
import { fetchMyDecks } from "../api";

export default function DeckSelectPage() {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchMyDecks()
      .then(setDecks)
      .catch((e) => setError(e instanceof Error ? e.message : "Error al cargar mazos"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={s.wrap}>
      <div style={s.topBar}>
        <Link to="/" style={s.back}>← Menú</Link>
        <h1 style={s.title}>Elegí tu mazo</h1>
      </div>

      {loading && <p style={{ color: "#ccc" }}>Cargando...</p>}
      {error && <p style={{ color: "#e07070" }}>{error}</p>}

      {!loading && decks.length === 0 && (
        <div style={s.empty}>
          <p style={{ color: "#aaa" }}>Todavía no tenés ningún mazo creado.</p>
          <button style={s.newBtn} onClick={() => navigate("/mazos/nuevo?mode=free")}>
            + Crear mi primer mazo
          </button>
        </div>
      )}

      <div style={s.grid}>
        {decks.map((d) => {
          const cardCount = d.cards.reduce((a, c) => a + c.quantity, 0);
          const incomplete = cardCount < 5; // umbral mínimo arbitrario para poder jugar

          return (
            <div key={d.id} style={s.card}>
              <strong style={s.deckName}>{d.name}</strong>
              <span style={s.mode}>{d.mode === "free" ? "Libre" : "Normal"}</span>
              <span style={s.count}>{cardCount} / 30 cartas</span>

              {incomplete && <span style={s.warning}>Mazo muy chico para jugar</span>}

              <div style={s.actions}>
                <button
                  style={{ ...s.btn, ...s.playBtn }}
                  disabled={incomplete}
                  onClick={() => navigate(`/juego/${d.id}`)}
                >
                  Jugar
                </button>
                <button style={s.btn} onClick={() => navigate(`/mazos/${d.id}`)}>Editar</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  wrap: { minHeight: "100vh", background: "#171310", padding: "24px 32px", fontFamily: "Georgia, serif" },
  topBar: { display: "flex", alignItems: "center", gap: 20, marginBottom: 24 },
  back: { color: "#c3a05b", textDecoration: "none" },
  title: { color: "#f3d430", margin: 0 },
  empty: { display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-start" },
  grid: { display: "flex", flexWrap: "wrap", gap: 14 },
  card: {
    background: "#2c241e", border: "2px solid #c3a05b", borderRadius: 8,
    padding: 16, width: 200, display: "flex", flexDirection: "column", gap: 6, color: "#fff",
  },
  deckName: { fontSize: "1.05rem", color: "#f3d430" },
  mode: { fontSize: 12, color: "#c3a05b" },
  count: { fontSize: 12, color: "#ccc" },
  warning: { fontSize: 11, color: "#e0a070" },
  actions: { display: "flex", gap: 6, marginTop: 8 },
  btn: {
    flex: 1, padding: "6px 6px", fontSize: 12, background: "#444",
    border: "1px solid #c3a05b", borderRadius: 4, color: "#fff", cursor: "pointer",
  },
  playBtn: { background: "#3a2c1c", fontWeight: "bold" },
  newBtn: {
    background: "#3a2c1c", border: "2px solid #c3a05b", borderRadius: 6,
    padding: "10px 18px", color: "#f3d430", fontWeight: "bold", cursor: "pointer",
  },
};
